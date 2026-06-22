---
type: session
status: active
created: 2026-06-21
updated: 2026-06-21
tags: [emprestimos, fase-3, impactos, dependencias, migracao, decisoes-finalizadas]
---

# FASE 3 — Identificação de Impactos (Módulo de Empréstimos)

> Documento de impactos da refatoração. **Atualiza** o diagnóstico (`2026-06-21-emprestimos-diagnostico.md`) com achados de dependências. **Não contém código** — só mapeamento.
>
> **STATUS (2026-06-21):** FASE 3 completa. Todas as 10 pendências resolvidas. Pronto para FASE 4.

## Escopo da investigação

- **Dependências backend** (services, controllers, models, utils, migrations, testes, integrações).
- **Dependências frontend** (pages, components, hooks, contexts, services, api, utils).
- **Pontos onde dados existentes podem estar quebrados** (estimativa baseada em código; **NÃO consultamos MongoDB** — Alisson vetou a investigação no banco. Migration será feita depois via executor).

## Resumo executivo

A refatoração é **cirúrgica e bem delimitada**: 9 arquivos backend + 11 arquivos frontend + 1 migration nova + 1 atualização de README. Não há dependências externas (Pluggy, ledger, netWorth, vinculo, conta conjunta **NÃO usam Empréstimo**). Nenhum job assíncrono, nenhum webhook, nenhum cron. O motor de relatórios **parcialmente** depende (`reportEngine/filterService.js` consome `ajustarRecebiveisDeEmprestimo`) — AMBÍGUO se `controladorRelatorio` herda isso.

**Maior risco:** o Bloco 1.b (remoção do FIFO + mudança de cálculo do lucro) **quebra o `summary` de relatórios** se a compensação não for refeita com cuidado. A TX de juros auto entra como `recebivel` e seria **duplamente contada** se o recebível vinculado também contar.

**Segundo maior risco:** o frontend depende de campos `_emprestimoInfo` e `_emprestimoEsconderNaLista` mutados em runtime pelo backend. Com a remoção do FIFO, esses campos deixam de existir. Frontend precisa de adaptação ou de campos públicos equivalentes.

---

## Impacto por arquivo (backend)

### Arquivos a **remover** (mortos após a refatoração)

| Arquivo | Motivo | Linhas afetadas |
|---|---|---|
| `C:\PROJETOS\newApp\backend\src\utils\emprestimoAjuste.js` | Motor FIFO + split principal/juros removidos (Bloco 1.b) | 147 linhas (todo o arquivo) |
| `C:\PROJETOS\newApp\backend\src\utils\__tests__\emprestimoAjuste.test.js` | Testes do motor removido | 230 linhas (todo o arquivo) |

### Arquivos a **modificar substancialmente**

