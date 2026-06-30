---
type: design
status: active
created: 2026-06-29
tags: [feature, design, xml, nfe, mercado, preco, historico]
---

# Design: Análise e Comparação de XMLs de Notas Fiscais de Mercado

## Objetivo

Permitir que o usuário faça **upload de XMLs de NF-e (modelo 55 e NFC-e 65)** de compras de mercado, **extraia produtos + preços + dados do estabelecimento**, e construa um **histórico de preços por produto/mercado** que responda perguntas como:

- "Onde o arroz está mais barato hoje?"
- "Se eu comprar carne no Mercado A e hortifruti no Mercado B, quanto eu economizo por mês?"
- "Esse mercado está sempre mais barato ou só tava em promoção?"

## Contexto lido do vault

- **Stack:** Node.js + Express (porta 3001), MongoDB com replica set, JWT + emailVerificado, multi-tenant. Frontend React 19 + CRACO + MUI + Tailwind 4. `decimal.js` 10.4 obrigatório pra qualquer valor monetário.
- **`xml2js` já está em uso** (`importacaoOFXService.js:4`). Não precisa instalar lib nova.
- **Módulo de importações é maduro:** existe `parsers/` com registry extensível (`index.js`, `genericoCSV.js`, `nubankExtrato.js`, `nubankFatura.js`, `jsonParser.js`) que detecta automaticamente o tipo de arquivo e delega pro parser certo. **Vamos adicionar `nfeParser.js`** nesse registry.
- **Modelos multi-tenant relevantes:** `Categoria`, `Tag` (já com índices `unique(usuario, nome)`), `Instituicao` (escopada por usuário, mas hoje é só pra Pluggy/banco).
- **Multi-tenant é GUIA FORTE:** toda query a dados de mercado filtra por `usuario`. Importação de um usuário não pode vazar nada de outro.

## Decisões travadas com o Alisson (brainstorm)

1. **Escopo total:** histórico + comparativo entre mercados + insights automáticos ("você economizaria R$X se mudasse o café pro Mercado B").
2. **Formato de entrega:** **3 marcos curtos com sign-off entre eles** (não 1 plano gigante).
3. **Formato dos XMLs:** NF-e padrão SEFAZ (modelo 55 e 65). Schema universal.
4. **Casamento de produtos:** estratégia de **3 pisos** — EAN (forte) > cProd+mercado (médio) > fuzzy match de descrição (fraco).
5. **Preço-base pra comparação:** preço por unidade de medida (R$/kg, R$/L, R$/un). Exige guardar unidade e fator de conversão.
6. **Link XML ↔ Transação do Pluggy/CSV:** **NÃO linkar** na v1. XML e transação do cartão são entidades independentes. Link é Fase 4 (opcional).
7. **Categorias dos produtos:** **sistema NOVO, separado** de Categoria/Tag de transação. Conceitos diferentes (produto é uma coisa, gasto é outra). Sem reaproveitar multi-tenant existente pra não misturar domínios.

## Abordagens consideradas (arquitetura geral)

### Abordagem A — Módulo "Notas Fiscais" autocontido (recomendado)

**Idéia:** criar um módulo novo `mercado/` no backend, espelhado em `importacao/` mas com seus próprios modelos (NotaFiscal, ItemNotaFiscal, Produto, CategoriaProduto, HistoricoPreco) e rotas. Frontend ganha nova seção no menu "Mercados" com 3 telas: Notas, Produtos, Comparativo.

- **Pró:**
  - Isolamento de domínio claro — não enriquece ou polui `importacao` (que já está sobrecarregado de responsabilidades).
  - Modelos próprios = pode evoluir livremente sem refatorar coisas existentes (risco zero pro resto do sistema).
  - Aderente à forma como o projeto já está organizado (módulo de Empréstimos fez a mesma coisa quando ficou grande — ver ADR-015).
  - Frontend ganha área dedicada, sem brigar com PlaceHolderProvider/ImportacaoProvider.
- **Contra:**
  - Mais arquivos novos (5 modelos + 1 service + 1 controller + 1 route + parser novo).
  - Pode ter 2 conceitos parecidos (a `Importacao` original e a `NotaFiscal` nova) que confundem quem chega no projeto. Mitigação: documentação clara + nome "NotaFiscal" deixa óbvio que é coisa de mercado.
