---
type: design
status: active
created: 2026-06-21
updated: 2026-06-21
tags: [emprestimos, design-doc, fase-4, refactor, plano]
---

# Design Doc — Refatoração do Módulo de Empréstimos

> Documento de design consolidado para implementação. Referência: FASE 1+2 (`2026-06-21-emprestimos-diagnostico.md`) e FASE 3 (`2026-06-21-emprestimos-fase-3-impactos.md`).

## 1. Visão geral

Refatorar o módulo de Empréstimos para alinhá-lo com o modelo conceitual real do Alisson:

- **Empréstimo nasce sempre de uma Transação** (criação via `EmprestimoSecao` no formulário de TX, não standalone).
- **Cálculo de lucro simples:** `soma_recebíveis - soma_gastos` (sem FIFO, sem split por TX).
- **Modelo de schema simplificado:** 2 tipos de retorno (`valor_fixo` e `sem_juros`), sem `direcao`, sem `taxaJurosPercentual`/`valorJurosFixo`.
- **Complemento de Empréstimo** = editar `valorEsperadoRetorno` no mesmo Empréstimo (não criar novo).
- **Sem auto-reversão** `quitado → ativo` na edição.
- **TX de juros auto** permanece como mecanismo de "receita realizada", com nova semântica.
- **Sumário de relatórios:** TXs de Empréstimo (gasto + recebível não-juros-auto) **excluídas**; TX de juros auto conta como receita.

## 2. Princípios

1. **Simplicidade > sofisticação.** Sem FIFO. Sem split. Sem `decimal.js` no módulo (decisão consciente).
2. **Preservar comportamentos corretos.** Cálculo de quitação por `totalRecebido >= valorEsperado` permanece. `recalcularStatus` idempotente.
3. **Mudanças orientadas por evidência.** Cada alteração mapeada para uma regra da FASE 2 ou decisão da FASE 3.
4. **Implementação incremental.** 11 passos na sequência, cada um deixando o sistema funcional.
5. **Migration idempotente e não destrutiva.** 008 normaliza dados sem apagar.

## 3. Decisões estruturais (consolidadas da FASE 2 + 3)

### 3.1 Schema (`models/emprestimo.js`)

**REMOVER:**
- Campo `direcao` (enum `['concedido', 'recebido']`, default `'concedido'`)
- Campo `taxaJurosPercentual` (Number, 0-1000)
- Campo `valorJurosFixo` (Number, ≥0)
- Constante `DIRECOES` (exportada)
- Constante `TIPOS_RETORNO` (substituir por literal `['valor_fixo', 'sem_juros']`)

**MANTER:**
- Campos: `usuario`, `pessoaId`, `pessoaNomeSnapshot`, `pessoaContatoSnapshot`, `valorEsperadoRetorno`, `prazoFinal`, `observacao`, `status`, `dataQuitacao`
- Constante `STATUS_EMPRESTIMO` (`['ativo', 'quitado', 'cancelado']`)
- Índices e virtual `isQuitado`

**MODIFICAR:**
- `tipoRetorno` enum: `['valor_fixo', 'juros_percentual', 'juros_fixo', 'sem_juros']` → `['valor_fixo', 'sem_juros']`
- `tipoRetorno` default: `'sem_juros'` → `'valor_fixo'`

### 3.2 Schema (`models/transacaoImportada.js`)

**REMOVER do sub-schema `EmprestimoConfigSchema`:**
- Campo `direcao` (enum, default `'concedido'`)
- Campo `taxaJurosPercentual`
- Campo `valorJurosFixo`

**MANTER:** todos os outros campos do sub-schema (incluindo `empEmprestimoIdExistente`).

### 3.3 Service (`services/emprestimoService.js`)

**REMOVER:**
- Função `calcularTotalJuros` (substituída por cálculo inline)
- Função `criarTransacaoJurosAuto` (wrapper deprecated)
- Constante `CAMPOS_EDITAVEIS` (dead code, Pendência 8)
- Validações de `taxaJurosPercentual`/`valorJurosFixo`/`direcao` em `validarDadosEmprestimo`

