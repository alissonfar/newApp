---
type: session
status: superseded
created: 2026-06-21
superseded: 2026-06-21
tags: [emprestimos, diagnostico, modulo, regra]
---

# Sessão: Diagnóstico do Módulo de Empréstimos

> **STATUS (2026-06-21):** Esta sessão foi **superseded** por `2026-06-21-emprestimos-design.md` (design doc consolidado que serviu de brief para o `newapp-executor`). A implementação foi concluída em 2026-06-21. O conteúdo aqui permanece como referência histórica do processo de elicitação.

## Objetivo

Alisson reportou que o módulo de **empréstimos** "não está se comportando como esperado", sem conseguir apontar comportamentos problemáticos específicos. O pedido foi: investigar, comparar com o que deveria ser, e refatorar para refletir a realidade.

> **Importante:** esta sessão é **apenas diagnóstico (FASE 1 + FASE 2)**. Nenhuma mudança de código foi proposta ou aplicada. Decisão explícita do Alisson: **construir o plano a partir dos achados do diagnóstico**, validando juntos o que deveria ser cada regra.

## Decisões tomadas nesta sessão

1. **Cancelar empréstimo:** deve **pedir confirmação por transação vinculada**. Hoje, o backend apenas muda o status para `cancelado` e as TXs vinculadas **permanecem ativas** (órfãs de propósito).
2. **Plano aprovado:** sendo construído a partir do diagnóstico. As regras aprovadas vão sendo registradas na matriz bloco a bloco.

### Regras aprovadas (preenchimento da matriz)

#### Decisões das 3 pendências (2026-06-21)

| Pendência | Decisão | Impacto |
|-----------|---------|---------|
| **1. TIs de importação → Empréstimo** | MANTER | Caminho de revisão em massa continua existindo. Sem mudança. |
| **2. UIs novas do Bloco 6** | REMOVER 3 de 4 | Bloco 6 agora é majoritariamente "manter" ou "corrigir". Quitação manual, reativação e UI de recebimento no detalhe saem. Sobra: edição de `emprestimoId` em TX (verificar) + breadcrumb. |
| **3. `emailVerificado` no middleware** | NÃO TOCAR | Escopo amplo, foge desta tarefa. Tratar em refactor futuro. |

#### Bloco 1 — Cálculo de juros e geração de lucro (linhas 1, 2, 3, 26)

> **ATUALIZAÇÃO PÓS-REVISAO DE QUITAÇÃO (2026-06-21):** Alisson revisitou o modelo e decidiu **simplificar o cálculo de lucro** (sem FIFO, sem split). Esta versão substitui a decisão anterior de manter o motor FIFO.

- **Regra aprovada para o tipo de retorno:** **remover** `taxaJurosPercentual`, `valorJurosFixo` e os `tipoRetorno` `juros_percentual` e `juros_fixo` do schema. Manter apenas `valor_fixo` (usuário declara valor final esperado) e `sem_juros` (valor esperado = total desembolsado).
- **Cálculo de lucro aprovado (2026-06-21):** `lucro = soma_recebíveis - soma_gastos`. **Sem FIFO, sem split por TX**. Mais simples e mais alinhado com o modelo mental do Alisson.
- **Consequência direta:** o motor FIFO em `emprestimoAjuste.js` (split principal/juros por TX) é **removido**. A TX de juros auto (em `emprestimoQuitacao.js`) **permanece** mas é simplificada: na quitação, o sistema gera uma TX de `recebivel` com `valor = soma_recebíveis - soma_gastos` (lucro realizado), marcada com `emprestimoEhJurosAuto: true`.
- **Consequência sobre `direcao: 'recebido'`:** removida (Bloco 2). Ajustes de relatórios (`emprestimoAjuste.calcularAjusteResumoPorEmprestimo`) **removidos junto** com o FIFO.
- **Consequência para dados existentes:** se houver empréstimos salvos com `tipoRetorno: 'juros_percentual'` ou `'juros_fixo'`, a migração precisa **normalizar** esses docs para um dos dois tipos restantes (decisão: `'valor_fixo'` preservando o `valorEsperadoRetorno` já declarado).
- **Consequência sobre recebimentos parciais:** o modelo simplificado **assume que existe 1 recebível de quitação** (não múltiplos parciais). Se o usuário receber em partes, o sistema **permite** vincular cada parte como recebível normal, mas a TX de juros auto só é gerada **quando `totalRecebido >= valorEsperado`** (mesma regra de hoje). Cobre o caso de uso do Alisson sem complicar.

#### Bloco 2 — Estados de status (linhas 4, 5, 6, 19)

> **ATUALIZAÇÃO PÓS-REVISAO DE QUITAÇÃO (2026-06-21):** complemento de empréstimo agora **cresce `valorEsperadoRetorno` no mesmo Empréstimo**. Auto-reversão `quitado → ativo` na edição deixa de existir.