- **Quando usar:** **esta é a recomendação.** Alinha com o padrão arquitetural do projeto.

### Abordagem B — Extender `importacao/` direto

**Idéia:** reaproveitar `Importacao` e `TransacaoImportada` como base, adicionar campos novos pra NF-e (cEAN, cProd, unidade, etc) e criar um modelo só `ItemNotaFiscal` pros produtos.

- **Pró:** menos código novo no começo.
- **Contra:** `Importacao` foi feita pra CSV/transações bancárias (dedup key baseada em descrição+valor+data — não faz sentido pra item de mercado). `TransacaoImportada` é 1 linha = 1 transação, mas 1 NF-e tem 50+ itens — vira gambiarra. Poluir o modelo de `Importacao` com campos `cnpjMercado`/`valorTotalNota` quebra o propósito original.
- **Quando usar:** se o time fosse mínimo e o objetivo fosse entregar em 1 sprint sacrificando qualidade. Não é o caso aqui.

### Abordagem C — Serviço externo + DB local mínimo

**Idéia:** usar um SaaS de parsing de NF-e (Tipo Fisco, NFe.io, etc), guardar só os resultados parseados no Mongo local.

- **Pró:** zero trabalho de parser.
- **Contra:** dependência externa, custo recorrente, dados financeiros pessoais saindo do sistema, parseadores pagos às vezes têm limite de requisições. Pra um sistema pessoal é overkill e cria dependência desnecessária.
- **Quando usar:** empresa de médio/grande porte com volume alto. Não é o caso.

### Decisão

**Abordagem A.** É a que respeita os princípios do projeto e não cria retrabalho futuro.

---

## Arquitetura do módulo (alto nível)

### Backend

```
backend/src/
├── models/
│   ├── notaFiscal.js              # cabeçalho da NF-e (1 doc por XML importado)
│   ├── itemNotaFiscal.js          # cada item dentro da nota (N docs por nota)
│   ├── produto.js                 # entidade canônica: "Arroz Cristal 5kg" independente da nota
│   ├── categoriaProduto.js        # categoria do produto (Hortifruti, Limpeza, Bebida...)
│   ├── vinculoProduto.js          # tabela de desambiguação: "ARROZ C 5KG" do Mercado A == produto X
│   └── historicoPreco.js          # opcional, derivado: agregado mensal de preço/unidade
│
├── services/
│   ├── mercado/
│   │   ├── nfeParser.js           # parseia XML → objeto JS estruturado (lógica pura)
│   │   ├── notaFiscalService.js   # orquestra upload → parse → salvar
│   │   ├── produtoService.js      # casar/criar produto, fuzzy match, histórico
│   │   ├── comparativoService.js  # (Marco 3) agrega preços por categoria/mercado
│   │   └── insightsService.js     # (Marco 3) gera "você economizaria R$X se..."
│   └── parsers/
│       └── nfeAdapter.js          # adapter pro registry existente (delega pro services/mercado/nfeParser)
│
├── controllers/
│   ├── notaFiscalController.js
│   ├── produtoController.js
│   ├── categoriaProdutoController.js
│   └── comparativoController.js   # (Marco 3)
│
└── routes/
    └── rotasMercado.js
```

### Frontend

```
controle-gastos-frontend/src/
├── pages/Mercado/                  # nova área no menu
│   ├── MercadoNotas.js             # lista de notas fiscais importadas
│   ├── MercadoNotaDetalhes.js      # detalhes de 1 nota + seus itens
│   ├── MercadoProdutos.js          # catálogo de produtos
│   ├── MercadoProdutoDetalhes.js   # histórico de preços de 1 produto + gráfico
│   └── MercadoComparativo.js       # (Marco 3) comparar mercados
│
├── components/Mercado/
│   ├── ImportarNotaFiscalForm.js   # drop zone de XMLs
│   ├── NotaFiscalCard.js
│   ├── ItemNotaFiscalRow.js
│   ├── ProdutoCard.js
│   ├── HistoricoPrecoChart.js      # (Marco 2) gráfico de evolução
│   ├── ComparativoTable.js         # (Marco 3)
│   └── InsightCard.js              # (Marco 3)
│
└── hooks/
    ├── useImportarNotaFiscal.js
    ├── useProdutos.js
    ├── useComparativoMercados.js   # (Marco 3)
    └── useInsightsMercado.js       # (Marco 3)
```