**MODIFICAR:**
- `calcularTotais` simplifica o retorno (mantém `totalDisbursed`, `totalReceived`; `saldoAReceber` e `lucro` permanecem 0 — quem calcula é o consumidor, sem mudança)
- `recalcularStatus`:
  - Remove bloco de auto-reversão `quitado → ativo` (CASO 2)
  - Calcula `totalJuros = soma_recebíveis - soma_gastos` inline
  - Mantém CASO 1 (transição `ativo → quitado`) e CASO 3 (atualização de TX auto)
  - Chama `recalcularJurosAuto(transicao, lucro)` (parâmetro agora é `lucro` direto, sem cálculo de juros)
- `validarEmprestimoParaTransacao` mantém (rejeita empréstimo cancelado)
- `obterEmprestimoComTotais` mantém

**EXPORT (módulo):**
- REMOVER: `calcularTotalJuros`, `criarTransacaoJurosAuto`, `CAMPOS_EDITAVEIS`
- MANTER: `validarDadosEmprestimo`, `STATUS_EMPRESTIMO`, `calcularTotais`, `obterEmprestimoComTotais`, `recalcularStatus`, `validarEmprestimoParaTransacao`

### 3.4 Utils (`utils/emprestimoQuitacao.js`)

**MODIFICAR:**
- `montarObservacao`: nova semântica sem "principal devolvido". Texto: `"Lucro realizado do empréstimo para {pessoa}. Desembolsos: R$ X. Recebimentos: R$ Y. Lucro: R$ Z."`
- `recalcularJurosAuto`:
  - Parâmetro `totalJuros` agora é `lucro` (soma_recebíveis - soma_gastos)
  - Se `totalJurosArred <= 0`: deleta TX auto (se existir) ou não cria (se não existir) — comportamento Pendência 1
  - Cópia de snapshot do último recebimento: continua (categoria, tags, contato)
  - Descrição: `"Lucro - {pessoa}"`

### 3.5 Utils (`utils/emprestimoAjuste.js`)

**MODIFICAR (simplificar):**
- `ajustarRecebiveisDeEmprestimo`:
  - Carrega Empréstimos referenciados (sem filtro `direcao: 'concedido'` — campo removido)
  - Para cada TX de Empréstimo:
    - Gasto: marca `_emprestimoEsconderNaLista = true`, zera `valor` e `pagamentos[*].valor`
    - Recebível (não-juros-auto): marca `_emprestimoEsconderNaLista = true`, zera `valor` e `pagamentos[*].valor`. **SEM** split FIFO, **SEM** `_emprestimoInfo`
  - TX com `emprestimoEhJurosAuto: true` permanece inalterada (entra como receita normal)
- **REMOVER:** `calcularAjusteResumoPorEmprestimo` (compensação do summary é feita por outro mecanismo — ver 3.6)

### 3.6 Relatórios — compensação do summary (Pendência 2)

**Decisão:** TXs de Empréstimo (gasto + recebível não-juros-auto) **excluídas** do `summary`. TX de juros auto conta como receita.

**Implementação em `controladorTransacao.js` (`obterTodasTransacoes` paginado):**
- Após o aggregate, antes de devolver `dataPage`:
  - Calcular `emprestimoIds` distintos da página
  - Buscar todas as TXs vinculadas a esses Empréstimos (com filtro `emprestimoEhJurosAuto: { $ne: true }` para excluir a TX auto)
  - Para cada TX vinculada: **subtrair** seu valor do summary (`totalGastos` se `tipo === 'gasto'`, `totalRecebiveis` se `tipo === 'recebivel'`)
  - A TX de juros auto permanece no aggregate e soma normalmente como `recebivel`
- Sem isso: o summary teria o gasto de 500 + o recebível de 700 + a TX de juros de 200 = tudo somado, gerando dupla contagem