- **Quitado:** mantém-se **automático** via `totalRecebido >= valorEsperado`. Geração de TX de juros auto com `valor = soma_recebíveis - soma_gastos` (lucro realizado).
- **Direção:** **remover** `direcao: 'recebido'` do schema. Alisson: "Direção é uma complicação desnecessária — eu nunca vou PEGAR dinheiro emprestado e registrar no módulo, não faz sentido para o propósito da aplicação — a direção é sempre uma só, é sempre EU emprestando." A direção passa a ser implícita (`'concedido'`) e deixa de ser um campo do schema. **Consequência:** remove a `direcao` do payload em todos os endpoints e formulários.
- **Cancelamento:** pede confirmação por TX. **A decidir:** o que perguntar exatamente. (próximo bloco)
- **Complemento de empréstimo (decisão 2026-06-21):** quando o usuário quer emprestar mais dinheiro para a mesma combinação (mesma pessoa, mesmo acordo), ele **altera `valorEsperadoRetorno` no mesmo Empréstimo** (soma do valor anterior + valor do complemento). Permite edição de `valorEsperadoRetorno` mesmo com TXs ativas. Quebra a regra atual de "travar valor esperado se há TXs".
- **Auto-reversão `quitado → ativo` na edição:** **removida**. Como o `valorEsperadoRetorno` agora cresce com complementos, a reversão automática deixa de fazer sentido. O usuário é responsável por gerenciar o status do empréstimo.
- **Edição de empréstimo:** mantém capacidade de editar `valorEsperadoRetorno`, `prazoFinal`, `observacao`, `tipoRetorno` com TXs ativas. `pessoaId` continua travado (regra atual mantida). `direcao` removida do schema.

#### Bloco 3 — Precisão monetária (linha 7)

- **Decisão:** **NÃO migrar** para `decimal.js` no módulo de empréstimos. Mantém `Number` puro em todo o módulo (backend e frontend).
- **Justificativa:** o briefing diz "Não adicione novas funcionalidades. Não proponha melhorias não previstas. Não expanda escopo." Migrar para `decimal.js` é uma melhoria não prevista — embora coerente com o AGENTS.md, não é o que o usuário pediu. Decisão consciente: o módulo opera com `Number` e o risco de 1 centavo é aceito.
- **Consequência:** a regra "NUNCA float nativo pra dinheiro" do AGENTS.md **permanece violada neste módulo**. Vale documentar como exceção consciente (futuro ADR?).

#### Bloco 4 — Validações e vinculação de TX (linhas 8, 9, 10, 11, 21)

- **(8) Vincular TX a empréstimo cancelado:** **manter rejeição**. `validarEmprestimoParaTransacao` continua lançando erro se o empréstimo está cancelado.
- **(9) Estorno de TX reverter quitação:** **manter**. `recalcularStatus` é chamado após estorno e reverte `quitado → ativo` se o cálculo deixar de bater, deletando a TX de juros auto.
- **(10) Reativação de TX estornada poder re-quitar:** **manter**. Comportamento simétrico ao (9).
- **(11) Parcelamento com mesmo `emprestimoId` em todas as parcelas:** **manter**. Limitação conhecida (sem multi-empréstimo em um parcelamento). Documentar como limitação, não como bug.
- **(21) Validação cruzada `tipoRetorno` ↔ `taxaJurosPercentual`/`valorJurosFixo`:** **irrelevante**. Os campos `taxaJurosPercentual` e `valorJurosFixo` serão removidos no Bloco 1, então a validação cruzada deixa de existir.

#### Bloco 5 — Importação e Pluggy (linhas 12, 13, 14)

- **Princípio arquitetural registrado (Alisson, 2026-06-21):** "Um empréstimo vai **sempre** se originar a partir de uma transação." Tradução prática: **não pode haver criação de Empréstimo sem ter a Transação vinculada**. O fluxo é: o usuário cria uma transação (gasto, no caso de desembolso, ou recebível, no caso de recebimento) e, **naquele momento**, marca que essa transação é parte de um empréstimo — seja criando um novo ou vinculando a um existente.
- **Decisão de modelo:** **manter Empréstimo como entidade independente** (com `_id` próprio). **NÃO** refazer o modelo como flag na Transacao. A mudança é **na UX**, não no modelo de dados.
- **Consequência direta:** o modal "+ Novo Empréstimo" em `EmprestimosPage` (que permite criar empréstimo sem TX) **deve ser removido**. Empréstimo só nasce via:
  1. `EmprestimoSecao` no formulário de transação manual (Home/Relatório/criação de TX), **OU**
  2. Marcação em `EditarTransacaoItem` no fluxo de revisão de TIs (importação CSV/OFX/Pluggy).