### Sidebar / menu

Adicionar entrada "Mercados" em `menuStructure.js` entre "Transações" e "Relatório" (ordem de prioridade pessoal). Sub-itens:
- Notas (lista)
- Produtos (catálogo)
- Comparativo (só visível a partir do Marco 3)

---

## Modelos de dados (esboço)

### `NotaFiscal` (1 doc por XML importado)

| Campo | Tipo | Descrição |
|---|---|---|
| `_id` | ObjectId | — |
| `usuario` | ObjectId ref `Usuario` | multi-tenant |
| `chaveAcesso` | String (44 chars) | `infNFe/@Id` — chave única da NF-e |
| `numero` | String | `nNF` |
| `serie` | String | `serie` |
| `modelo` | String enum ['55', '65'] | `mod` |
| `dataEmissao` | Date | `dhEmi` ou `dEmi` |
| `valorTotal` | Decimal128 | `vProd` ou `vNF` |
| `estabelecimento` | subdoc | ver abaixo |
| `caminhoArquivoOriginal` | String | path no `uploads/nfe/` |
| `xmlHash` | String (sha256) | dedup antes de parsear (evita reprocessar o mesmo arquivo) |
| `itensCount` | Number | count de `ItemNotaFiscal` (denormalizado pra performance de listagem) |
| `status` | String enum ['processando', 'processada', 'erro'] | — |
| `erro` | String \| null | mensagem de erro se status='erro' |
| `createdAt`/`updatedAt` | Date | timestamps |

**Subdoc `estabelecimento`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `cnpj` | String (14 chars) | `CNPJ` do emitente |
| `razaoSocial` | String | `xNome` |
| `nomeFantasia` | String | `xFant` (pode ser null) |
| `inscricaoEstadual` | String | `IE` |
| `endereco` | subdoc | `xLgr`, `nro`, `xBairro`, `xMun`, `UF`, `CEP` |

**Índices:**
- `unique(usuario, chaveAcesso)` — não importa a mesma nota 2x
- `unique(usuario, xmlHash)` — fallback se a chaveAcesso vier faltando (raro, mas acontece)
- `(usuario, dataEmissao -1)` — ordenação cronológica
- `(estabelecimento.cnpj, usuario)` — pra agrupar notas por mercado

### `ItemNotaFiscal` (1 doc por produto dentro da nota)

| Campo | Tipo | Descrição |
|---|---|---|
| `_id` | ObjectId | — |
| `notaFiscal` | ObjectId ref `NotaFiscal` | — |
| `usuario` | ObjectId | multi-tenant |
| `numeroItem` | Number | `nItem` (ordem no XML) |
| `codigoProduto` | String | `cProd` (código interno do mercado) |
| `ean` | String \| null | `cEAN` (código de barras, 8 ou 13 dígitos; pode vir `SEM GTIN`) |
| `descricaoOriginal` | String | `xProd` (descrição como veio no XML) |
| `quantidade` | Decimal | `qCom` |
| `unidade` | String | `uCom` (UN, KG, L, M, CX, etc) |
| `valorUnitario` | Decimal | `vUnCom` |
| `valorTotal` | Decimal | `vProd` |
| `ncm` | String | `NCM` (classificação fiscal) — útil pra categorização automática |
| `cfop` | String | `CFOP` |
| `produtoId` | ObjectId ref `Produto` \| null | preenchido após casamento (pode ser null se for item novo que o usuário ainda não categorizou) |
| `categoriaSugeridaId` | ObjectId ref `CategoriaProduto` \| null | inferida pelo NCM ou por histórico |
| `precoPorUnidadeBase` | Decimal \| null | ver "normalização de unidade" abaixo |

**Índices:**
- `(notaFiscal, numeroItem)` — garantia de ordem
- `(usuario, ean)` — pra busca por EAN no casamento
- `(usuario, codigoProduto, notaFiscal.estabelecimento.cnpj)` — chave composta "cProd + mercado" (Piso 2 do casamento)
- `(produtoId, dataEmissao da notaFiscal -1)` — histórico de preços por produto