**Em `controladorTransacao.js` (sem paginação) e `obterTransacoesExport`:** mesma lógica de compensação.

**Em `reportEngine/filterService.js` (relatório avançado):** o `ajustarRecebiveisDeEmprestimo` (modificado) garante que TXs de Empréstimo não apareçam na lista, mas como `ruleEngine` opera sobre as TXs e o aggregate é por linha, a compensação explícita pode não ser necessária para o relatório avançado (depende de como o `ruleEngine` e o `aggregator` processam). **A definir na implementação, com teste manual.**

### 3.7 Controllers

**`emprestimoController.js`:**
- `criar`: remove `direcao` do payload (default implícito = `concedido`)
- `atualizar`: remove validação de `direcao` (campo não existe mais); remove bloco de auto-reversão `quitado → ativo`; remove trava de `pessoaId` se há TXs (Decisão 2.b: agora permite edição de `valorEsperadoRetorno` mesmo com TXs ativas)
- `cancelar`: sem mudança (Bloco 4 fora de escopo — TXs órfãs documentadas)
- `listarTransacoes`: remove cálculo de split FIFO (linhas 247-289 que fazem FIFO manual) — apenas retorna TXs vinculadas
- `listarPorPessoa`: **REMOVER** (dead code, Bloco 8 #23)
- `obterPorId`: sem mudança
- `listar`: sem mudança

**`controladorTransacao.js`:**
- `obterTodasTransacoes` (paginado, linhas 199-258): remover bloco de `ajustarRecebiveisDeEmprestimo` (linhas 211-259) e lookup que restaura valor (linhas 245-250); adicionar compensação explícita do summary (3.6)
- `obterTodasTransacoes` (sem paginação, linhas 110-111): remover `ajustarRecebiveisDeEmprestimo`; adicionar compensação
- `obterTransacoesExport` (linhas 343-344): idem
- Demais: sem mudança (chamadas a `validarEmprestimoParaTransacao` e `recalcularStatus` continuam)

**`importacaoController.js`:**
- `criarEmprestimosParaImportacao` (linhas 45-111): remover `direcao`, `taxaJurosPercentual`, `valorJurosFixo` do payload de `Emprestimo.create` (linhas 79-92); simplificar `chaveAgrupamentoEmprestimo` (linhas 28-43) removendo elementos relacionados
- Demais: sem mudança

**`transacaoImportadaController.js`:**
- `camposPermitidos` (linha 74): remover `direcao`, `taxaJurosPercentual`, `valorJurosFixo` da whitelist de `emprestimoConfig` (backend rejeita campos extras via Mongoose `strict: true`)
- Demais: sem mudança

**`reportEngine/filterService.js`:**
- Import de `ajustarRecebiveisDeEmprestimo` (linha 6): mantém
- Chamada (linha 129): mantém (agora com semântica simplificada)
- `calcularAjusteResumoPorEmprestimo` não é usado aqui — sem mudança

### 3.8 Frontend

**`utils/emprestimoFormat.js`:**
- `labelTipoRetorno`: remover entradas `juros_percentual` e `juros_fixo` do map
- Demais: sem mudança

**`components/Emprestimos/EmprestimoForm.js`:**
- ESTADO_INICIAL: `tipoRetorno: 'sem_juros'` → `'valor_fixo'`
- Remover campos `taxaJurosPercentual` e `valorJurosFixo` do ESTADO_INICIAL (linhas 10-11)
- Remover 2 validações (linhas 50, 54)
- Remover `taxaJurosPercentual` e `valorJurosFixo` do payload (linhas 65-66)
- Reduzir `<select>` de 4 para 2 opções (linhas 122-128): manter `valor_fixo` e `sem_juros`
- Remover inputs condicionais (linhas 132-157)
- `listarPessoas()` (linha 23) → `listarPessoas(true)` (Bloco 7 #31)
- `direcao` continua NÃO sendo enviado no payload (Bloco 2, sem mudança no EmprestimoForm)

**`components/Emprestimos/EmprestimoSecao.js`:**
- Substituir `state.direcao === 'concedido'` (linha 55) por `tipoTransacao === 'gasto'`
- Demais: sem mudança (já só permite `valor_fixo` e `sem_juros`)

**`components/Emprestimos/EmprestimoBadge.js`:**
- Adicionar branch para `emprestimoInfo.tipo === 'desembolso'`
- Tooltip simplificado: "Parte do empréstimo [nome pessoa] — valor: R$ X" (sem `principal`/`juros`)
- Variantes `inline` e `chip` mantidas
- Retorna `null` se `emprestimoInfo` ausente

**`hooks/useEmprestimoForm.js`:**
- Remover `direcao: tipoTransacao === 'recebivel' ? 'recebido' : 'concedido'` do `state` retornado (linha 135)
- Demais: sem mudança (default `valor_fixo` já alinhado)

**`hooks/useTransacaoForm.js`:**
- **REMOVER código morto do Bloco 7:** `emprestimoId` useState (linha 19), `setEmprestimoId('')` em reset (linha 66), `if (emprestimoId) payload.emprestimoId = ...` em buildPayload (linhas 81-82), dep em useCallback (linha 84), exposição em formState (linha 106) e setters (linha 107)

**`components/Transaction/NovaTransacaoForm.js`:**
- Remover `direcao: emprestimoForm.state.direcao` do payload de `criarEmprestimo` (linha 128)
- Demais: sem mudança (lógica de `setEmprestimoId(null)` no payload da TX já funciona, linhas 167-168)

**`components/Transaction/EditarTransacaoItem.js`:**
- Remover `direcao: st.direcao` do `emprestimoConfig` (linha 98)
- Remover `taxaJurosPercentual: null` e `valorJurosFixo: null` (linhas 103-104) — não fazem nada

**`pages/Emprestimos/EmprestimosPage.js`:**
- Remover state `modalOpen` (linha 13)
- Remover função `handleCriar` (linhas 31-37)
- Remover import de `criarEmprestimo` (linha 5) e `EmprestimoForm` (linha 7)
- Remover botão "+ Novo Empréstimo" (linha 61)
- Remover modal JSX (linhas 161-171)
- Demais (filtros, cards, totais): sem mudança

**`pages/Emprestimos/EmprestimoDetalhePage.js`:**
- Adicionar `useBreadcrumbOverride(emprestimo?.pessoaNomeSnapshot)` (Bloco 8 #32)
- Importar `useBreadcrumbOverride` de `../../context/BreadcrumbContext`
- Remover renderização condicional de `taxaJurosPercentual` (linhas 146, 149)
- Demais: sem mudança

**`api.js`:**
- Adicionar tratamento de 401 (espelhar `services/api.js` interceptor): após `await resposta.json()`, se status 401, limpa token e redireciona para `loginRedirectUrl` (ou `/login` fallback)
- Aplicar em todas as funções de Empréstimo/Pessoa (e idealmente em todas as funções de `api.js`)
- `normalizarCamposEmprestimo` (linhas 210-216): adaptar para nova semântica — `t._emprestimoEsconderNaLista` → `esconderNaLista: true` (sem `emprestimoInfo`, que deixa de existir)

**`config/breadcrumbConfig.js`:**
- Linha 29: manter `"Detalhes do Empréstimo"` como fallback (caso o `useBreadcrumbOverride` não tenha carregado ainda)
- Opcional: remover a entrada e confiar no `useBreadcrumbOverride`. **Decisão:** manter fallback.

### 3.9 Migration 008

**`backend/scripts/migrations/008-emprestimo-simplificacao.js`:**

**Ações (todas idempotentes):**
1. `emprestimos`: `findOneAndUpdate({ tipoRetorno: { $in: ['juros_percentual', 'juros_fixo'] } }, { $set: { tipoRetorno: 'valor_fixo' } })` em loop
2. `emprestimos`: `updateMany({ direcao: 'recebido' }, { $set: { direcao: 'concedido' } })`
3. `emprestimos`: `updateMany({}, { $unset: { taxaJurosPercentual: '', valorJurosFixo: '' } })` (remove campos)
4. `transacoesimportadas`: similar para `emprestimoConfig.tipoRetorno`, `emprestimoConfig.direcao`, `emprestimoConfig.taxaJurosPercentual`, `emprestimoConfig.valorJurosFixo` (updateMany com dot notation)
5. Logs de quantos docs foram normalizados

**NÃO faz:** recálculo de TXs de juros auto (Alisson confirmou: "não temos dados históricos para se preocupar"). O `recalcularStatus` cuida disso naturalmente em próxima edição.

**`backend/scripts/migrations/README.md`:** atualizar lista de migrations (incluir 008, garantir 004-007 também listados).

### 3.10 Testes

**`services/__tests__/emprestimoService.test.js`:** reescrever
- Remover testes de `juros_percentual`/`juros_fixo`/`recebido`
- Reescrever testes de `recalcularStatus` para nova fórmula (lucro = soma_recebíveis - soma_gastos)
- Adicionar teste de prejuízo (lucro ≤ 0 → deleta TX auto)
- Adicionar teste de edição de `valorEsperadoRetorno` com TXs ativas (Bloco 2.b)

**`utils/__tests__/emprestimoAjuste.test.js`:** reescrever
- Remover testes de FIFO/split principal-juros
- Adicionar testes da nova semântica (marcação `_emprestimoEsconderNaLista`, zerar valor, sem `emprestimoInfo`)
- Adicionar teste de TX de juros auto (não deve ser tocada)

**`utils/__tests__/emprestimoQuitacao.test.js`:** revisar
- Atualizar testes de `montarObservacao` (nova string)
- Adicionar teste de prejuízo (lucro ≤ 0 deleta)
- Manter testes de criação/atualização/deleção/mantida

## 4. Sequência de implementação (11 passos)

Cada passo é **funcional isoladamente** e **não quebra o sistema** (ou quebra de forma previsível, com fallback).

| # | Passo | Arquivos | Validação |
|---|-------|----------|-----------|
| 1 | **Migration 008** | `backend/scripts/migrations/008-emprestimo-simplificacao.js`, `backend/scripts/migrations/README.md` | Script idempotente roda sem erro. Docs existentes com tipos antigos são normalizados. |
| 2 | **Bloco 1 — Tipos de retorno (backend)** | `backend/src/models/emprestimo.js`, `backend/src/models/transacaoImportada.js` | Schema simplificado. API rejeita `tipoRetorno: 'juros_*'` (validação no service). |
| 3 | **Bloco 1 — Tipos de retorno (frontend)** | `controle-gastos-frontend/src/utils/emprestimoFormat.js`, `controle-gastos-frontend/src/components/Emprestimos/EmprestimoForm.js` | UI mostra só 2 opções. Validação de campos removida. |
| 4 | **Bloco 2 — Direção (backend)** | `backend/src/models/emprestimo.js`, `backend/src/controllers/emprestimoController.js`, `backend/src/controllers/importacaoController.js` | Schema sem `direcao`. API ignora `direcao` no body. |
| 5 | **Bloco 2 — Direção (frontend)** | `controle-gastos-frontend/src/hooks/useEmprestimoForm.js`, `controle-gastos-frontend/src/components/Emprestimos/EmprestimoSecao.js`, `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js`, `controle-gastos-frontend/src/components/Transaction/EditarTransacaoItem.js` | UI não envia `direcao` no payload. Texto "Você está emprestando" baseado em `tipoTransacao`. |
| 6 | **Bloco 1.b — Revisão de quitação (sem FIFO)** | `backend/src/services/emprestimoService.js` (calcularTotalJuros removido, recalcularStatus simplificado), `backend/src/utils/emprestimoAjuste.js` (split removido, calcularAjusteResumoPorEmprestimo removido), `backend/src/utils/emprestimoQuitacao.js` (montarObservacao nova), `backend/src/controllers/controladorTransacao.js` (compensação do summary), `backend/src/reportEngine/filterService.js` (sem mudança) | Empréstimo quitado gera TX de juros auto com `valor = soma_recebíveis - soma_gastos`. Summary não tem dupla contagem. Relatório avançado continua sem TXs de Empréstimo. |
| 7 | **Bloco 2.b — Sem auto-reversão** | `backend/src/services/emprestimoService.js` (recalcularStatus remove CASO 2), `backend/src/controllers/emprestimoController.js` (atualizar remove auto-reversão) | Edição de `valorEsperadoRetorno` com TXs ativas não reverte status. |
| 8 | **Bloco 5 — Modal removido** | `controle-gastos-frontend/src/pages/Emprestimos/EmprestimosPage.js` | Lista de Empréstimos sem botão "+ Novo". Criação só via form de TX. |
| 9 | **Bloco 6 — UIs (revisado)** | `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js` (breadcrumb dinâmico) | Breadcrumb mostra nome da pessoa. `setEmprestimoId(null)` no form de TX já funciona (validar via teste manual). |
| 10 | **Bloco 7 — Cleanup frontend** | `controle-gastos-frontend/src/hooks/useTransacaoForm.js` (remover `emprestimoId` morto), `controle-gastos-frontend/src/components/Emprestimos/EmprestimoBadge.js` (branch desembolso + tooltip simples), `controle-gastos-frontend/src/api.js` (tratamento 401), `controle-gastos-frontend/src/components/Emprestimos/EmprestimoForm.js` (`listarPessoas(true)`) | Frontend limpo. 401 redireciona para login. Badge aparece para gastos e recebimentos. |
| 11 | **Bloco 8 — Infra + Testes** | `backend/src/controllers/emprestimoController.js` (remover `listarPorPessoa`), `backend/src/services/emprestimoService.js` (remover `CAMPOS_EDITAVEIS`), reescrever 3 arquivos de teste | Dead code removido. Testes passam. |

## 5. Critérios de aceitação

Para considerar a refatoração **concluída**:

### Backend
- [ ] Migration 008 roda sem erro em ambiente limpo e com dados legados
- [ ] `GET /api/emprestimos` retorna Empréstimos sem campos `direcao`/`taxaJurosPercentual`/`valorJurosFixo`
- [ ] `POST /api/emprestimos` rejeita `tipoRetorno: 'juros_*'` e `direcao: 'recebido'` com erro de validação
- [ ] `POST /api/emprestimos` aceita `tipoRetorno: 'valor_fixo'` e `tipoRetorno: 'sem_juros'`
- [ ] Fluxo de quitação: gasto + recebimento que quita → TX de juros auto com `valor = lucro` correto
- [ ] Edição de `valorEsperadoRetorno` com TXs ativas funciona sem erro
- [ ] Resumo de `GET /api/transacoes` (paginado) não tem TXs de Empréstimo (exceto TX auto)
- [ ] Relatório avançado (`controladorRelatorioAvancado`) não tem TXs de Empréstimo na lista
- [ ] 14 endpoints de Empréstimo + Transação continuam respondendo
- [ ] `recalcularStatus` é idempotente (rodar 2x não muda estado)
- [ ] Lucro ≤ 0 deleta TX auto (não cria)
- [ ] 3 arquivos de teste passam

### Frontend
- [ ] Lista de Empréstimos sem botão/modal de criação
- [ ] Form de criação (em `EmprestimoSecao`) continua funcionando
- [ ] Form de edição de Empréstimo (em `EmprestimoDetalhePage`) continua funcionando
- [ ] Modal de cancelamento (SweetAlert) continua funcionando
- [ ] Breadcrumb do detalhe mostra nome da pessoa
- [ ] `EmprestimoBadge` aparece para gastos e recebimentos (sem split principal/juros)
- [ ] Tooltip do badge é simples: "Parte do empréstimo [nome] — valor: R$ X"
- [ ] `api.js` redireciona para `/login` em 401
- [ ] TIs de importação continuam podendo virar Empréstimo
- [ ] Default de `tipoRetorno` é `valor_fixo` em todos os pontos

### Documentação
- [ ] `backend/scripts/migrations/README.md` lista 001-008
- [ ] Matriz final no vault atualizada
- [ ] Design doc (este arquivo) revisado e aprovado

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Migration 008 falha em dados não previstos | Idempotência + log de quantos docs foram normalizados. Se falhar, o estado anterior está preservado (não destrutivo). |
| Resumo de relatórios tem números errados | Teste manual em staging. Se errar, ajustar compensação (3.6). |
| Relatório avançado quebrou | Investigar `ruleEngine` e `aggregator` no `reportEngine/` na implementação. Se quebrar, fallback explícito. |
| Frontend mostra Empréstimo legado com tipo antigo | `labelTipoRetorno` tem fallback (`map[tipo] || tipo`). Se backend normalizou, não há problema. |
| TXs órfãs de cancelamento (Bloco 4 fora de escopo) | Documentar. Decidir em rodada futura. |
| `emailVerificado` no middleware (Pendência 3 decidia não tocar) | Decidido: não tocar. |
| `_emprestimoInfo` removido do `emprestimoInfo` (frontend) | Tooltip do badge simplificado. |

## 7. Validação manual futura (FASE 7 do briefing)

**Backend (cenários):**
1. Criar Empréstimo (com gasto vinculado). Vincular mais um gasto (complemento, soma `valorEsperadoRetorno`).
2. Vincular recebimento que quita. Verificar TX de juros auto com valor correto.
3. Estornar recebimento. Verificar reversão (sem auto-reversão: status continua `quitado`).
4. Reativar TX estornada. Verificar re-quitação automática.
5. Cancelar Empréstimo. TXs vinculadas continuam ativas (Bloco 4 fora de escopo — documentar).
6. Importar CSV/OFX/Pluggy, marcar TI como Empréstimo, finalizar. Verificar criação.

**Frontend (cenários):**
1. Lista de Empréstimos renderiza sem erros.
2. Detalhe do Empréstimo mostra breadcrumb com nome da pessoa.
3. Form de TX (Home) com seção de Empréstimo funcionando.
4. Form de TX (DetalhesImportacaoPage) com seção de Empréstimo funcionando.
5. Editar Empréstimo no detalhe, salvar.
6. Simular token expirado: app redireciona para `/login`.
7. Verificar `EmprestimoBadge` aparece em gastos e recebimentos.

## 8. Não-objetivos

- Adicionar `decimal.js` ao módulo (decisão consciente Pendência 3 da FASE 2).
- Validar `emailVerificado` no middleware (decisão Pendência 3 da FASE 3).
- Adicionar UI de recebimento no detalhe do Empréstimo (Bloco 6 revisado).
- Adicionar botão de quitação manual (Bloco 6 revisado).
- Adicionar reativação de Empréstimo cancelado (Bloco 6 revisado).
- Adicionar filtros extras na lista de Empréstimos (Bloco 6 #15).
- Renumerar 007 (limpar-ledger-pluggy) para 008.
- Promover "Pessoas" para item raiz do menu lateral.
- Implementar modal de cancelamento com confirmação por TX (Bloco 4, fora de escopo).
- Resolver TXs órfãs de Empréstimo cancelado (Bloco 4, fora de escopo).

## 9. Próximo passo

Após aprovação deste design doc:
1. **Delegar ao `newapp-executor`** (via tool `task`) com este design doc como brief.
2. Executor aplica os 11 passos em sequência.
3. Executor reporta a cada fase ou pede `question` se travar.
4. Após conclusão, Alisson valida manualmente (FASE 7 do briefing) e atualiza o vault com aprendizados.
