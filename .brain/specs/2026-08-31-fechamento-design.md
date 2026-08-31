---
type: design
status: approved
created: 2026-08-31
approved: 2026-08-31
tags: [fechamento, recebimentos, relatorios, pessoa, sidebar, brainstorm]
related:
  - .brain/decisions/2026-08-11-descontinuacao-conta-conjunta.md
  - .brain/decisions/2026-06-28-breadcrumb-menu-structure-fonte-verdade.md
  - .brain/sessions/2026-06-25-relatorio-reorganizacao-design.md
---

# Design Doc — Módulo "Fechamento"

> Novo módulo que substitui a aba "Insights" (placeholder sem uso) na sidebar. Reúne, numa única
> tela, o acompanhamento do fechamento de várias pessoas por período — transações, valor total,
> status de envio/recebimento e geração/exportação de relatório — hoje espalhado entre as rotas
> `/relatorio`, `/recebimentos` e `/pessoas`.

## 1. Contexto e motivação

Hoje, pra "fechar as contas" de uma pessoa num período, o fluxo é manual e disperso: ir em
`/relatorio`, filtrar por uma pessoa, exportar CSV, repetir pra próxima pessoa, e separadamente
acompanhar em `/recebimentos` se aquele valor já voltou. Não existe registro de "já enviei esse
fechamento" nem de "para qual período isso foi enviado" — cada consulta ao Relatório é stateless.

O objetivo do Fechamento é consolidar: ver o balanço de N pessoas ao mesmo tempo, gerar/exportar o
relatório de cada uma (individual ou em lote), rastrear o status de cada fechamento
(aberto → enviado → aguardando recebimento → recebido), e linkar com o módulo de Recebimentos
(`Settlement`) já existente — sem duplicar nenhum desses motores, só orquestrando o que já existe.

### 1.1 Terreno já decidido (não reaberto aqui)

- **Conta Conjunta foi descontinuada** (ADR-019) — `Transacao.pagamentos[]` é o único mecanismo de
  divisão por pessoa hoje. `pagamentos[].pessoa` é string livre (nome), sem referência a um model.
- **`menuStructure.js`** é a fonte de verdade única da sidebar e do breadcrumb (ADR-017) — qualquer
  rota nova deve entrar por ali.
- **Recebimentos** = módulo `Settlement` (`settlementService.js`): concilia uma transação
  `recebivel` contra N transações `gasto` pendentes, aplicando uma tag. É uma ação pontual de
  conciliação, sem conceito de período ou de "pessoa dona do settlement" — o vínculo com pessoa é
  indireto, via `pagamentos.pessoa` da transação de recebimento.
- **`ModeloRelatorio`** já existe (regras de tag + tipo de agregação `default`/`devedor`), mas é
  **global** por usuário, não por pessoa.
- **Geração de relatório** (`reportEngine`) já devolve `{ rows, summary, filterDetails,
  templateUsed }` a partir de filtros (período, pessoas, tags, template). **Exportação PDF já existe
  e é client-side** (`@react-pdf/renderer`, `utils/export/exportPDF.js` + `components/PDF/*`), assim
  como CSV (`utils/export/exportData.js`). **Não existe exportação em lote/zip.**
- **`Pessoa`** já existe como model (`nome`, `contato`, `observacoes`, `ativo`), hoje usado só na
  tela `/pessoas` (empréstimos). Índice único `usuario+nome`.

## 2. Modelagem de dados

Dois models novos, normalizados (não aninhados), porque a tela principal precisa consultar "todas
as pessoas com uma instância de Fechamento no período X" — um array embutido por pessoa dificultaria
essa query.

### 2.1 `FechamentoCadastro`

O "perfil" — uma vez por pessoa (índice único `usuario+pessoa`).

```js
{
  usuario: ObjectId (ref Usuario, required),
  pessoa: ObjectId (ref Pessoa, required),
  modeloRelatorio: ObjectId (ref ModeloRelatorio, required),
  ativo: Boolean (default: true),
  createdAt, updatedAt
}
```

- `pessoa` referencia o model `Pessoa` — **não** string livre.
- O casamento com `Transacao.pagamentos[].pessoa` (que é string) é feito **em tempo de consulta**,
  por nome, case-insensitive — mesma técnica que `settlementService.listarPendentes` já usa hoje
  (`RegExp('^' + nome + '$', 'i')`). Não há migração de dados: o link é lógico, não gravado
  retroativamente em `Transacao`.