### `Produto` (entidade canônica, o "Arroz Cristal 5kg" único)

| Campo | Tipo | Descrição |
|---|---|---|
| `_id` | ObjectId | — |
| `usuario` | ObjectId | multi-tenant |
| `nome` | String | nome amigável dado pelo usuário (ex: "Arroz Cristal Tipo 1 5kg") |
| `descricao` | String | — |
| `categoriaId` | ObjectId ref `CategoriaProduto` \| null | — |
| `unidadeBase` | String enum ['UN', 'KG', 'L', 'G', 'ML'] | unidade "canônica" do produto (pra comparar arroz 5kg com arroz 1kg) |
| `fatorConversao` | Number | multiplicador pra converter `qCom` (comercial) → unidadeBase. Ex: arroz 5kg = 5 KG → unidadeBase='KG', fatorConversao=1. Arroz 1kg = 1000 G → unidadeBase='KG', fatorConversao=0.001. |
| `ativo` | Boolean | — |
| `dataCriacao`/`dataAtualizacao` | Date | timestamps |

**Índices:**
- `unique(usuario, nome)` — cada produto tem nome único por usuário
- `(usuario, categoriaId)` — listagem filtrada

### `VinculoProduto` (desambiguação: "esse nome do XML = esse produto")

| Campo | Tipo | Descrição |
|---|---|---|
| `_id` | ObjectId | — |
| `usuario` | ObjectId | — |
| `produtoId` | ObjectId ref `Produto` | — |
| `mercadoCnpj` | String (14 chars) | chave do estabelecimento (só vale pra esse mercado) |
| `chaveCasamento` | String | normalizado: `EAN` se tiver, senão `cProd` (codigoProduto) |
| `tipoChave` | String enum ['EAN', 'CPROD'] | qual campo foi usado |
| `descricaoNormalizada` | String | `xProd` normalizado (uppercase, sem acento, trim) — pra fuzzy match futuro |
| `confianca` | Number enum [1, 2, 3] | 3=match exato EAN confirmado, 2=match exato cProd, 1=match fuzzy confirmado manualmente |

**Índices:**
- `unique(usuario, mercadoCnpj, chaveCasamento, tipoChave)` — não duplica vínculo
- `(usuario, produtoId)` — listagem "onde esse produto aparece?"

### `CategoriaProduto`

| Campo | Tipo | Descrição |
|---|---|---|
| `_id` | ObjectId | — |
| `usuario` | ObjectId | — |
| `nome` | String | ("Hortifruti", "Limpeza", "Bebidas", "Carnes", "Grãos", ...) |
| `descricao` | String | — |
| `cor` | String | — |
| `icone` | String | — |
| `ativo` | Boolean | — |
| `dataCriacao`/`dataAtualizacao` | Date | timestamps |

**Índices:**
- `unique(usuario, nome)` — multi-tenant
- Seed inicial: 8 categorias default no setup (Hortifruti, Carnes, Laticínios, Grãos/Panificados, Limpeza, Bebidas, Frios, Outros).

### `HistoricoPreco` (opcional, derivado — para performance)

Pode ser **derivado em tempo de query** (agregação Mongo) OU **materializado** num doc mensal. Decisão: **começa derivado, materializa só se query ficar lenta**. Estimativa: 1 usuário típico tem ~500 itens/mês. Agregação mensal por produto é rápida em Mongo com índice certo.

**Se materializar no futuro:**

| Campo | Tipo | Descrição |
|---|---|---|
| `produtoId` | ObjectId | — |
| `mercadoCnpj` | String | — |
| `anoMes` | String (YYYY-MM) | granularidade mensal |
| `precoMedioUnidadeBase` | Decimal | — |
| `menorPrecoUnidadeBase` | Decimal | — |
| `maiorPrecoUnidadeBase` | Decimal | — |
| `amostras` | Number | qtd de notas que compuseram a média |

---

## Fluxo de processamento do XML (end-to-end)

### Upload (POST `/api/mercado/notas-fiscais` com `multipart/form-data`)