- **Consequência na quitação:** Alisson: "a quitação ocorre da mesma forma, somente com eu ditando que uma transação é o recebimento de algum empréstimo (isso já existe mas não funciona direito — ou existe parcialmente)". O caminho de "registrar recebimento" via `EmprestimoSecao` **já existe** e é o caminho oficial. Sem mudança conceitual aqui, mas vale garantir que funcione direito (alinhado com o ponto 4.1 da fricção).
- **(12) Agrupamento por chave natural em `criarEmprestimosParaImportacao`:** **manter**. Funciona.
- **(13) Estorno de importação recalcula status:** **manter**. Funciona.
- **(14) Pluggy não marca `emprestimoConfig` automaticamente:** **manter como está**. Alisson deixou claro: "o módulo da Pluggy não tem NADA HAVER com o que estamos alterando. Tudo que envolve pluggy é relacionado a parte de saldos automáticos e informativos (módulos de contas e subcontas). O módulo de transações é uma parte OPERACIONAL." Logo, o caminho de TIs-Pluggy → Empréstimo (via marcação manual em `DetalhesImportacaoPage`) **continua existindo** tecnicamente, mas conceitualmente é responsabilidade do usuário decidir caso a caso. Nenhuma mudança aqui.
- **Princípio de separação de responsabilidades (Alisson):**
  - **Pluggy** = espelho automático de saldos/contas. Não decide nada sobre a natureza das transações.
  - **Módulo de Transações (operacional)** = onde o usuário dita a natureza de cada transação, incluindo "isso é um empréstimo".
  - **Módulo de Empréstimos** = view e gestão dos Empréstimos (lista, detalhe, edição, cancelamento), mas **só pode ser povoado via Transação**.

#### Bloco 6 — UI e UX (linhas 15, 16, 17, 18, 20, 32)

> **ATUALIZAÇÃO PÓS-PENDÊNCIA 2 (2026-06-21):** Alisson revisou as 4 UIs novas e removeu 3, alinhando com o briefing original ("Não adicione novas funcionalidades"). Bloco 6 agora é predominantemente "manter" ou "corrigir inconsistência".

- **(15) Filtros extras na lista de Empréstimos (pessoa, faixa de valor, busca textual):** **manter como está**. Sem mudança nesta rodada. Rodada futura.
- **(16) UI de registro de recebimento dentro do detalhe do Empréstimo:** **REMOVER**. Usuário abre form de TX normal, marca "parte de empréstimo" na aba Avançado, vincula. Mais cliques mas zero UI nova.
- **(17) Quitação manual (botão "Quitar"):** **REMOVER**. Sistema quita sozinho quando `totalRecebido >= valorEsperado`. Sem UI manual.
- **(18) Reativação de empréstimo cancelado (botão "Reativar"):** **REMOVER**. Cancelamento é definitivo. Usuário que errou recria o Empréstimo.
- **(20) Edição de `emprestimoId` em uma Transação após criação:** **MANTER, mas só no form de TX** (sem UI nova dedicada). Usuário entra em modo de edição da TX, vai na aba "Avançado", pode mudar/limpar o `emprestimoId`. **Hoje isso já é parcialmente possível** via `EmprestimoSecao` no form de TX, então a "mudança" é garantir que o `setEmprestimoId(null)` (desvincular) funcione corretamente. Verificar.
- **(32) Breadcrumb dinâmico do detalhe:** **corrigir**. `EmprestimoDetalhePage` deve chamar `useBreadcrumbOverride` para usar o `pessoaNomeSnapshot` no lugar de "Detalhes do Empréstimo" hardcoded.

#### Bloco 7 — Inconsistências de frontend (linhas 27, 28, 29, 30, 31, 33)

- **Decisão:** **resolver todas** as 6 inconsistências.
- **(27) Defaults de `tipoRetorno` diferentes entre `EmprestimoForm` (`sem_juros`) e `useEmprestimoForm` (`valor_fixo`):** **unificar**. Padrão único: `valor_fixo` (que é o caminho primário decidido no Bloco 1).
- **(28) `EmprestimoBadge` só renderiza para `tipo === 'recebimento'`:** **corrigir**. Renderizar também para `tipo === 'desembolso'`. Visual: 🏦 para desembolso, 🏦+ para recebimento (ou variantes equivalentes que diferenciem semanticamente).
- **(29) `EmprestimoForm` (modal) não envia `direcao` no payload:** **tornar irrelevante**. Após o Bloco 2, `direcao` deixa de ser campo do schema. Remove do payload em todos os pontos.
- **(30) `useTransacaoForm.emprestimoId` é código morto:** **remover**. Nem o `formState.emprestimoId` nem o `payload.emprestimoId` são exercitados; o controle real está em `useEmprestimoForm` consumido por `NovaTransacaoForm`.
- **(31) `listarPessoas` com flag `incluirInativas` diferente em `useEmprestimoForm` (`true`) e `EmprestimoForm` (sem flag):** **unificar**. Padrão único: `incluirInativas=true` (não faz sentido esconder pessoas que têm empréstimos ativos).
- **(33) `api.js` (fetch) sem tratamento de 401:** **adicionar**. Espelhar o comportamento do axios: redirecionar para `/login` (ou `redirectUrl` do backend) em 401. Aplica-se a todas as funções de `api.js`, não só às de empréstimo.

#### Bloco 8 — Infraestrutura (linhas 22, 23, 25)

