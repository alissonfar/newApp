# Relatório de Auditoria Multi-Tenant — Validação Final

**Sistema:** Controle de Gastos (SaaS Multi-tenant)  
**Data:** Março 2026  
**Escopo:** Backend Node.js/Express/MongoDB + Frontend React

---

## 1. Resumo Executivo

Esta auditoria verifica o isolamento de dados entre usuários após a migração para arquitetura multi-tenant (campo `usuario`). O sistema possui base sólida de isolamento, com correções já aplicadas em vulnerabilidades críticas anteriores (mass assignment, processarArquivo). Foram identificadas **pendências de defesa em profundidade** e **um ponto de atenção** em código não utilizado.

---

## 2. Verificação 1 — Queries Multi-Tenant

### 2.1 Queries sem filtro `usuario` — Análise

| Arquivo | Linha | Modelo | Operação | Status |
|---------|-------|--------|----------|--------|
| `importacaoOFXController.js` | 33 | ImportacaoOFX | findById | **Defesa em profundidade** — documento recém-criado pelo usuário; ideal usar `findOne({ _id, usuario: req.userId })` |
| `subcontaController.js` | 105, 134, 239 | Subconta | findById | **Defesa em profundidade** — documento vem de operação do usuário; ideal `findOne({ _id, usuario })` |
| `transferenciaController.js` | 60, 179 | Transferencia | findById | **Defesa em profundidade** — mesmo caso da subconta |
| `ledgerService.js` | 107 | LedgerPatrimonial | findOne | **Atenção** — `existeEventoParaReferencia` não filtra por `usuario`. Função **não é chamada** (código morto). Se for reutilizada, deve incluir `usuario` |
| `importacaoController.js` | 256 | TransacaoImportada | find | **Defesa em profundidade** — importação já validada com `usuario`; adicionar `usuario: req.userId` no filtro |
| `importacaoOFXService.js` | 266 | TransacaoOFX | find | **Defesa em profundidade** — importação validada; adicionar `usuario: usuarioId` no filtro |

### 2.2 Queries corretas (com `usuario`)

- **controladorTag.js** — Todas as operações usam `usuario: req.userId`
- **controladorModeloRelatorio.js** — Todas usam `usuario: req.userId`
- **controladorTransacao.js** — `match` inclui `usuario: req.userId`
- **controladorCategoria.js** — Todas usam `usuario: req.userId`
- **subcontaController.js** — find/findOne incluem `usuario: req.userId` (exceto findById pós-criação)
- **importacaoController.js** — Importacao e Subconta validados com `usuario`
- **importacaoService.js** — processarArquivo recebe `usuarioId` e valida `Importacao.findOne({ _id, usuario: usuarioId })`
- **settlementService.js** — Todas as queries incluem `usuario: usuarioId`
- **vinculoService.js** — Queries incluem `usuario: usuarioId`
- **movimentacaoInternaService.js** — Transferencia.find inclui `usuario: usuarioId`

### 2.3 Modelos não multi-tenant (uso correto)

- **Usuario** — findById, findOne em controladorUsuario, adminController, autenticacao
- **TaxaCDI** — Coleção global (dados compartilhados)
- **Backup** — Admin-only; listagem por `operation: 'backup'`

---

## 3. Verificação 2 — Aggregations

Todas as pipelines verificadas incluem `$match` com `usuario` no início:

| Arquivo | Modelo | Pipeline |
|---------|--------|----------|
| `tagInsightsService.js` | Transacao | `$match: { usuario: userObjectId, status: 'ativo' }` |
| `ledgerService.js` | LedgerPatrimonial | `$match: { subconta, usuario }` |
| `patrimonioService.js` | HistoricoSaldo | `$match` inclui `usuario: usuarioId` |
| `settlementService.js` | Transacao | `match` inclui `usuario` |
| `vinculoService.js` | Transacao | `match` inclui `usuario: usuarioId` |
| `netWorthService.js` | LedgerPatrimonial | `match` inclui `usuario` |
| `controladorTransacao.js` | Transacao | `buildMatchStage` inclui `usuario` |
| `reportEngine/filterService.js` | Transacao | `buildMatchFromFilters` inclui `usuario: userId` |

---

## 4. Verificação 3 — Serviços Internos