1. Multer recebe 1+ arquivos XML em `uploads/nfe/`.
2. Para cada arquivo:
   a. Calcula `xmlHash = sha256(conteudo)`.
   b. Verifica se já existe `NotaFiscal` com mesmo `xmlHash` → pula com warning.
   c. Envia pro `nfeParser` (xml2js).
   d. **Validação de schema:** confere que tem `<NFe>` ou `<nfeProc>`, que tem `infNFe/ide/nNF`, etc. Se não, marca status='erro' com mensagem.
   e. **Extrai dados do emitente** (`emit`) — `CNPJ`, `xNome`, `xFant`, endereço.
   f. **Para cada `<det nItem="X">`:** cria um `ItemNotaFiscal` em batch (insertMany).
   g. Cria `NotaFiscal` (cabeçalho) com totais e referência aos itens.
3. Retorna `{ criadas: N, erros: [{arquivo, mensagem}] }`.

### Casamento de produto (service `produtoService.casarItens(notaFiscalId)`)

Roda **logo após** o parse de cada nota. Algoritmo em 3 pisos:

```
para cada ItemNotaFiscal da nota:
  se já tem produtoId setado: pula (casamento manual prévio)
  
  PISO 1: match por EAN
    busca VinculoProduto onde 
      chaveCasamento = item.ean 
      AND mercadoCnpj = nota.estabelecimento.cnpj
      AND tipoChave = 'EAN'
    se achou: atribui item.produtoId = vinculo.produtoId, item.precoPorUnidadeBase = calcular(...)
  
  PISO 2: match por cProd (código interno do mercado)
    busca VinculoProduto onde
      chaveCasamento = item.codigoProduto
      AND mercadoCnpj = nota.estabelecimento.cnpj
      AND tipoChave = 'CPROD'
    se achou: atribui
  
  PISO 3: fuzzy match (futuro, Marco 2 ou 3)
    se descriçãoNormalizada(item.descricaoOriginal) tem match >= 85% 
    contra produtos já conhecidos do usuário no mesmo mercado:
      marca como "sugestão" pro usuário confirmar na UI
      (não atribui direto — pode dar match errado)
  
  se nenhum match: item.produtoId = null, item.categoriaSugeridaId = inferirPorNCM(item.ncm)
```

### Inferência de categoria por NCM

Tabela de mapeamento NCM → CategoriaProduto (estática, hardcoded no service):

```js
// exemplo
const NCM_PARA_CATEGORIA = {
  '0601': 'Hortifruti',  // plantas vivas
  '0602': 'Hortifruti',
  '0603': 'Hortifruti',  // flores
  '0701': 'Hortifruti',  // batatas
  '0702': 'Hortifruti',  // tomates
  '0803': 'Hortifruti',  // bananas
  // ... ~50-80 entradas pros NCs mais comuns de mercado
  '0201': 'Carnes',  // carne bovina
  '0203': 'Carnes',  // carne suína
  '0207': 'Carnes',  // aves
  '0303': 'Carnes',  // peixes
  '0401': 'Laticínios',
  '0402': 'Laticínios',  // leite
  '1006': 'Grãos/Panificados',  // arroz
  // ...
};
```

**Limitação consciente:** NCM às vezes é genérico (ex: 99999999 = "outros"). Vai ter buracos. Quando a categoria for nula, o item entra como "Outros" e o usuário pode categorizar manualmente depois.

### Normalização de unidade (`precoPorUnidadeBase`)

```js
function calcularPrecoPorUnidadeBase(item, produto) {
  // item.unidade = "UN" | "KG" | "G" | "L" | "ML" | etc
  // produto.unidadeBase + produto.fatorConversao
  
  if (item.unidade === produto.unidadeBase) {
    return item.valorUnitario;  // R$/KG direto
  }
  
  // caso especial: KG → G
  if (item.unidade === 'G' && produto.unidadeBase === 'KG') {
    return item.valorUnitario * 1000;  // R$/g → R$/kg
  }
  
  if (item.unidade === 'KG' && produto.unidadeBase === 'G') {
    return item.valorUnitario / 1000;
  }
  
  // ML → L similar
  
  return item.valorUnitario * produto.fatorConversao;
}
```

Se `produto` ainda não tem `unidadeBase`/`fatorConversao` definidos (produto novo), o sistema **cria com defaults** baseado no que veio no XML (ex: `unidade=uCom`, `fatorConversao=1`) e deixa o usuário ajustar depois.