- **Decisão:** **resolver tudo**.
- **(22) Migração 006 não documentada no `backend/scripts/migrations/README.md`:** **atualizar**. Incluir 004, 005, 006 no README, com descrição de uma linha cada.
- **(23) `listarPorPessoa` (rota morta exportada em `emprestimoController.js:291-324`, não roteada):** **remover**. Código morto gera confusão e footprint de manutenção.
- **(25) `emailVerificado` não validado pelo middleware `autenticacao`:** **NÃO TOCAR**. Alisson decidiu (Pendência 3, 2026-06-21): validação de `emailVerificado` é escopo amplo (afetaria todas as rotas, não só Empréstimo) e foge do escopo desta tarefa. O briefing diz "Não expanda escopo". Decisão consciente: Empréstimo não vai exigir `emailVerificado` no controller, alinhado com o resto do backend hoje. Tratar em refactor futuro dedicado.

## Estado atual do módulo (resumo executivo)

### O que existe

- **4 tipos de retorno no schema:** `valor_fixo`, `juros_percentual`, `juros_fixo`, `sem_juros`. Na prática, **o cálculo de juros é o mesmo para todos** — algoritmo FIFO que divide cada recebimento entre "principal devolvido" e "juros". Os campos `taxaJurosPercentual` e `valorJurosFixo` são **persistidos mas não calculam nada**.
- **2 direções:** `concedido` (eu emprestei) e `recebido` (eu peguei emprestado). A `direcao: 'recebido'` é aceita no schema/service mas o ajuste de relatórios (`emprestimoAjuste`) **só opera em `concedido`**. Funcionalidade assimétrica.
- **3 status:** `ativo`, `quitado`, `cancelado`. Transição `ativo → quitado` é **automática** quando `totalRecebido >= valorEsperado` (via `recalcularStatus`). Cancelamento é **manual** e não estorna TXs.
- **6 endpoints REST** + 1 rota morta (`listarPorPessoa` definida mas não roteada).
- **3 arquivos de teste Jest** com cobertura razoável das regras centrais (305 + 230 + 207 linhas).
- **1 página de lista** (`/emprestimos`), **1 página de detalhe** (`/emprestimos/:id`), **1 modal de criação standalone**, **1 seção embutida no formulário de transação** (`EmprestimoSecao`).
- **1 transação auto-gerada de "juros"** que funciona como "única receita real" do empréstimo nos relatórios — criada na quitação, deletada se a quitação for revertida.

### Como o cálculo funciona na prática (FIFO)

```
Ordena TXs vinculadas por data ASC.
Para cada gasto (desembolso): soma em "desembolsado", ZERA o valor na listagem de relatórios.
Para cada recebível (não auto): "principal = min(recebimento, restante de principal); juros = recebimento - principal".
Soma de "juros" vai pra uma transação-extra com flag `emprestimoEhJurosAuto: true`, criada no momento da quitação.
```

Exemplo do caso de uso do briefing (João, R$100 → R$200):
- Cria empréstimo: `valorEsperadoRetorno: 200`, `tipoRetorno: 'valor_fixo'`.
- Cria gasto de R$100 vinculado (`emprestimoId`).
- Cria recebimento de R$150 vinculado.
- Status ainda `ativo`. `totalRecebido = 150 < 200`. Lucro calculado = 150 - 100 = 50.
- Cria segundo recebimento de R$50 vinculado.
- Backend recalcula: `totalRecebido = 200 >= 200` → transição para `quitado`. `totalJuros = 0` (FIFO: 100 de principal, 100 de principal de novo). **Nenhuma TX de juros auto é criada**, porque o que voltou foi igual ao que saiu.
- Se em vez de R$50 o João pagasse R$100 (total recebido = R$250), o FIFO calcularia: principal devolvido = 100, juros = 150. **Aí sim** seria criada uma TX de "Juros - João" no valor de R$150.

> **Achado central #1:** o nome "valor_fixo" sugere "o valor final que espero", mas a UX e o help-text confundem com "valor do empréstimo" — gerando a percepção de que o lucro deveria ser gerado por uma taxa. Não é. O lucro é subproduto do FIFO.

## Pontos de fricção identificados (agrupados por tema)

### 1. Regras de negócio ambíguas ou frágeis

- **1.1** Os campos `taxaJurosPercentual` e `valorJurosFixo` **não são usados no cálculo**. Persistidos, exibidos, mas ignorados. AMBÍGUO se é intencional (preparação para versão futura) ou débito técnico.
- **1.2** `tipoRetorno: 'sem_juros'` é o default em `EmprestimoForm.js` mas o default em `useEmprestimoForm.js` é `'valor_fixo'`. Dois pontos de entrada com defaults diferentes.
- **1.3** `direcao: 'recebido'` (eu peguei emprestado) é aceita pelo schema e validada pelo service, mas o ajuste de relatórios é silenciosamente ignorado (só `concedido` passa pelo `emprestimoAjuste`). Empréstimos "recebidos" não aparecem corretamente nos relatórios.
- **1.4** Cancelar empréstimo **não estorna as TXs vinculadas**. TXs órfãs com `emprestimoId` apontando para um empréstimo cancelado continuam aparecendo na listagem, com `_emprestimoEsconderNaLista: true` e ajustes aplicados. Decisão sua: vai pedir confirmação por TX.