| Arquivo | Mudanças | Impacto |
|---|---|---|
| `C:\PROJETOS\newApp\backend\src\models\emprestimo.js` | Remover `direcao`, `taxaJurosPercentual`, `valorJurosFixo`; simplificar `TIPOS_RETORNO` para `['valor_fixo', 'sem_juros']`; remover `DIRECOES` (Bloco 1+2) | Schema muda. Migration precisa normalizar dados existentes. |
| `C:\PROJETOS\newApp\backend\src\models\transacaoImportada.js` | Remover `direcao`, `taxaJurosPercentual`, `valorJurosFixo` do sub-schema `EmprestimoConfigSchema` (Bloco 1+2) | Schema muda. Migration precisa normalizar TIs. |
| `C:\PROJETOS\newApp\backend\src\services\emprestimoService.js` | Remover `calcularTotalJuros`, `criarTransacaoJurosAuto`, validações de `direcao`/`taxaJurosPercentual`/`valorJurosFixo`; simplificar `recalcularStatus` (sem auto-reversão); substituir `calcularTotalJuros` por cálculo direto `soma_recebíveis - soma_gastos` (Bloco 1+2) | **AMBÍGUO**: `CAMPOS_EDITAVEIS` é dead code (não tem chamadores). Manter ou remover? |
| `C:\PROJETOS\newApp\backend\src\utils\emprestimoQuitacao.js` | `montarObservacao` muda semântica (sem "principal devolvido"); `recalcularJurosAuto` permanece com novo input (`totalJuros = lucro realizado`) | Função permanece; testes precisam revisão. |
| `C:\PROJETOS\newApp\backend\src\controllers\emprestimoController.js` | Remover `direcao` no `criar`; remover `direcao` no `atualizar`; remover `taxaJurosPercentual`/`valorJurosFixo` no payload; remover bloco de auto-reversão em `atualizar`; remover `listarPorPessoa` (dead code, Bloco 8) | 4 endpoints perdem campos no payload; 1 endpoint morre. |
| `C:\PROJETOS\newApp\backend\src\controllers\controladorTransacao.js` | Remover `ajustarRecebiveisDeEmprestimo` em 3 locais (linhas 110-111, 211-258, 343-344); remover `calcularAjusteResumoPorEmprestimo`; refazer lógica de `summary` (compensação de Empréstimo sem FIFO) | **Risco alto**: `summary` de `GET /api/transacoes` muda comportamento. |
| `C:\PROJETOS\newApp\backend\src\controllers\importacaoController.js` | Em `criarEmprestimosParaImportacao`: remover `direcao`, `taxaJurosPercentual`, `valorJurosFixo` do payload e da `chaveAgrupamentoEmprestimo`; simplificar chave | TIs continuam virando Empréstimos (Bloco 5), só sem campos removidos. |
| `C:\PROJETOS\newApp\backend\src\reportEngine\filterService.js` | Remover `ajustarRecebiveisDeEmprestimo` (linhas 6, 129) | **AMBÍGUO**: verificar se `controladorRelatorio` e `controladorRelatorioAvancado` consomem `fetchFilteredTransactions`. Se sim, relatório pode quebrar. |
| `C:\PROJETOS\newApp\backend\src\services\__tests__\emprestimoService.test.js` | Remover testes de `juros_percentual`/`juros_fixo`/`recebido`; reescrever `recalcularStatus` para nova fórmula (Bloco 1.b) | 305 linhas de teste reescritas. |
| `C:\PROJETOS\newApp\backend\src\utils\__tests__\emprestimoQuitacao.test.js` | Revisar `montarObservacao` (texto muda); adicionar teste de prejuízo (lucro negativo) | 207 linhas revisadas. |

### Arquivos a **criar**