### Listagem de produtos com histórico (Marco 2)

```
GET /api/mercado/produtos?categoriaId=...&busca=...
  → retorna lista paginada de Produto + métricas:
     {
       id, nome, categoria, unidadeBase,
       mercados: [
         { cnpj, razaoSocial, ultimoPreco, menorPreco, maiorPreco, amostraCount }
       ]
     }

GET /api/mercado/produtos/:id/historico?mercadoCnpj=...&periodo=...
  → retorna série temporal de preços/unidade pra gráfico
  → [
       { data: '2026-01-15', preco: 5.50, mercado: {...} },
       ...
     ]
```

### Comparativo (Marco 3)

```
GET /api/mercado/comparativo?categoriaId=...&periodo=YYYY-MM
  → para cada produto da categoria, agrega preço médio por mercado:
     [
       { produtoId, produtoNome, unidadeBase,
         precos: { 
           '11.222.333/0001-44': 5.50,  // Mercado A
           '22.333.444/0001-55': 5.20,  // Mercado B
         }
       }
     ]

GET /api/mercado/comparativo/insights?categoriaId=...&periodo=YYYY-MM
  → retorna sugestões de economia:
     [
       { tipo: 'mover_compra', produto, mercadoAtualSugerido, economiaEstimada, confianca }
     ]
```

---

## Endpoints (resumo)

Todos sob `/api/mercado/*`, todos com `autenticacao` + `emailVerificado`. Multi-tenant garantido via `req.usuario._id` em todos.

| Método | Rota | Marco | Descrição |
|---|---|---|---|
| POST | `/notas-fiscais` | M1 | Upload de 1+ XMLs (multipart) |
| GET | `/notas-fiscais` | M1 | Listar notas (filtros: data, mercado, status) |
| GET | `/notas-fiscais/:id` | M1 | Detalhes de 1 nota + seus itens |
| DELETE | `/notas-fiscais/:id` | M1 | Excluir nota (cascade nos itens) |
| PUT | `/notas-fiscais/:id/itens/:itemId/produto` | M1 | Vincular item a produto manualmente (link direto) |
| POST | `/produtos` | M1 | Criar produto |
| GET | `/produtos` | M2 | Listar produtos (filtros: categoria, busca) |
| GET | `/produtos/:id` | M2 | Detalhes do produto |
| PUT | `/produtos/:id` | M2 | Editar (nome, unidadeBase, fatorConversao, categoria) |
| GET | `/produtos/:id/historico` | M2 | Série temporal de preços |
| GET | `/categorias-produto` | M1 | Listar categorias |
| POST | `/categorias-produto` | M1 | Criar categoria |
| PUT | `/categorias-produto/:id` | M1 | Editar |
| DELETE | `/categorias-produto/:id` | M1 | Excluir (só se não tiver produtos vinculados) |
| GET | `/comparativo` | M3 | Comparativo de preços entre mercados |
| GET | `/comparativo/insights` | M3 | Sugestões de economia |

---

## Os 3 marcos (fatiamento do escopo)

### Marco 1 — Upload + visualização básica (entrega valor imediato)

**Escopo:**
- Upload de 1+ XMLs de NF-e (múltiplos arquivos por vez)
- Parse com xml2js (modelo 55 e 65)
- Persistência de `NotaFiscal`, `ItemNotaFiscal`, `CategoriaProduto`
- **Casamento de produtos só pelos Pisos 1 e 2** (EAN + cProd). Sem fuzzy match ainda.
- Telas:
  - `/mercado/notas` — lista de notas (com filtros: período, mercado, status)
  - `/mercado/notas/:id` — detalhes da nota + lista de itens, com botão "vincular a produto" pra cada item
  - `/mercado/categorias` — CRUD de categorias de produto
  - `/mercado/produtos/criar` — modal/página pra criar produto novo e vincular a 1 item
- Seed inicial: 8 categorias default no primeiro acesso do usuário (Hortifruti, Carnes, Laticínios, Grãos/Panificados, Limpeza, Bebidas, Frios, Outros).
- Inferência de categoria por NCM implementada (tabela hardcoded de ~50-80 NCs de mercado).

**Validação:** o usuário faz upload de 5 XMLs reais de mercados diferentes, vê as notas e os itens na UI, cria produtos e vincula manualmente os que o casamento automático não pegou.