### 2. Cálculos monetários sem `decimal.js`

O projeto **tem `decimal.js` instalado e em uso** (ex: `useSimulacao.js`, `vinculoService.js`, `taxaCDIService.js`), mas **o módulo de empréstimos não usa**. Toda a aritmética é `Number` + `parseFloat` + `toFixed(2)` + `Math.round`.

Locais identificados:
- `emprestimoService.calcularTotais` — soma `valor` diretamente
- `emprestimoService.calcularTotalJuros` — soma `juros` de cada recebível
- `emprestimoAjuste.calcularAjusteResumoPorEmprestimo` — soma gastos/recebíveis para o `summary` de relatórios
- `emprestimoController.listar` — `Math.max(0, valorEsperado - totalReceived)`, `totalReceived - totalDisbursed`
- `emprestimoQuitacao.montarObservacao` — `Math.max(0, totalReceb - totalJuros)` para o principal devolvido exibido na observação
- `emprestimoService.recalcularStatus` — comparação `totalReceived >= valorEsperado` em `Number` (com arredondamento aplicado **apenas** na TX de juros auto, não no totalReceived)
- Frontend: `EmprestimosPage.totais` (soma agregada de lucro), `EmprestimoDetalhePage` rodapé da tabela de movimentações, `useEmprestimoForm.avisoEmprestimoSemDesembolso` (comparação), `EmprestimoForm.validar` (`parseFloat` direto), `NovaTransacaoForm` submit, `EditarTransacaoItem` submit

Risco real: diferença de 1 centavo na detecção de quitação em valores altos ou após muitos estornos/reativações. Não é bug observável no dia-a-dia, mas é fragilidade.

### 3. Inconsistências de UX/UI

- **3.1** `EmprestimoBadge` (usado em Home e Relatório) só renderiza para `emprestimoInfo.tipo === 'recebimento'`. Desembolsos vinculados a empréstimo **não mostram badge** na listagem.
- **3.2** `DetalhesImportacaoPage` tem **outro componente de badge** (`renderEmprestimoBadge`) independente, com lógica visual diferente. Três visuais diferentes para três estados.
- **3.3** Label de `valor_fixo` aparece com 3 textos diferentes: "Valor fixo" (resumo), "Valor fixo (sem juros)" (inline), "Valor fixo (juros embutidos no esperado)" (standalone). Inconsistência de copy.
- **3.4** Default de `listarPessoas`: `useEmprestimoForm` passa `incluirInativas=true`, `EmprestimoForm` não passa nada. Resultado: criação standalone não lista inativas, criação inline lista.
- **3.5** `EmprestimoForm` no `EmprestimosPage` (modal) não envia `direcao` no payload (deixa o default `'concedido'`). `NovaTransacaoForm` envia `direcao` ao criar inline. Inconsistência silenciosa.
- **3.6** Breadcrumb do detalhe está hardcoded para "Detalhes do Empréstimo" (`breadcrumbConfig.js:29`). A `EmprestimoDetalhePage` não chama `useBreadcrumbOverride` para usar o nome da pessoa.
- **3.7** `useTransacaoForm` mantém `emprestimoId` no `formState` e o coloca no `payload`, mas **ninguém consome** — `NovaTransacaoForm` monta o payload manualmente e lê de `useEmprestimoForm`. Código morto/duplicado.

### 4. Funcionalidades ausentes vs. expectativa do usuário

- **4.1** **Sem UI para registrar recebimento dentro do detalhe do empréstimo.** O usuário precisa abrir o formulário de nova transação em outro lugar, marcar a aba "Avançado", selecionar pessoa, vincular. Fluxo longo e indireto.
- **4.2** **Sem botão "Quitar manualmente".** A quitação é totalmente dependente do cálculo automático. Se o backend atrasar ou divergir, o usuário não tem ação direta.
- **4.3** **Sem reativação de empréstimo cancelado.** Frontend trata como definitivo; backend idem.
- **4.4** **Sem edição de `emprestimoId` em transação após criação.** Só dá para mudar entrando no modo de edição completo da transação.
- **4.5** **Sem filtro por pessoa, prazo, faixa de valor, ou busca textual** na lista de empréstimos.
- **4.6** **Sem paginação/ordenação** na lista de empréstimos nem na tabela de movimentações.
- **4.7** **Sem tratamento de 401** nas chamadas de empréstimo/pessoa (vão por `fetch` puro em `api.js`); só as chamadas axios em `importacaoService` têm redirect automático.

### 5. Integrações