- **Pré-requisito operacional**: para uma pessoa aparecer corretamente no Fechamento, deve existir um
  `Pessoa.nome` que bate exatamente (case-insensitive) com o nome usado em `pagamentos[].pessoa` nas
  transações reais (ex: "Alisson"). Se não houver correspondência, a instância mostra 0
  transações — a UI de criação de cadastro deve alertar/sugerir isso (ver seção 4).

### 2.2 `FechamentoInstancia`

Uma por "rodada" (pessoa + período). Múltiplas por `FechamentoCadastro` ao longo do tempo.

```js
{
  usuario: ObjectId (ref Usuario, required),
  cadastro: ObjectId (ref FechamentoCadastro, required),
  dataInicio: Date (required),
  dataFim: Date (required),
  status: String (enum: ['aberto', 'enviado', 'aguardando_recebimento', 'recebido'], default: 'aberto'),
  settlementId: ObjectId (ref Settlement, default: null),
  observacoes: String (default: null),
  createdAt, updatedAt
}
```

- **Transações e valor total não ficam salvos aqui.** São recalculados ao vivo a cada abertura da
  tela, filtrando `Transacao.pagamentos.pessoa` (nome do `Pessoa` referenciado, via
  `cadastro.pessoa`) dentro de `[dataInicio, dataFim]`. Decisão consciente (ver seção 6): se uma TX
  antiga for editada depois, o fechamento reflete a mudança automaticamente — sem duplicar dado nem
  precisar de tela de "reabrir/recalcular".
- `settlementId` != null implica `status = 'recebido'` **automaticamente** — ao linkar um
  `Settlement`, o service que atualiza a instância seta os dois campos juntos, numa única operação
  atômica (não é o front que decide o status).
- Índice `usuario + cadastro + dataInicio` (não únicos — nada impede períodos sobrepostos por
  decisão do usuário, mas a UI desencoraja isso ao sugerir o próximo período automaticamente).

## 3. Endpoints (backend)