**Plano técnico resumido (pra writing-plans depois):**
- Backend: criar 4 modelos + 2 services + 1 controller + 1 rota + 1 parser no registry
- Frontend: 3 páginas + 4 componentes + 2 hooks + entrada no menu
- Multer config novo (`uploads/nfe/`, mime `text/xml` + `application/xml`)
- **Sem migration:** seed de CategoriaProduto defaults é on-demand no primeiro GET `/categorias-produto` (cria as 8 se o usuário não tiver nenhuma)

**O que NÃO entra no M1:** histórico, gráficos, comparativo, insights, fuzzy match, link com transação Pluggy.

### Marco 2 — Histórico de preços + visualização por produto

**Escopo:**
- Endpoint `/produtos/:id/historico` (agregação por mês)
- Componente de gráfico (chart.js, já no stack) — linha do tempo de preço/unidade
- Tela `/mercado/produtos` — catálogo com busca, filtro por categoria
- Tela `/mercado/produtos/:id` — detalhes + gráfico + lista de mercados onde aparece + métricas
- Implementação de **Piso 3 (fuzzy match)** com Levenshtein ou similaridade de Jaccard — "esses 2 itens são o mesmo produto?" com confirmação do usuário
- Edição de `produto.unidadeBase` e `fatorConversao` na UI (pra corrigir inferência errada)

**Validação:** o usuário vê o histórico de 1 produto nos últimos 3 meses, identifica que "Arroz T1 5kg" no Mercado A subiu 15% e no Mercado B está estável. Decide que vale trocar.

**Pré-requisito:** M1 estável + usuário com pelo menos 2 meses de dados importados.

### Marco 3 — Comparativo entre mercados + insights automáticos

**Escopo:**
- Tela `/mercado/comparativo` — tabela de produtos vs mercados (preço médio/mês)
- Filtros: por categoria, por período
- Endpoint `/comparativo/insights` que gera:
  - "Se você comprasse toda a categoria X no Mercado B, economizaria R$ Y/mês"
  - "Mercado A está 12% mais barato em Hortifruti nos últimos 90 dias"
  - "O preço do Café subiu 30% no Mercado A — vale verificar promoções no B"
- Componente `InsightCard` com cards de insight no topo da Home (ou do menu Mercado)
- Tela de detalhes de Mercado (lista de produtos disponíveis naquele mercado, evolução do gasto mensal)

**Validação:** o usuário responde "onde comprar café" e o sistema dá: Mercado B com R$ 18/kg vs Mercado A com R$ 22/kg nos últimos 60 dias. Decide que vale atravessar a cidade pra ir no B.

---

## Migrações

**Nenhuma migration nova.** O seed das 8 categorias default é feito **on-demand pelo service** no primeiro GET `/api/mercado/categorias-produto` (se o usuário não tiver nenhuma categoria cadastrada, o service cria as 8 padrões). Migração física só faria sentido se quiséssemos re-seedar ou alterar defaults em produção — não é o caso.

---

## Pontos de atenção / riscos

### Risco 1 — XMLs malformados / encoding estranho

NF-e brasileira é UTF-8 obrigatório por padrão, mas mercado pode mandar com BOM, latin-1 escapado, etc. **Mitigação:** usar `chardet` (já no projeto, via importacaoService.js) antes de parsear, igual CSV faz.

### Risco 2 — Volume de `ItemNotaFiscal` no banco

Estimativa: 500-1000 itens/mês/usuário. Em 2 anos: ~20.000 docs. Trivial pra Mongo. Mas se tornar 100k+, considerar **particionamento por ano/mês** ou TTL em items muito antigos (você raramente olha histórico de 5 anos atrás, e o preço de 2021 não impacta decisão de compra hoje). **Não fazer agora** — logar e reavaliar no M3.

### Risco 3 — Casamento incorreto (match falso positivo)

Se 2 produtos diferentes tiverem o mesmo EAN (raro, mas acontece com produtos paralelos), o Piso 1 atribui errado. **Mitigação:** UI mostra "esse item foi casado automaticamente, confirma?" com botão "desvincular" sempre visível. O item fica vinculado, mas o usuário pode desfazer em 1 clique.

### Risco 4 — Privacidade do XML