- **5.1** `addContabilizavelCondition` em `transacaoContabilizavel.js` é aplicado **antes** do `emprestimoAjuste`. Filtros contabilizáveis (ex: `settlementAsSource`) podem excluir TXs da query principal enquanto o ajuste de empréstimo ainda é aplicado. AMBÍGUO: pode gerar inconsistência no `summary` quando a TX foi excluída contabilmente mas conta para o empréstimo.
- **5.2** `transacaoContabilizavel` **não filtra por empréstimo**. Empréstimo é aplicado depois, o que é correto. Mas o filtro contabilizável é aplicado a TXs com `emprestimoId` também, o que pode não ser o desejado.
- **5.3** `GET /api/transacoes` (paginado) tem comportamento diferente do `GET /api/transacoes` (sem paginação): o paginado **não zera o valor** dos recebíveis (linha 248 do `controladorTransacao` faz lookup que restaura o valor cheio). Summary é ajustado, mas lista não. Provavelmente intencional ("cards de recebíveis mostram valor cheio"), mas é frágil.
- **5.4** `Pluggy` não tem integração específica com Empréstimo. O fluxo `previewPluggy` → `criarDaPluggy` → TIs **não** marca automaticamente `emprestimoConfig.criarEmprestimo` nas TIs. O usuário precisa marcar manualmente.
- **5.5** `importacaoService.atualizarTransacao` permite editar `emprestimoId` e `emprestimoConfig` na TransacaoImportada. Frontend (`EditarTransacaoItem`) devolve `emprestimoConfig` em vez de criar empréstimo direto.

### 6. Multi-tenant e Auth

- **6.1** Multi-tenant: **adequado**. Toda query filtra por `usuario: req.userId`.
- **6.2** JWT: validado em todas as rotas de empréstimo.
- **6.3** **`emailVerificado` NÃO é validado** pelo middleware `autenticacao` (apenas JWT). AGENTS.md diz que rotas protegidas exigem emailVerificado, mas o código efetivo não impõe. Discrepância conhecida.

### 7. Migrações e infraestrutura

- **7.1** `migration 006-emprestimo-transacao-importada.js` existe, é idempotente, mas **não está documentada** no `backend/scripts/migrations/README.md` (que lista apenas 001/002/003).
- **7.2** `listarPorPessoa` é dead code (exportado em `emprestimoController.js:291-324`, não roteado).
- **7.3** `dataQuitacao` é setado como `new Date()` no momento da transição. Se o empréstimo já estava `quitado` e o cálculo mudou (CASO 3 do `recalcularStatus`), o `dataQuitacao` permanece o original. Pode causar confusão se uma re-quitação acontece depois de um estorno.
- **7.4** Se o usuário quita o empréstimo mas o **último recebimento foi estornado** depois, a TX de juros auto **não é recriada** quando o `recalcularStatus` é re-chamado. Ela foi deletada no momento do estorno. Comportamento provavelmente correto, mas vale validar.

### 8. Testes

- **8.1** Cobertura boa nas regras centrais (service, FIFO, upsert/delete de juros auto).
- **8.2** **Sem testes** para o `emprestimoController` (HTTP) nem para o `importacaoController` (fluxo de criação de empréstimo via importação).
- **8.3** **Zero testes frontend** para o módulo.

## Matriz final (regra atual × regra aprovada)

> **Esta é a matriz consolidada após elicitação bloco a bloco com Alisson (2026-06-21).** Atualizada após revisão do modelo de quitação (sem FIFO, com complemento no mesmo Empréstimo). As colunas "Regra aprovada" e "Mudança necessária" estão preenchidas com as decisões dos Blocos 1 a 8 (acima).