| Serviço | Assinatura | Validação |
|---------|------------|-----------|
| `importacaoService.processarArquivo` | `(importacaoId, usuarioId)` | `Importacao.findOne({ _id, usuario: usuarioId })` |
| `importacaoOFXService.processarArquivoOFX` | Recebe `req.userId` no controller | Subconta validada com `usuario` |
| `ledgerService.registrarEvento` | Recebe `usuarioId` | Usa em documento e queries |
| `ledgerService.calcularSaldoPorLedger` | `(subcontaId, usuarioId, ateData)` | `$match: { subconta, usuario }` |
| `settlementService.*` | Recebe `usuarioId` em todas as funções | Queries incluem `usuario` |
| `vinculoService.*` | Recebe `usuarioId` | Queries incluem `usuario` |

---

## 5. Verificação 4 — Índices do Banco

### 5.1 Índices compostos com `usuario` (corretos)

| Modelo | Índice |
|--------|--------|
| Categoria | `{ nome: 1, usuario: 1 }` unique, `{ usuario: 1, codigo: 1 }` unique |
| Tag | `{ nome: 1, usuario: 1 }` unique, `{ usuario: 1, codigo: 1 }` unique |
| Subconta | `{ usuario: 1, instituicao: 1, nome: 1 }` unique |
| Instituicao | `{ usuario: 1, nome: 1 }` unique |
| VinculoConjunto | `{ usuario: 1, nome: 1 }` unique |
| Transacao | Vários com `usuario` como prefixo |
| LedgerPatrimonial | `{ usuario: 1 }`, `{ usuario: 1, dataEvento: 1 }` |

### 5.2 Índices globais (justificados)

| Modelo | Índice | Justificativa |
|--------|--------|---------------|
| Usuario | `email` unique | Usuario não é multi-tenant |
| TaxaCDI | `data` unique | Coleção global |
| LedgerPatrimonial | `{ referenciaTipo, referenciaId }` sparse | Deduplicação; `existeEventoParaReferencia` não inclui usuario (ver seção 2.1) |
| Settlement | `receivingTransactionId`, `appliedTransactions.transactionId` | Lookups; Settlement já filtrado por usuario nas queries |

---

## 6. Verificação 5 — Mass Assignment

| Controller | Campo | Status |
|------------|-------|--------|
| controladorUsuario.atualizarPerfil | Whitelist `CAMPOS_PERMITIDOS` (nome, fotoPerfil, telefone, etc.) | OK |
| controladorTag, controladorCategoria | Atribuição explícita campo a campo | OK |
| subcontaController | Atribuição explícita com validação de tipos | OK |
| transacaoImportadaController | Campos mapeados explicitamente; `body: req.body` repassado ao service com validação de importação | OK (importação validada com usuario) |
| controladorTransacao | Campos extraídos e validados | OK |

---

## 7. Verificação 6 — Rotas de Teste

| Rota | Proteção |
|------|----------|
| `POST /api/email/teste` | Retorna 404 em `NODE_ENV=production` |

Nenhuma rota `/test`, `/debug` ou `/dev` exposta em produção.

---

## 8. Verificação 7 — Autenticação

- Todas as rotas de dados usam `router.use(autenticacao)` antes dos handlers
- Rotas públicas: `registrar`, `login`, `verificar-email`, `reenviar-verificacao`, `esqueci-senha`, `redefinir-senha`
- `req.userId` populado pelo middleware a partir do JWT (`decoded.userId`)
- Admin: `router.use(autenticacao, isAdmin)` em adminRoutes

---

## 9. Verificação 8 — Frontend

- **api.js** (axios): Interceptor adiciona `Authorization: Bearer ${token}` em todas as requisições
- Token obtido de `localStorage.getItem('token')`
- Endpoints consumidos (Dashboard, Relatórios, Insights, Transações, Tags) passam por rotas autenticadas
- Dados recebidos são usados no escopo do componente/hook; não há armazenamento global sem contexto de usuário

---

## 10. Verificação 9 — Migração de Dados

- **004-categoria-tag-indices-multi-tenant.js**: Remove índice global `codigo_1`, cria `{ usuario: 1, codigo: 1 }` unique. Não altera dados.
- **001-add-default-user-role.js**, **002-historico-saldo-tipo.js**, **003-ledger-snapshot-inicial.js**: Migrações de schema/índices; não populam `usuario` em massa.

**Recomendação:** Executar verificação lógica em produção antes do go-live:

```javascript
// Exemplo para contar documentos sem usuario em coleções multi-tenant
db.transacoes.countDocuments({ usuario: { $exists: false } })
db.categorias.countDocuments({ usuario: { $exists: false } })
db.tags.countDocuments({ usuario: { $exists: false } })
// ... demais coleções
```

---

## 11. Verificação 10 — Teste de Isolamento Lógico

**Fluxo validado:**

1. Usuário A autenticado → `req.userId = A`
2. Todas as queries usam `usuario: A` ou `usuario: req.userId`
3. Usuário B com ID de recurso de A não consegue acessar: `findOne({ _id: idB, usuario: A })` retorna null
4. Atualização/deleção: filtros incluem `usuario`, então `updateOne`/`deleteOne` em recurso de outro usuário não afetam linhas

**Exceções identificadas (defesa em profundidade):**

- `findById` após criar documento: teoricamente seguro (documento é do usuário), mas `findOne({ _id, usuario })` reforça isolamento
- `TransacaoImportada.find` e `TransacaoOFX.find` sem `usuario`: importação já validada; adicionar `usuario` é defesa em profundidade

---

## 12. Problemas Encontrados

### Críticos

Nenhum. Vulnerabilidades críticas anteriores (mass assignment, processarArquivo) foram corrigidas.

### Médios (defesa em profundidade)

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | `importacaoOFXController.js:33` | Trocar `findById` por `findOne({ _id, usuario: req.userId })` após upload |
| 2 | `importacaoController.js:256` | Adicionar `usuario: req.userId` em `TransacaoImportada.find` |
| 3 | `importacaoOFXService.js:266` | Adicionar `usuario: usuarioId` em `TransacaoOFX.find` |
| 4 | `subcontaController.js` | Trocar `findById` por `findOne({ _id, usuario: req.userId })` nas linhas 105, 134, 239 |
| 5 | `transferenciaController.js` | Trocar `findById` por `findOne({ _id, usuario: req.userId })` nas linhas 60, 179 |

### Baixos (código morto / melhoria)

| # | Arquivo | Descrição |
|---|---------|-----------|
| 6 | `ledgerService.js:105` | `existeEventoParaReferencia` não é chamada. Se for reutilizada, incluir `usuario` no filtro ou remover |
| 7 | `transacaoImportadaController.js:81` | Remover `console.log('[DEBUG] Pagamentos recebidos:')` antes de produção |

---

## 13. Melhorias Recomendadas

1. **Script de verificação pós-migração:** Contar documentos sem `usuario` em coleções multi-tenant
2. **Testes de isolamento:** Testes automatizados que simulam dois usuários e verificam que A não acessa dados de B
3. **Documentação:** Manter lista de modelos multi-tenant e convenção de sempre incluir `usuario` em queries

---

## 14. Avaliação Final

| Critério | Status |
|----------|--------|
| Queries multi-tenant | Maioria correta; pendências de defesa em profundidade |
| Aggregations | OK |
| Serviços internos | OK |
| Índices | OK |
| Mass assignment | OK (whitelist em perfil) |
| Rotas de teste | OK (email/teste desabilitada em produção) |
| Autenticação | OK |
| Frontend | OK (token enviado) |
| Migrações | OK (índices; verificar dados legados) |

---

## 15. Classificação Final

### Status: **READY FOR PRODUCTION** (com ressalvas)

**Justificativa:**

O sistema está **estruturalmente seguro** para multi-tenant:

- Todas as rotas sensíveis exigem autenticação
- Queries principais filtram por `usuario`
- `processarArquivo` e `atualizarPerfil` foram corrigidos
- Índices compostos com `usuario` estão corretos
- Aggregations incluem `$match` com `usuario`

As pendências identificadas são de **defesa em profundidade** (findById → findOne com usuario, filtros adicionais em find). Não representam vazamento ativo nas condições atuais, mas devem ser tratadas em uma próxima iteração para maior robustez.

**Antes do go-live em produção:**

1. Executar verificação de documentos sem `usuario` nas coleções multi-tenant
2. (Opcional) Aplicar correções de defesa em profundidade listadas na seção 12
3. Remover `console.log` de debug em `transacaoImportadaController.js`

---

*Relatório gerado por auditoria técnica automatizada. Revisão manual recomendada para cenários específicos de negócio.*