NF-e tem CPF do consumidor (campo `<dest>`), endereço, hora exata da compra. **Decisão:** **descartar tudo de `<dest>`** no parse. Guardar só o que importa pra análise (estabelecimento, itens, valor total, data de emissão). Sobre a hora exata da compra: o campo `dataEmissao` armazena só a **data** (sem hora), o que já é granular o suficiente pra histórico de preços.

### Risco 5 — Multi-tenant em `NotaFiscal`

Se o mesmo `xmlHash` (mesmo arquivo) for importado por 2 usuários diferentes (improvável mas possível — e.g., dois devices sincronizando o mesmo arquivo), o índice `unique(usuario, xmlHash)` permite. Se fosse `unique(xmlHash)` global, o 2º usuário falharia. **Já está garantido no design.**

### Risco 6 — Mercado sem CNPJ no emitente

Improvável mas possível (mercado informal, MEI). **Mitigação:** campo `estabelecimento.cnpj` é opcional. Se ausente, a nota é salva mas sem agrupar por mercado — vira "órfã" na listagem.

### Risco 7 — Casamento fuzzy (Piso 3) ser lento

Levenshtein/Jaccard em runtime contra 1000+ produtos é lento. **Mitigação:** rodar em background (job) e cachear resultado por `xmlHash + dataImportacao`. Não rodar síncrono no parse.

---

## Variáveis de ambiente

Nenhuma nova. O parser usa `xml2js` que já está nas deps. Não precisa chave de API externa.

---

## Compatibilidade com features existentes

- **Não mexe** em `Importacao`, `TransacaoImportada`, `Transacao`, `Instituicao` (Pluggy). Módulo novo, isolado.
- **Multi-tenant:** mesmo padrão (`usuario` em todos os modelos, índices `unique(usuario, ...)`).
- **decimal.js:** usar `new Decimal()` em todos os campos monetários.
- **Frontend:** aproveitar `DataTable` (TanStack), `EmptyState`, `StatCard`, `Card`, `SectionHeader` do design system refatorado. Tema via tokens (`var(--cg-color-*)`).
- **Padrão de upload:** seguir exemplo de `importacao.js:11-52` (multer disk storage, fileFilter, path de upload dedicado).

---

## Out of scope (não fazer)

- ❌ OCR de cupom fiscal em PDF/imagem (NF-e XML é diferente de cupom SAT/MFE)
- ❌ Importação automática de XMLs por email (parsing de anexo de email)
- ❌ Compartilhamento de catálogo entre usuários (multi-tenant estrito)
- ❌ Integração com APIs de mercado (iFood, etc) — não é isso
- ❌ Sincronização de notas entre devices (só local)
- ❌ Mobile app / PWA

---

## Decisões pendentes (pequenas, podem ser resolvidas durante execução)

1. **Nome do menu na sidebar:** "Mercados" ou "Notas Fiscais" ou "Compras"? Sugiro "Mercados" (curto, claro).
2. **Tamanho máximo de upload por XML:** 10 MB igual o resto do projeto, ou 2 MB (NF-e raramente passa de 200 KB)? Sugiro manter 10 MB por consistência.
3. **Política de retenção de XMLs originais:** guardar pra sempre em `uploads/nfe/` (desperdício de disco) ou apagar após parse (não dá pra "reextrair" depois)? Sugiro **manter o XML por 90 dias** (pode precisar pra debug) e depois apagar. Migration opcional futura pode limpar.
4. **Visualização de gráficos:** chart.js (já no stack) ou recharts? Sugiro chart.js pra não adicionar dep.

---

## Próximos passos

1. Alisson revisa este design doc.
2. Se aprovado, eu gero o **plano de execução detalhado só do Marco 1** (vai pra `writing-plans` skill).
3. Executor aplica M1.
4. Alisson usa M1 por ~1-2 semanas com XMLs reais.
5. Sign-off no M1 → eu gero plano do M2.
6. Repetir até M3.

**Por que esse fatiamento:** cada marco é um checkpoint onde você pode dizer "ok, M1 já me deu valor, vou usar uns meses antes de pedir M2" sem ter retrabalho. E se M2/M3 não fizerem sentido depois de usar M1, você para sem ter queimado 1 mês de execução.