| # | Tema | Como funciona hoje | Regra aprovada | Mudança necessária |
|---|------|--------------------|----------------|---------------------|
| 1 | Cálculo de juros | FIFO sobre recebíveis, split entre "principal devolvido" e "juros" | **Sem FIFO.** Lucro = `soma_recebíveis - soma_gastos`. Apenas 2 tipos de retorno: `valor_fixo` e `sem_juros`. | Remover FIFO (`emprestimoAjuste.ajustarRecebiveisDeEmprestimo`), remover `taxaJurosPercentual`/`valorJurosFixo`/`juros_percentual`/`juros_fixo` do schema. Simplificar TX de juros auto para `valor = lucro_total` na quitação. |
| 2 | Geração de lucro | `lucro = totalRecebido - totalDesembolsado` (Number); TX de juros auto criada via FIFO split | **`lucro = soma_recebíveis - soma_gastos`.** TX de juros auto com `valor = lucro_realizado`, gerada na transição `ativo → quitado`. | Simplificar `emprestimoQuitacao.recalcularJurosAuto` para receber `valor = lucro` direto, sem FIFO. |
| 3 | Status `quitado` | Automático: `totalRecebido >= valorEsperado` (comparação em Number) | **Manter automático.** | Nenhuma (alinhado com decisão do usuário). |
| 4 | Status `cancelado` | Manual; TXs vinculadas **permanecem ativas** | **Cancelar pede confirmação por TX.** Modal pergunta o que fazer com cada TX vinculada (manter / estornar / desvincular). | Adicionar modal de cancelamento com lista de TXs vinculadas e 3 ações por TX. |
| 5 | `direcao: 'recebido'` | Aceita no schema, mas `emprestimoAjuste` **não aplica** o split | **Remover `direcao: 'recebido'`.** A direção é sempre "EU emprestando" (implícita = `concedido`). | Remover `direcao` do schema, do payload, do service, do `emprestimoAjuste`, e da UI. |
| 6 | Edição de empréstimo | `pessoaId` e `direcao` travados se há TXs ativas; `valorEsperadoRetorno` pode ser aumentado, com auto-reversão de status | **Permitir edição de `valorEsperadoRetorno` mesmo com TXs ativas** (complemento = soma no `valorEsperadoRetorno`). `pessoaId` continua travado. Auto-reversão `quitado → ativo` **removida**. | Remover auto-reversão. Permitir edição de `valorEsperadoRetorno` sem reverter status. UI: campo `valorEsperadoRetorno` em modo edição aceita novo valor. |
| 7 | Precisão monetária | `Number` em todo o módulo | **NÃO migrar** para `decimal.js`. Decisão consciente. | Nenhuma. Documentar como exceção ao AGENTS.md. |
| 8 | Vinculação de TX | `validarEmprestimoParaTransacao` rejeita se empréstimo cancelado | **Manter rejeição.** | Nenhuma. |
| 9 | Estorno de TX de empréstimo | Seta `status='estornado'`, recalcula, reverte quitação se aplicável, **deleta TX de juros auto** | **Manter.** | Nenhuma. |
| 10 | Reativação de TX estornada | Seta `status='ativo'`, recalcula, pode re-quitar | **Manter.** | Nenhuma. |
| 11 | Parcelamento com empréstimo | Mesmo `emprestimoId` propaga para todas as parcelas | **Manter.** Limitação conhecida, sem multi-empréstimo em um parcelamento. | Documentar como limitação. |
| 12 | Migração de TIs para Empréstimo | `criarEmprestimosParaImportacao` agrupa por chave natural | **Manter.** Funciona. | Nenhuma. |
| 13 | Estorno de importação | Estorna TXs reais, recalcula status, estorna Empréstimo se aplicável | **Manter.** | Nenhuma. |
| 14 | Pluggy + Empréstimo | TIs de Pluggy não vêm com `emprestimoConfig` pré-marcado | **Manter como está.** Princípio arquitetural: Pluggy é espelho de saldos, Empréstimo é decisão operacional. | Nenhuma. |
| 15 | Filtros extras de listagem | Apenas `status` (CSV) + `pessoaId` + faixa de prazo | **Manter.** Sem mudança nesta rodada. | Nenhuma (rodada futura). |
| 16 | UI de registro de recebimento no detalhe | Não existe. Via formulário de transação na aba "Avançado" | **REMOVER.** Usuário abre form de TX, marca "parte de empréstimo" na aba Avançado, vincula. | Nenhuma. |
| 17 | UI de quitação manual | Não existe | **REMOVER.** Sistema quita sozinho quando `totalRecebido >= valorEsperado`. | Nenhuma. |
| 18 | UI de reativação de cancelamento | Não existe | **REMOVER.** Cancelamento é definitivo. | Nenhuma. |
| 19 | Reativação de empréstimo cancelado | Não implementado (backend e frontend) | **NÃO IMPLEMENTAR.** | Nenhuma. |
| 20 | Edição de `emprestimoId` em TX | Existe parcialmente via `EmprestimoSecao` no form | **MANTER (verificar).** Garantir que `setEmprestimoId(null)` (desvincular) funcione. | Verificar comportamento de desvincular TX de Empréstimo no form de TX. |
| 21 | Validação cruzada `tipoRetorno` ↔ campos de juros | Não existe | **Irrelevante** (campos removidos no Bloco 1). | Nenhuma. |
| 22 | Migração 006 documentada | Existe mas não listada no README | **Atualizar README de migrations.** | Incluir 004, 005, 006 com descrição de uma linha cada. |
| 23 | `listarPorPessoa` (rota morta) | Exportado, não roteado | **Remover.** | Deletar método do controller. |
| 24 | `dataQuitacao` em re-quitação | Não atualiza | **Manter comportamento atual.** | Nenhuma. |
| 25 | Email verificado em rotas de empréstimo | Não validado pelo middleware | **NÃO TOCAR.** Escopo amplo, foge desta tarefa. | Nenhuma. Tratar em refactor futuro. |
| 26 | TX auto-juros só é criada se há último recebimento ativo | Sim | **Manter.** Comportamento correto. | Nenhuma. |
| 27 | Inconsistência de defaults `tipoRetorno` | `EmprestimoForm` → `sem_juros`; `useEmprestimoForm` → `valor_fixo` | **Unificar para `valor_fixo`** (caminho primário). | Alterar `ESTADO_INICIAL` em `EmprestimoForm.js`. |
| 28 | `EmprestimoBadge` só para recebimentos | Sim | **Renderizar também para desembolsos.** | Atualizar `EmprestimoBadge.js` para diferenciar visualmente. |
| 29 | `EmprestimoForm` não envia `direcao` no payload | Sim | **Tornar irrelevante** (campo removido no Bloco 2). | Remover `direcao` de todos os payloads (Bloco 5 já cobre conceitualmente). |
| 30 | `useTransacaoForm.emprestimoId` é código morto | Sim | **Remover.** | Remover `emprestimoId` do `formState` e do `payload` em `useTransacaoForm.js`. |
| 31 | `listarPessoas` com flags diferentes | `useEmprestimoForm` com `incluirInativas=true`; `EmprestimoForm` sem flag | **Unificar para `incluirInativas=true`.** | Alterar `EmprestimoForm.js`. |
| 32 | Breadcrumb do detalhe hardcoded | Sim | **Corrigir para usar nome da pessoa.** | Chamar `useBreadcrumbOverride` em `EmprestimoDetalhePage` com `pessoaNomeSnapshot`. |
| 33 | Sem tratamento de 401 em `api.js` (fetch) | Sim | **Adicionar tratamento de 401** (espelhar axios). | Atualizar wrapper de fetch em `api.js` para redirecionar em 401. |