| Arquivo | Conteúdo | Observação |
|---|---|---|
| `C:\PROJETOS\newApp\backend\scripts\migrations\008-emprestimo-simplificacao.js` | Normaliza Empréstimos com `tipoRetorno: 'juros_*'` → `'valor_fixo'`; normaliza `direcao: 'recebido'` → `'concedido'`; remove `taxaJurosPercentual`/`valorJurosFixo`; recalcula TXs de juros auto baseado em `soma_recebíveis - soma_gastos` (se houver discrepância) | Idempotente. NÃO destrutiva. **AMBÍGUO**: 007 já existe (limpar-ledger-pluggy). Renumerar para 008. |
| `C:\PROJETOS\newApp\backend\scripts\migrations\README.md` (atualização) | Listar 004, 005, 006, 007, 008 com descrição de 1 linha cada (Bloco 8 #22) | Bloco 8 já aprovado. |

### Arquivos a **não tocar**

- Todos os `services/` exceto `emprestimoService.js`.
- Todos os `controllers/` exceto os 4 listados.
- `app.js`, `middlewares/autenticacao.js` (Pendência 3 decidiu NÃO tocar).
- `routes/rotasEmprestimo.js` (endpoints permanecem, payload muda).
- `models/transacao.js` (campos `emprestimoId` e `emprestimoEhJurosAuto` permanecem).

---

## Impacto por arquivo (frontend)

### Arquivos a **modificar**

| Arquivo | Mudanças | Bloco |
|---|---|---|
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\utils\emprestimoFormat.js` | Remover `juros_percentual`/`juros_fixo` do map `labelTipoRetorno` (linhas 28-29) | 1 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\components\Emprestimos\EmprestimoForm.js` | Remover `taxaJurosPercentual`/`valorJurosFixo` do ESTADO_INICIAL; remover 2 validações (linhas 50, 54); remover 2 campos do payload; reduzir `<select>` de 4 para 2 opções; remover inputs condicionais; alterar default de `tipoRetorno` para `'valor_fixo'`; unificar `listarPessoas(true)` | 1+7 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\components\Emprestimos\EmprestimoSecao.js` | Substituir `state.direcao === 'concedido'` por `tipoTransacao === 'gasto'` (Bloco 2) | 2 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\hooks\useEmprestimoForm.js` | Remover `direcao` do `state` (linha 135); remover do payload (Bloco 2) | 2 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\hooks\useTransacaoForm.js` | Remover `emprestimoId` do `formState` (linha 106), `setters` (linha 107), `useState` (linha 19), `resetForm` (linha 66), `buildPayload` (linhas 81-82), `useCallback` deps (linha 84) | 7 (código morto) |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\components\Emprestimos\EmprestimoBadge.js` | Adicionar branch para `tipo === 'desembolso'` (atualmente retorna `null`); adaptar tooltip (sem `principal`/`juros` separados pós-Bloco 1.b) | 7 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\components\Transaction\NovaTransacaoForm.js` | Remover `direcao` do payload de `criarEmprestimo` (linha 128) | 2 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\components\Transaction\EditarTransacaoItem.js` | Remover `direcao: st.direcao` (linha 98); remover `taxaJurosPercentual: null`/`valorJurosFixo: null` (linhas 103-104) | 1+2 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\pages\Emprestimos\EmprestimoDetalhePage.js` | Adicionar `useBreadcrumbOverride(emprestimo?.pessoaNomeSnapshot)`; remover `taxaJurosPercentual` (linhas 146, 149) | 1+8 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\pages\Emprestimos\EmprestimosPage.js` | Remover modal `+ Novo Empréstimo`; remover `modalOpen` state; remover `handleCriar`; remover import de `EmprestimoForm`; remover import de `criarEmprestimo` | 5 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\api.js` | Adicionar tratamento de 401 (espelhar `services/api.js`); revisar `normalizarCamposEmprestimo` se `emprestimoInfo` mudar de estrutura | 7 |
| `C:\PROJETOS\newApp\controle-gastos-frontend\src\config\breadcrumbConfig.js` | (opcional) Manter `"Detalhes do Empréstimo"` como fallback, ou remover se `useBreadcrumbOverride` sempre estiver presente | 8 |

### Arquivos a **não tocar**

- `services/api.js` (axios) — interceptor 401 já funciona.
- `App.js`, `MainLayout.js` — rotas de Empréstimo permanecem.
- `contexts/*` (exceto se breadcrumb precisar de export) — não usam Empréstimo.
- `pages/Home.js`, `pages/Relatorio.js` — badges continuam funcionando.
- `pages/ImportacaoMassa/DetalhesImportacaoPage.js` — TIs continuam podendo virar Empréstimo.

---

## Compatibilidade

### O que **permanece funcionando** sem mudança

- Endpoints REST: paths e métodos (POST `/emprestimos`, GET `/emprestimos`, etc).
- Fluxo de vinculação: TX com `emprestimoId` continua sendo TX normal do sistema.
- Cálculo de quitação: ainda detecta `totalRecebido >= valorEsperado`.
- TX de juros auto: ainda é criada na transição `ativo → quitado`.
- Multi-tenant, JWT, isolamento por usuário.
- Pluggy sync: não toca Empréstimo (segue funcionando).
- Relatórios (ledger, patrimônio, vinculo): não usam Empréstimo.

### O que **muda comportamento**

1. **Cálculo de lucro:** FIFO (split por TX) → `soma_recebíveis - soma_gastos` direto.
2. **Complemento de Empréstimo:** antes, era "criar outro Empréstimo" (silencioso); agora, edita `valorEsperadoRetorno` no mesmo Empréstimo.
3. **Edição de Empréstimo:** auto-reversão `quitado → ativo` removida.
4. **Summary de `GET /api/transacoes`:** lógica de compensação muda (sem FIFO, precisa de nova regra para TXs de Empréstimo).
5. **Frontend:** não há mais modal standalone de criação; criação só via form de TX.
6. **Frontend:** `EmprestimoBadge` agora aparece também para gastos (desembolsos).

### O que **exige migração** (dados existentes)

| Coleção | Docs a normalizar | Migration |
|---|---|---|
| `emprestimos` | `tipoRetorno: 'juros_percentual'` → `'valor_fixo'` | 008 |
| `emprestimos` | `tipoRetorno: 'juros_fixo'` → `'valor_fixo'` | 008 |
| `emprestimos` | `direcao: 'recebido'` → `'concedido'` | 008 |
| `emprestimos` | Remover `taxaJurosPercentual` (setar `null` ou unset) | 008 |
| `emprestimos` | Remover `valorJurosFixo` (setar `null` ou unset) | 008 |
| `emprestimos` | Recalcular TX de juros auto baseada em novo cálculo (se houver discrepância) | 008 |
| `transacoesimportadas` | `emprestimoConfig.tipoRetorno: 'juros_*'` → `'valor_fixo'` | 008 |
| `transacoesimportadas` | `emprestimoConfig.direcao: 'recebido'` → `'concedido'` | 008 |
| `transacoesimportadas` | Remover `emprestimoConfig.taxaJurosPercentual`/`valorJurosFixo` | 008 |

### O que **exige atenção especial**

1. **Sem investigar MongoDB** (Alisson vetou), não sabemos se há Empréstimos/TIs com tipos antigos no banco. **Risco:** se houver, eles vão quebrar após a refatoração até a migration 008 rodar.
2. **TXs de juros auto existentes** podem ter valor calculado via FIFO antigo. Migration precisa recalcular baseado em `soma_recebíveis - soma_gastos` e atualizar/criar/deletar conforme o caso.
3. **Empréstimos com `status: 'quitado'` e `dataQuitacao: null`:** anomalia possível, mas provavelmente inexistente (validar no script de migration).
4. **Empréstimos com `status: 'cancelado'` e TXs ativas:** cenário órfão. Migration não toca (decisão do Bloco 4 fica para quando modal de cancelamento for implementado).

---

## Dependências ocultas — resumo

### **NÃO usam Empréstimo** (verificado, sem impacto)

- `netWorthService.js`, `ledgerService.js`, `vinculoService.js`
- `pluggyService.js`, `pluggySyncService.js`, `pluggyCronService.js`
- `relatorioService.js`, `reportEngine/aggregator.js`, `reportEngine/ruleEngine.js`, `reportEngine/index.js`, `reportEngine/reportTemplates.js`
- `transacaoService.js`, `acertoService` (se existir)
- `middlewares/*` (exceto `autenticacao.js`, que NÃO foi tocado)
- Nenhum job, cron, webhook, event handler

### **USAM Empréstimo indiretamente** (verificar)

- `reportEngine/filterService.js` (linhas 6, 129): chama `ajustarRecebiveisDeEmprestimo`. **AMBÍGUO**: precisa confirmar se `controladorRelatorio.js` e `controladorRelatorioAvancado.js` chamam `fetchFilteredTransactions`.

### **USAM Empréstimo diretamente** (impacto mapeado)

- `controladorTransacao.js` (3 chamadas ao ajuste FIFO + `recalcularStatus` em 14 pontos)
- `importacaoController.js` (`criarEmprestimosParaImportacao`)
- `transacaoImportadaController.js` (whitelist de campos)
- `emprestimoService.js`, `emprestimoAjuste.js`, `emprestimoQuitacao.js` (módulo)
- `emprestimoController.js` (CRUD)
- `rotasEmprestimo.js` (endpoints)

### **Migrações de Empréstimo**

- `006-emprestimo-transacao-importada.js`: **permanece válida** (apenas garante `emprestimoId: null` + índices). Não cobre normalização de dados antigos.
- `008-emprestimo-simplificacao.js` (a criar): normaliza Empréstimos e TIs com tipos antigos.

---

## Decisões pendentes (precisam de input antes da FASE 4)

> **TODAS AS 10 PENDÊNCIAS FORAM RESOLVIDAS** em 2026-06-21. Ver tabela de decisões consolidadas abaixo.

### Decisões consolidadas (2026-06-21)

| # | Pendência | Decisão | Onde aplicar |
|---|-----------|---------|--------------|
| 1 | Prejuízo (lucro negativo) | **Manter comportamento**: `recalcularJurosAuto` com `totalJuros <= 0` deleta a TX auto. | `emprestimoQuitacao.js` (mantém) |
| 2 | Summary de relatórios | **Excluir TXs de Empréstimo** (gasto + recebível não-juros-auto) do `summary`. TX de juros auto conta como receita. | `controladorTransacao.js` (compensação sem FIFO) |
| 3 | Numeração da migration | **Criar 008** (preserva ordem cronológica). | `backend/scripts/migrations/008-emprestimo-simplificacao.js` |
| 4 | TXs auto-juros desatualizadas | **Não há dados históricos em uso real** (Alisson: "não cheguei a usar de fato o empréstimo pois não estava funcionando"). Migration 008 só normaliza schema, sem recálculo de TX auto. Se houver Empréstimo de teste, `recalcularStatus` corrige naturalmente em próxima edição. | Migration 008 simplificada |
| 5 | Default de `tipoRetorno` | **Unificar para `'valor_fixo'`** (schema + frontend). | `models/emprestimo.js:18`, `EmprestimoForm.js:9` |
| 6 | Tooltip do `EmprestimoBadge` | **Simples**: "Parte do empréstimo [nome da pessoa] — valor: R$ X". Sem `principal`/`juros` separados. | `EmprestimoBadge.js` |
| 7 | Submenu "Empréstimos" no MainLayout | **Manter como está**. | `MainLayout.js` (sem mudança) |
| 8 | `CAMPOS_EDITAVEIS` (dead code) | **Remover**. | `emprestimoService.js` (limpar export) |
| 9 | `filterService` em relatórios | **Manter comportamento** (TXs Empréstimo somem do relatório avançado). A mutação in-place muda de semântica: `ajustarRecebiveisDeEmprestimo` continua existindo mas agora apenas **marca `_emprestimoEsconderNaLista: true` e zera `valor`/`pagamentos`** (sem split FIFO). | `emprestimoAjuste.js` (manter arquivo, simplificar conteúdo) |
| 10 | TXs órfãs de cancelamento | **Documentar e não mexer**. Bloco 4 (modal de cancelamento) está fora de escopo desta rodada. | Documentar no README de migrations ou em ADR futuro |

### Implicações das decisões na lista de arquivos a alterar

**MUDANÇA IMPORTANTE**: com a decisão da Pendência 9, `emprestimoAjuste.js` **NÃO é removido**, mas seu conteúdo é **simplificado drasticamente**:

- `ajustarRecebiveisDeEmprestimo` permanece (linhas 24-98 do arquivo original). Mudança: **remove o split FIFO** (linhas 76-93) e mantém apenas a marcação `t._emprestimoEsconderNaLista = true` e zerar `t.valor`/`t.pagamentos[*].valor`. Sem cálculo de `principal`/`juros`. O `t._emprestimoInfo` deixa de ser populado (ou vira `null`).
- `calcularAjusteResumoPorEmprestimo` (linhas 114-145) é **REMOVIDO** junto com seu teste. Não é mais necessário (a compensação no `summary` é feita por outro mecanismo — ver Pendência 2).
- `emprestimoAjuste.test.js` (Bloco 1.b previa remoção) é **reescrito** com testes da nova semântica simples.

**Lista final de arquivos backend (atualizada):**

```
backend/src/models/emprestimo.js                                   [MODIFICAR]
backend/src/models/transacaoImportada.js                          [MODIFICAR]
backend/src/services/emprestimoService.js                         [MODIFICAR]
backend/src/utils/emprestimoAjuste.js                             [MODIFICAR — simplificar, não remover]
backend/src/utils/emprestimoQuitacao.js                           [MODIFICAR]
backend/src/utils/__tests__/emprestimoAjuste.test.js              [REESCREVER]
backend/src/utils/__tests__/emprestimoQuitacao.test.js            [REESCREVER]
backend/src/services/__tests__/emprestimoService.test.js          [REESCREVER]
backend/src/controllers/emprestimoController.js                   [MODIFICAR]
backend/src/controllers/controladorTransacao.js                   [MODIFICAR]
backend/src/controllers/importacaoController.js                   [MODIFICAR]
backend/src/controllers/transacaoImportadaController.js           [MODIFICAR]
backend/src/reportEngine/filterService.js                         [MODIFICAR]
backend/scripts/migrations/008-emprestimo-simplificacao.js        [CRIAR]
backend/scripts/migrations/README.md                              [ATUALIZAR]
```

**Total:** 15 arquivos backend (1 a criar, 1 a atualizar README, 13 a modificar). Removido da lista: `emprestimoAjuste.js` e `emprestimoAjuste.test.js` **não são deletados** — são modificados.

### Mudanças estruturais no modelo (consolidadas)

| Mudança | Origem | Migration? |
|---|---|---|
| Remover `direcao` do schema | Bloco 2 | Sim, 008 |
| Remover `direcao` do `EmprestimoConfigSchema` em `TransacaoImportada` | Bloco 2 | Sim, 008 |
| Remover `taxaJurosPercentual` do schema | Bloco 1 | Sim, 008 |
| Remover `valorJurosFixo` do schema | Bloco 1 | Sim, 008 |
| Simplificar `tipoRetorno` enum: `['valor_fixo', 'juros_percentual', 'juros_fixo', 'sem_juros']` → `['valor_fixo', 'sem_juros']` | Bloco 1 | Sim, 008 (normalizar docs antigos) |
| Mudar default de `tipoRetorno`: `'sem_juros'` → `'valor_fixo'` | Pendência 5 | Não (só default, sem impacto em dados) |
| Remover `DIRECOES` constante | Bloco 2 | Não (só constante JS) |
| Remover `TIPOS_RETORNO` (substituir por literal `['valor_fixo', 'sem_juros']`) | Bloco 1 | Não |
| Remover `CAMPOS_EDITAVEIS` (dead code) | Pendência 8 | Não (só constante JS) |

### Mudanças estruturais no algoritmo (consolidadas)

| Mudança | Origem | Comportamento |
|---|---|---|
| `lucro = soma_recebíveis - soma_gastos` (sem FIFO) | Bloco 1.b | Simples. |
| `recalcularStatus` sem auto-reversão | Bloco 2.b | Status não reverte `quitado → ativo` automaticamente. |
| `emprestimoAjuste.ajustarRecebiveisDeEmprestimo` sem split FIFO | Pendência 9 | Apenas marca `_emprestimoEsconderNaLista` e zera `valor`/`pagamentos`. |
| `emprestimoAjuste.calcularAjusteResumoPorEmprestimo` removido | Pendência 2 + 9 | Compensação do `summary` feita por outro mecanismo (a definir na FASE 4). |
| `emprestimoQuitacao.montarObservacao` com semântica nova | Bloco 1.b | Texto mais simples: "Lucro realizado do empréstimo para {pessoa}." |
| `emprestimoQuitacao.recalcularJurosAuto` aceita lucro ≤ 0 → deleta | Pendência 1 | Comportamento atual mantido. |
| Edição de `valorEsperadoRetorno` permitida com TXs ativas | Bloco 2.b | Sem travamento no controller. |

---

## Validação manual futura (preparação)

A FASE 7 do briefing original lista validações manuais. Como o briefing diz para não executar `browser-use` nesta tarefa, listo aqui os cenários a validar **depois** (quando o usuário for usar o sistema):

### Backend
1. **Migration 008:** rodar em cópia do banco de produção (ou ambiente de staging) antes de produção. Validar:
   - Empréstimos com `tipoRetorno: 'juros_*'` viraram `'valor_fixo'`.
   - Empréstimos com `direcao: 'recebido'` viraram `'concedido'`.
   - TXs de juros auto atualizadas/deletadas/criadas conforme o caso.
   - Logs sem erro.
2. **Endpoints:** `GET /emprestimos`, `GET /emprestimos/:id`, `POST /emprestimos`, `PUT /emprestimos/:id`, `POST /emprestimos/:id/cancelar`, `GET /emprestimos/:id/transacoes` continuam respondendo.
3. **Fluxo de quitação:** criar Empréstimo → vincular gasto → vincular recebimento que quita → verificar TX de juros auto.
4. **Fluxo de complemento:** criar Empréstimo → vincular gasto → editar `valorEsperadoRetorno` para somar mais → vincular mais gasto.
5. **Estorno:** estornar recebimento de Empréstimo quitado → verificar reversão.

### Frontend
1. **Lista de Empréstimos:** sem botão `+ Novo`, sem modal, cards continuam renderizando.
2. **Detalhe de Empréstimo:** breadcrumb mostra nome da pessoa, badge de desembolso aparece na lista, badge de recebimento aparece (sem split principal/juros).
3. **Form de TX:** aba "Avançado" → seção de Empréstimo funciona, criar/vincular.
4. **Importação:** marcar TI como Empréstimo durante revisão continua funcionando.
5. **Tratamento de 401:** simular token expirado e verificar redirecionamento para `/login`.

---

## Riscos remanescentes

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Migration 008 falha em dados não previstos | Média | Alto | Testar em cópia do banco antes; idempotência garante retry |
| Relatórios quebram por `filterService` | Média | Alto | Investigar `controladorRelatorio` na FASE 4 (Pendência 9) |
| Frontend quebra ao receber Empréstimo legado (migration ainda não rodou) | Baixa | Médio | Migration 008 idempotente e prioritária; rota de leitura pode ter fallback |
| TXs órfãs de cancelamento | Alta (cenário existente) | Baixo (não impede funcionalidade) | Bloco 4 fora de escopo; documentar para rodada futura |
| Default de `tipoRetorno` diverge entre schema e frontend | Baixa | Baixo | Pendência 5 — unificar na FASE 4 |
| `_emprestimoInfo` no frontend deixa de existir | Alta | Médio | Pendência 6 — definir novo formato do `emprestimoInfo` |
| `emprestimoEhJurosAuto` continua existindo (não muda) | — | — | Não há risco; campo é só backend |

---

## Arquivos finais a serem alterados

### Backend (15 arquivos)

```
backend/src/models/emprestimo.js                                          [MODIFICAR]
backend/src/models/transacaoImportada.js                                 [MODIFICAR]
backend/src/services/emprestimoService.js                                [MODIFICAR]
backend/src/utils/emprestimoAjuste.js                                    [MODIFICAR — simplificar]
backend/src/utils/emprestimoQuitacao.js                                  [MODIFICAR]
backend/src/utils/__tests__/emprestimoAjuste.test.js                     [REESCREVER]
backend/src/utils/__tests__/emprestimoQuitacao.test.js                   [REESCREVER]
backend/src/services/__tests__/emprestimoService.test.js                 [REESCREVER]
backend/src/controllers/emprestimoController.js                          [MODIFICAR]
backend/src/controllers/controladorTransacao.js                          [MODIFICAR]
backend/src/controllers/importacaoController.js                          [MODIFICAR]
backend/src/controllers/transacaoImportadaController.js                  [MODIFICAR]
backend/src/reportEngine/filterService.js                                [MODIFICAR]
backend/scripts/migrations/008-emprestimo-simplificacao.js               [CRIAR]
backend/scripts/migrations/README.md                                     [ATUALIZAR]
```

### Frontend (12 arquivos)

```
controle-gastos-frontend/src/utils/emprestimoFormat.js                   [MODIFICAR]
controle-gastos-frontend/src/components/Emprestimos/EmprestimoForm.js   [MODIFICAR]
controle-gastos-frontend/src/components/Emprestimos/EmprestimoSecao.js   [MODIFICAR]
controle-gastos-frontend/src/components/Emprestimos/EmprestimoBadge.js   [MODIFICAR]
controle-gastos-frontend/src/hooks/useEmprestimoForm.js                  [MODIFICAR]
controle-gastos-frontend/src/hooks/useTransacaoForm.js                  [MODIFICAR — remover código morto]
controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js [MODIFICAR]
controle-gastos-frontend/src/components/Transaction/EditarTransacaoItem.js [MODIFICAR]
controle-gastos-frontend/src/pages/Emprestimos/EmprestimosPage.js       [MODIFICAR]
controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js [MODIFICAR]
controle-gastos-frontend/src/api.js                                      [MODIFICAR]
controle-gastos-frontend/src/config/breadcrumbConfig.js                  [MODIFICAR — opcional]
```

**Total:** 15 arquivos backend + 12 arquivos frontend = **27 arquivos** (sendo 1 criação, 1 atualização de README, 25 a modificar, 0 remoções).

---

## Próximo passo

A FASE 3 está **completa** com todas as decisões resolvidas. Próxima fase do briefing: **FASE 4 — Implementação dos 8 blocos** (sequência sugerida abaixo).

### Sequência de implementação sugerida (FASE 4)

A ordem importa para minimizar estado quebrado entre fases:

1. **Migration 008 primeiro** (normaliza dados existentes): backend/scripts/migrations/008-emprestimo-simplificacao.js
2. **Bloco 1 (tipos de retorno):** backend models + frontend utils/forms
3. **Bloco 2 (direção):** backend models/controllers + frontend hooks/forms
4. **Bloco 1.b (revisão de quitação):** backend services + remover FIFO + simplificar TX auto
5. **Bloco 2.b (auto-reversão):** backend services (remover bloco)
6. **Bloco 5 (modal removido):** frontend EmprestimosPage
7. **Bloco 6 (UI novas, revisado):** apenas breadcrumb dinâmico + verificar setEmprestimoId(null)
8. **Bloco 7 (frontend cleanup):** useTransacaoForm código morto, unificar defaults, listarPessoas, badge desembolso, 401 em api.js
9. **Bloco 8 (infra):** atualizar README de migrations, remover listarPorPessoa
10. **Testes:** reescrever emprestimoService, emprestimoAjuste, emprestimoQuitacao
11. **Documentação:** atualizar AGENTS.md se houver menção a campos removidos

**Entrega:** Design doc consolidado em `.brain/sessions/2026-06-21-emprestimos-design.md` (FASE 4).