Seguindo o padrão em camadas do projeto (`routes → controllers → services → models`), rota
`/api/fechamento`:

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/fechamento/cadastros` | Lista cadastros ativos (com `pessoa` e `modeloRelatorio` populados) |
| `POST` | `/api/fechamento/cadastros` | Cria cadastro (`pessoa`, `modeloRelatorio`) |
| `GET` | `/api/fechamento/instancias?dataInicio=&dataFim=` | Lista instâncias cujo período tem overlap com o filtro, com resumo (total, nº de TXs) calculado ao vivo por agregação |
| `POST` | `/api/fechamento/instancias` | Cria instância (`cadastro`, `dataInicio`, `dataFim`) — se `cadastro` não existir, aceita criar em conjunto (`pessoa` + `modeloRelatorio` no mesmo payload) |
| `POST` | `/api/fechamento/instancias/:id/duplicar` | Clona a instância avançando o período em ~1 mês (`dataInicio = dataFim anterior + 1 dia`, `dataFim` = mesmo dia do mês seguinte), status volta a `aberto` |
| `GET` | `/api/fechamento/instancias/:id/transacoes` | Lista as transações da pessoa no período daquela instância (reaproveita a lógica de match por nome do `settlementService`/`reportEngine`) |
| `PATCH` | `/api/fechamento/instancias/:id/status` | Atualiza status manualmente (`aberto` ↔ `enviado` ↔ `aguardando_recebimento`) — **não aceita** setar `recebido` diretamente (só via link de settlement) |
| `POST` | `/api/fechamento/instancias/:id/linkar-recebimento` | Recebe `settlementId`; valida que o settlement pertence ao usuário e que seu `receivingTransactionId.pagamentos` contém o nome da pessoa; grava `settlementId` + `status: 'recebido'` |
| `DELETE` | `/api/fechamento/instancias/:id` | Remove o registro de acompanhamento (não mexe em `Transacao`/`Settlement`) |

## 4. Frontend

### 4.1 Tela principal `/fechamento`

Ver mockup validado: [artifact "Tela de Fechamento"](https://claude.ai/code/artifact/4492dfdd-c11f-4c2e-beea-b07adb0bc03c).

- **Filtro global de período** no topo (reaproveita `PeriodQuickFilter`), controla quais instâncias
  aparecem na grade (overlap de `[dataInicio, dataFim]` da instância com o filtro).
- **Barra de resumo** (4 stat cards): instâncias no período, total a receber, já recebido,
  aguardando.
- **Barra de seleção em lote**: checkbox "selecionar todos" + botão "Exportar selecionados (.zip)".
- **Grade de cards** (`grid-template-columns: repeat(auto-fit, minmax(400px, 1fr))`), um por
  instância:
  - Avatar (iniciais, cor determinística por pessoa), nome, período, modelo de relatório
  - Pílula de status + stepper visual (Aberto → Enviado → Aguardando → Recebido)
  - Total + nº de transações
  - Colapsado: mini-prévia das top transações. **Expandido (accordion inline, sem navegação)**:
    tabela completa de transações + box de link de recebimento (vazio com botão "Linkar", ou
    preenchido com o ID do settlement)
  - Ações: Ver detalhe/Recolher, Gerar PDF
  - **Múltiplos cards podem estar expandidos ao mesmo tempo** — não é um accordion exclusivo
- **Ghost card tracejado** no fim da grade: "+ Nova instância neste período"

### 4.2 Criar nova instância

Modal/fluxo:
1. Escolher **Pessoa** (dropdown busca em `Pessoa`).
2. Se a pessoa já tem `FechamentoCadastro`: reaproveita (mostra modelo de relatório padrão,
   editável pontualmente nesta instância). Se não tem: pede o **Modelo de Relatório** e cria o
   cadastro inline, no mesmo submit.
3. Período: sugestão automática de "próximo mês" se já existir instância anterior para essa pessoa
   (`dataFim` anterior + 1 dia até o mesmo dia do mês seguinte); mês atual se for a primeira. Editável.
4. Se o nome da `Pessoa` escolhida não bate com nenhum `pagamentos[].pessoa` existente no banco
   (0 transações encontradas ao pré-visualizar), a UI avisa antes de confirmar — não bloqueia, só
   alerta (pode ser proposital, ex: pessoa nova sem histórico ainda).
5. Cria a instância com status `aberto`.

**Atalho "Duplicar para o próximo período"** em cada card — chama
`POST /instancias/:id/duplicar`, cobre o caso comum de recorrência mensal sem repassar o formulário
inteiro.

### 4.3 Exportação — individual e em lote

- **Individual**: reaproveita `exportDataToPDF()` (`utils/export/exportPDF.js`) alimentando
  `ReportDocument` com as transações/resumo da instância. Nenhuma mudança no motor de PDF.
- **Em lote** (botão "Exportar selecionados (.zip)"):
  1. Para cada instância selecionada, gera o Blob do PDF em memória (mesma função, sem disparar
     download individual).
  2. Empacota os Blobs num `.zip` com **`jszip`** (dependência nova — MIT, ~95KB, sem
     dependências, 100% client-side). **Requer aprovação explícita do usuário antes de instalar.**
  3. Nome de cada arquivo: `{pessoa-sanitizada}-{periodo}.pdf` (reaproveita `sanitize()` de
     `exportPDF.js`); zip final: `fechamentos-{periodo}.zip`.

### 4.4 Linkar Recebimento

No accordion expandido, botão "Linkar Recebimento" abre um seletor listando `Settlement`s cujo
`receivingTransactionId.pagamentos` contém o nome da pessoa da instância (mesmo casamento por nome
do `settlementService`), ordenado por proximidade de data com o período da instância. Ao escolher,
chama `POST /instancias/:id/linkar-recebimento` — grava `settlementId` e muda status para
`recebido` automaticamente (decisão validada, seção 2.2).

**Não cria um `Settlement` novo por aqui** — o Fechamento só linka um settlement já criado pelo
fluxo existente em `/recebimentos/novo`. Não substitui esse fluxo.

### 4.5 Sidebar / rotas

- `menuStructure.js`: troca a entrada `{ name: 'Insights', path: '/insights', icon: LightbulbIcon }`
  por `{ name: 'Fechamento', path: '/fechamento', icon: AssignmentTurnedInIcon }` (ícone de
  MUI — remete a "conferência/confirmação concluída", coerente com o stepper de status do módulo),
  dentro da seção "Relatórios & Insights" (renomear a seção pode ser considerado, mas fora de escopo
  desta rodada).
- `pages/Insights/Insights.js` e `Insights.css` são apagados (stub sem uso real, confirmado ao ler
  o código — só renderiza um `PageHeader` com "em desenvolvimento").
- Rota única `/fechamento` — **sem** rota de detalhe separada (`/fechamento/:id`). O accordion
  inline já cobre "ver detalhe" sem navegação, conforme validado no mockup.

## 5. Dark mode / tema

Segue os tokens existentes (`var(--cg-color-*)`), sem cor hardcoded — validado visualmente no
mockup (`.brain` não precisa repetir os ADRs 006-012 aqui, ver `AGENTS.md` raiz). Pílulas de status
usam os tokens semânticos existentes (`--cg-color-info-bg`, `--cg-color-warning-bg`,
`--cg-color-success-bg`) já usados em outras telas.

## 6. Decisões consolidadas deste brainstorm

| Tema | Decisão | Razão |
|---|---|---|
| Pessoa: referência ou string livre | Referência a `Pessoa` (ObjectId), casada por nome (case-insensitive) com `pagamentos[].pessoa` em tempo de consulta | Ganha contato/observações prontos (útil pro WhatsApp futuro) sem exigir migração — o link é lógico |
| Escopo do cadastro | Dois models: `FechamentoCadastro` (perfil por pessoa) + `FechamentoInstancia` (N por período) | A tela precisa consultar "todas as pessoas num período X" — normalizado é mais direto que aninhado |
| Transações/valor: live ou snapshot | **Ao vivo**, sempre recalculado | Mais simples, sem duplicar dado; reflete edições/estornos de transações automaticamente |
| Status | 4 estados: Aberto → Enviado → Aguardando Recebimento → Recebido | Cobre o fluxo real descrito (organização → envio → espera → confirmação) |
| Auto-status ao linkar Settlement | Automático — linkar já marca `recebido` | Evita esquecer de atualizar status manualmente depois de já ter linkado |
| Estrutura da tela | Filtro global de período seleciona o recorte, mostra todas as pessoas daquele período lado a lado | Bate com o objetivo central: visão consolidada mês a mês, sem trocar de pessoa em pessoa |
| Exportação em lote | PDF em lote via zip, reaproveitando o motor de PDF já existente (`@react-pdf/renderer`) — só o empacotamento em zip é novo (`jszip`) | Motor de PDF já resolvido; zip é a única lacuna real |
| Rota de detalhe | Accordion inline, sem rota `/fechamento/:id` separada | Validado no mockup — permite ver múltiplas pessoas expandidas ao mesmo tempo, sem navegação |

## 7. Não-objetivos (fora desta rodada)

- **Envio via WhatsApp**: registrado aqui como evolução futura. O campo `Pessoa.contato` já existe e
  serve de base quando essa funcionalidade for implementada — **não** implementar agora.
- Geração de PDF do zero: **não necessária** — reaproveita `@react-pdf/renderer` já em uso.
- Exportação para Excel/xlsx: `exportDataToExcel()` já existe como stub comentado em
  `exportData.js` — fora de escopo, não mexer.
- Migração de dados históricos de `pagamentos[].pessoa` para vincular a um `Pessoa` — o casamento é
  sempre por nome, em tempo de consulta, nunca gravado.
- Renomear a seção "Relatórios & Insights" da sidebar — mantém o nome, só troca o item.

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Nome da `Pessoa` não bate com `pagamentos[].pessoa` (typo, apelido diferente) | UI avisa (não bloqueia) quando 0 transações são encontradas ao criar/abrir uma instância |
| Overlap de períodos entre instâncias da mesma pessoa gerando contagem duplicada na tela | Não é uma restrição de schema (usuário pode ter motivo legítimo), mas a sugestão automática de período evita o caso comum acidental |
| Cálculo "ao vivo" ficar lento com muitas instâncias na tela ao mesmo tempo | Endpoint de listagem faz 1 agregação para todas as instâncias visíveis, não N chamadas — mesma lógica de paginação/agregação que `Relatório` já usa |
| `jszip` ser dependência nova | Pequena, MIT, sem dependências transitivas — pedir aprovação explícita antes de instalar, conforme regra do projeto |

## 9. Referências

- Mockup validado: `fechamento-mockup.html` (artifact publicado, ver seção 4.1)
- `settlementService.js` — técnica de casamento por nome (`pagamentos.pessoa`) reaproveitada
- `reportEngine/index.js` — motor de geração de relatório reaproveitado sem alterações
- `utils/export/exportPDF.js`, `components/PDF/*` — motor de PDF reaproveitado sem alterações
- ADR-019 (descontinuação Conta Conjunta), ADR-017 (menuStructure fonte de verdade)