## Pontos de atenção para validação manual futura

- Diferença de 1 centavo em `totalRecebido >= valorEsperado` após muitos estornos/reativações.
- TXs órfãs de empréstimo cancelado (a decidir entre estornar, desvincular, ou deixar com aviso).
- TX de juros auto não recriada se último recebimento for estornado depois da quitação.
- Chave natural de agrupamento de TIs na importação: frágil se o usuário revisar campos parciais.
- Comportamento de `direcao: 'recebido'` em relatórios: silenciosamente ignorado.

## Riscos remanescentes

- **Risco alto:** decisões pendentes (cancelamento, reativação, juros automáticos) que afetam a integridade dos dados.
- **Risco médio:** inconsistências de UX (defaults, copy, badges) que confundem o usuário mas não corrompem dados.
- **Risco baixo:** débito técnico de `decimal.js`, que não causa bug observável em valores pequenos.

## Mudanças aplicadas

Nenhuma. Esta sessão é apenas diagnóstico.

## Aprendizados

- O módulo de Empréstimos é um **metadado sobre Transações** (via `emprestimoId`) com detecção automática de quitação e uma TX-extra de juros auto. Toda a complexidade mora no FIFO e no `recalcularStatus`.
- O `tipoRetorno` é mais uma **intenção de UX** do que uma **regra de cálculo**. O sistema sempre usa FIFO.
- O nome "valor_fixo" e a presença dos campos `taxaJurosPercentual`/`valorJurosFixo` são **promessas não cumpridas** pelo cálculo atual. Talvez seja onde a maior parte da confusão mora.
- O backend tem **comportamento defensivo** (idempotência via `findOneAndUpdate`, snapshots de pessoa, auto-reversão) que o frontend nem sempre explora (ex: a UI não mostra "revertido automaticamente" quando você aumenta o valor esperado).

## Próximos passos

1. **Matriz final** (mais abaixo) está completa e revisada bloco a bloco com Alisson, **atualizada após a revisão de quitação (2026-06-21)**.
2. **Mudança de modelo aprovada na revisão de quitação:**
   - **Sem FIFO.** O cálculo de lucro passa de "FIFO + split" para `soma_recebíveis - soma_gastos`. Isso simplifica bastante o motor.
   - **Complemento = 1 Empréstimo, valor esperado cresce.** Quando o usuário quer emprestar mais para a mesma pessoa, ele altera `valorEsperadoRetorno` no mesmo Empréstimo (em vez de criar outro). Quebra a regra atual de "travar valor esperado se há TXs ativas".
   - **Auto-reversão `quitado → ativo` removida.** O usuário gerencia o status manualmente.
3. **Decisões das pendências resolvidas (2026-06-21):**
   - **Pendência 1 (TIs de importação → Empréstimo):** **MANTER** o caminho. UX de revisar TIs em massa e criar Empréstimos ali é valiosa. Sem mudança.
   - **Pendência 2 (UIs novas do Bloco 6):** **REMOVER 3 de 4.** Quitação manual, reativação de cancelado e UI de recebimento no detalhe foram removidas. Sobrou: edição de `emprestimoId` em TX (verificar que funciona) + breadcrumb dinâmico. Bloco 6 agora é predominantemente "manter" ou "corrigir".
   - **Pendência 3 (`emailVerificado` no middleware):** **NÃO TOCAR.** Escopo amplo, foge desta tarefa. Tratar em refactor futuro.
4. **Próxima fase do briefing:** **FASE 3 — Identificação de Impactos**, com base nesta matriz. Vai exigir:
   - Verificar dados existentes (empréstimos com `tipoRetorno: 'juros_percentual'/'juros_fixo'`, com `direcao: 'recebido'`).
   - Determinar compatibilidade (o que permanece, o que muda, o que exige migração).
   - Investigar dependências ocultas (componentes reutilizados, validações compartilhadas, integrações indiretas).
   - Atualizar este documento com a FASE 3 antes de partir para a FASE 4 (implementação).
5. **Pontos ainda pendentes** (decisões pequenas que vão precisar de definição no design doc):
   - **(4) Modal de cancelamento com TXs:** o que perguntar exatamente? Manter / estornar / desvincular. Texto do aviso.
   - **(6) Edição com TXs ativas:** o aviso na UI vai ser inline ou modal? Conteúdo exato.
   - **(20) Verificar `setEmprestimoId(null)`:** confirmar comportamento de desvincular TX de Empréstimo no form de TX.
