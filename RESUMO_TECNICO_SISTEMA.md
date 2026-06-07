# Resumo Técnico Estruturado — Sistema de Controle de Gastos

> Documento de contexto base para planejamento de novas funcionalidades por IA.

---

## 1️⃣ Visão Geral do Sistema

| Aspecto | Descrição |
|---------|-----------|
| **Nome** | Sistema de Controle de Gastos |
| **Objetivo principal** | Gerenciamento de transações financeiras pessoais e compartilhadas, com suporte a múltiplos participantes por transação, um proprietário definido, contas conjuntas (divisão de gastos com participante e acertos), patrimônio (instituições, subcontas, histórico, OFX, transferências, simulador CDI), empréstimos (concedidos/recebidos com juros e parcelamento) e relatórios avançados. |
| **Público-alvo** | Usuários que precisam controlar gastos e recebíveis, com divisão por pessoa (participantes), filtro por proprietário, controle patrimonial multi-conta, e gestão de empréstimos a pessoas. |
| **Problema que resolve** | Centralização e organização de transações financeiras, conciliação de recebimentos com gastos, importação em massa (CSV/JSON, OFX, fatura Nubank), relatórios customizáveis, controle de parcelamentos, gestão de patrimônio (contas bancárias, subcontas, evolução, rendimento CDI), controle de empréstimos e divisão de gastos em contas conjuntas. |

---

## 2️⃣ Arquitetura Técnica

### Estrutura geral
- **Frontend**: SPA React (porta 3004)
- **Backend**: API REST Node.js/Express (porta 3001)
- **Mobile**: Não informado (apenas web responsiva)

### Tecnologias utilizadas

| Camada | Stack |
|--------|-------|
| **Frontend** | React 19, React Router 7, MUI 6, Chart.js (react-chartjs-2 5), React Calendar 5, Axios 1.8, Tailwind CSS 4, jsPDF 3 + jspdf-autotable, @react-pdf/renderer 4, SweetAlert2 11, React Toastify 11, react-select 5, react-icons 5, date-fns 4, decimal.js 10 |
| **Backend** | Node.js, Express 4.18, Mongoose 8.2, mongoose-paginate-v2 |
| **Banco de dados** | MongoDB (com replica set para transações) |
| **Autenticação** | JWT (jsonwebtoken 9), bcrypt 5 / bcryptjs 2 |
| **Email** | Nodemailer 6 (Gmail) |
| **Upload/Parse** | Multer 1.4 (10MB para importações e OFX; 5MB para foto de perfil; 500MB para restore), csv-parse 5, xlsx 0.18, xml2js 0.6, iconv-lite 0.6, chardet 2 |
| **Precisão numérica** | decimal.js 10 (backend e frontend) |
| **Cálculo financeiro** | `src/services/financial.service.js` (juros compostos, conversões anual↔mensal↔diária) |

### Padrão arquitetural
- **Backend**: Estrutura em camadas (routes → controllers → services → models).
- **Backend report engine**: módulo dedicado `src/reportEngine/` com `filterService`, `ruleEngine`, `aggregator`, `reportTemplates`, `types` (separação de responsabilidades).
- **Backend parsers**: módulo dedicado `src/services/parsers/` com parsers especializados por formato de arquivo, detecção automática via score.
- **Frontend**: Componentes funcionais + Context API (`AuthProvider > DataProvider > BreadcrumbProvider > ImportacaoProvider`).
- **Não segue Clean Architecture formal**; organização modular por domínio.

### Endpoints da API (montados em `backend/src/app.js`)

| Prefixo | Recurso |
|---------|---------|
| `/api/usuarios` | Registro, login, verificação de email, redefinição de senha, perfil, foto |
| `/api/transacoes` | CRUD, export, bulk, distinct-pessoas, preview-parcelas, grupo, estornar, reativar |
| `/api/dashboard` | tag-insights |
| `/api/tags` | CRUD de tags |
| `/api/categorias` | CRUD de categorias (ativar/inativar) |
| `/api/email` | Teste de envio (somente dev) |
| `/api/importacoes` | CRUD importações, preview, finalizar, estornar; ações em TransacaoImportada |
| `/api/admin` | Backup/restore, gerenciamento de usuários |
| `/api/reports` | Relatórios avançados (`POST /advanced`, `GET /templates`) e modelos (`/api/modelos-relatorio`) |
| `/api/settlements` | Conciliação de recebimentos com gastos |
| `/api/taxa-cdi` | Taxa CDI atual |
| `/api/instituicoes` | CRUD instituições financeiras |
| `/api/subcontas` | CRUD, histórico, rendimento estimado, confirmar saldo, eventos-ledger, saldo-ledger |
| `/api/patrimonio/importacoes-ofx` | Upload/revisão/finalização OFX, sugestões de transferência |
| `/api/patrimonio/transferencias` | CRUD transferências entre subcontas, confirmar |
| `/api/patrimonio` | Resumo e evolução patrimonial |
| `/api/net-worth` | Patrimônio em data, histórico de evolução |
| `/api/vinculos-conjuntos` | CRUD vínculos, saldo, resumo, extrato, transações, acertos |
| `/api/acertos` | Estorno de acertos |
| `/api/pessoas` | CRUD de pessoas (vinculadas a Empréstimos) |
| `/api/emprestimos` | CRUD de empréstimos, listagem por pessoa, transações do empréstimo, cancelar |

### Estratégia de autenticação
- JWT com validade configurável (padrão: 1 dia via `JWT_EXPIRES`).
- Token armazenado em `localStorage` no frontend (chave `token`).
- Middleware `autenticacao` em todas as rotas protegidas.
- Middleware `isAdmin` para `/api/admin/*`.
- Verificação de email obrigatória (`emailVerificado`) — `PrivateRoute` redireciona para `/email-nao-verificado`.
- Tokens de verificação de email (24h) e redefinição de senha (1h).
- Foto de perfil: upload via `POST /api/usuarios/perfil/foto` (jpeg/png, máx 5MB).
- Atualização de email e senha por rotas dedicadas (`PUT /perfil/senha`, `PUT /perfil/email`).
- Axios interceptor (frontend): em 401, lê `error.response.data.redirectUrl` ou cai em `/login`.

### Estratégia offline
- **Não implementada**. Existe apenas `manifest.json` genérico (PWA metadata) sem Service Worker ou cache offline.

### Migrações (`backend/scripts/migrations/`)
Execução: `node scripts/migrations/NNN-name.js` (ou `--production` em PowerShell `$env:NODE_ENV="production"`).

| # | Script | Função |
|---|--------|--------|
| 001 | `add-default-user-role.js` | Adiciona `role: 'comum'` em usuários sem role |
| 002 | `historico-saldo-tipo.js` | Adiciona `tipo="ajuste"` em `HistoricoSaldo` |
| 003 | `ledger-snapshot-inicial.js` | Cria eventos `snapshot_inicial` no `LedgerPatrimonial` para subcontas existentes |
| 004 | `categoria-tag-indices-multi-tenant.js` | Substitui índice único global de `codigo` por índice composto `{usuario, codigo}` em Categoria/Tag |
| 005 | `parcelamento-por-pagamento.js` | Popula `parentTransactionId` e campos de parcelamento por pagamento (retrocompatibilidade) |
| 006 | `emprestimo-transacao-importada.js` | Adiciona `emprestimoId` e `emprestimoConfig` em `TransacaoImportada` + índices sparse |

### Integrações externas
- **Email**: Nodemailer (Gmail) para verificação de email, redefinição de senha e teste (rota `/api/email/teste` desabilitada em produção).
- **MongoDB**: Conexão via `DB_URI`; suporte a transações MongoDB (requer replica set).
- **Taxa CDI**: API BCB (api.bcb.gov.br) para obter taxas CDI diária/mensal/anual; `TaxaCDI` é uma coleção global (não por usuário); `taxaCDIService` faz a busca/atualização; `GET /api/taxa-cdi/atual` retorna a última.
- **Health check**: `GET /api/health` verifica conexão MongoDB e suporte a transações/replica set.
- **Simulador CDI**: `financial.service.js` aplica fórmula de juros compostos a partir da taxa anual BCB.

---

## 3️⃣ Estrutura de Módulos

### Módulo de Usuários
- **Responsabilidade**: Registro, login, perfil (foto, telefone, data de nascimento, gênero, biografia, cargo, empresa, redes sociais), preferências (tema, proprietário, moeda, notificações, categoria de cartão de crédito, tag padrão de recebimento/remoção), verificação de email, redefinição de senha.
- **Entidades**: Usuario
- **Fluxos**: Registro → Verificação de email → Login; Esqueci senha → Token → Redefinir senha; Editar perfil/foto/senha/email/preferências
- **Dependências**: Nenhuma (base do sistema)

### Módulo de Transações
- **Responsabilidade**: CRUD, parcelamento (legado e por pagamento), estorno individual/grupo/parcelamento, bulk create, export, reativação, preview de parcelas (GET/POST), filtros por proprietário, vincular a subconta e/ou empréstimo, marcação de conta conjunta, inferência de pessoa e duplicatas no upload.
- **Entidades**: Transacao, Pagamento (subdocumento)
- **Fluxos**: Criar/Editar/Estornar/Reativar; Preview de parcelas; Export; Vincular a subconta, empréstimo e/ou conta conjunta
- **Dependências**: Usuario, Categoria, Tag, Subconta, Emprestimo, VinculoConjunto, AcertoConjunto

### Módulo de Categorias
- **Responsabilidade**: CRUD (ativar/inativar, soft delete); multi-tenant por usuário.
- **Entidades**: Categoria
- **Fluxos**: Criar, editar, ativar/inativar, excluir
- **Dependências**: Usuario

### Módulo de Tags
- **Responsabilidade**: CRUD, vínculo a categoria (ObjectId), aplicação em pagamentos, flag `mostrarNoDashboard` para insights; multi-tenant.
- **Entidades**: Tag
- **Fluxos**: Criar, editar, associar a categoria, exibir no dashboard
- **Dependências**: Usuario, Categoria

### Módulo de Importação em Massa
- **Responsabilidade**: Upload de CSV/JSON/XLSX, detecção automática de parser (Nubank fatura, Nubank extrato, CSV genérico, JSON), pré-visualização (sem persistir), classificação (novas/já importadas/possíveis duplicatas/ignoradas), revisão, validação individual e em massa, finalização, estorno; suporte a parcelamento expandido na importação; inferência de pessoa responsável; sugestão de tag mensal para fatura de cartão de crédito; detecção de nº complementar (Nubank fatura).
- **Entidades**: Importacao, TransacaoImportada
- **Fluxos**: Upload → Preview (analisar, configurar, inferir metadados) → Criar Importacao → Processamento assíncrono → Revisão (editar, validar, ignorar) → Finalizar (cria Transacao) → Estornar (reverte Transacao)
- **Dependências**: Usuario, Transacao, Categoria, Tag, Subconta, Emprestimo, VinculoConjunto, AcertoConjunto, ImportacaoService, InferenciaImportacaoService, InferenciaPessoaService, Parsers (nubankFatura, nubankExtrato, genericoCSV, jsonParser)

### Módulo de Recebimentos (Settlement/Conciliação)
- **Responsabilidade**: Conciliação de recebíveis com gastos; aplicação de tag em gastos quitados; geração de transação de sobra; remoção de tag ao reverter (removeTagId, removedTagLog).
- **Entidades**: Settlement
- **Fluxos**: Selecionar recebimento → Selecionar gastos → Aplicar tag → Criar settlement; Listar pendentes/recebimentos disponíveis/histórico; Excluir settlement (reverte alterações)
- **Dependências**: Transacao, Tag, Usuario

### Módulo de Relatórios
- **Responsabilidade**: Motor de relatórios dedicado (`src/reportEngine/`) com filtros avançados, regras por tag (add/subtract/ignore/custom), agregações (default/devedor), templates built-in (simples, devedor) e modelos customizados por usuário. Ajusta recebíveis vinculados a empréstimos concedidos (não conta como gasto). Exporta dados para PDF no frontend (jsPDF/jspdf-autotable).
- **Entidades**: ModeloRelatorio
- **Endpoints**: `POST /api/reports/advanced`, `GET /api/reports/templates`, CRUD `/api/modelos-relatorio/*`
- **Fluxos**: Selecionar template (built-in ou modelo-{id}) → Aplicar filtros (data, tipo, pessoas, excludePessoas, tags, busca, ordenação) → Gerar relatório (JSON) → Export PDF no frontend
- **Dependências**: Transacao, Tag, ModeloRelatorio, Emprestimo (ajuste), Pagamento

### Módulo de Administração
- **Responsabilidade**: Backup (mongodump ou lógico), restore via upload, gerenciamento de usuários (listar paginado, ver detalhes, resetar senha, verificar email, alterar role/status).
- **Entidades**: Backup
- **Endpoints**: `/api/admin/backup*`, `/api/admin/usuarios*`
- **Fluxos**: Gerar backup → Download; Restaurar via upload; Listar usuários; Ações em usuários
- **Dependências**: Usuario, todos os modelos para restore

### Módulo de Patrimônio
- **Responsabilidade**: Instituições financeiras (bancos digitais, tradicionais, corretoras, carteiras), subcontas (corrente, rendimento automático, caixinha, investimento fixo) com propósito (disponível, reserva, objetivo, guardado), histórico de saldo, confirmação de saldo, **evolução patrimonial**, **rendimento estimado (CDI)** com taxa BCB, **Simulador de Rendimentos** (juros compostos CDI), importações OFX com movimentação interna, transferências entre subcontas, **Ledger Patrimonial** (eventos append-only) e cálculo de patrimônio em data (netWorth).
- **Entidades**: Instituicao, Subconta, HistoricoSaldo, LedgerPatrimonial, TaxaCDI
- **Endpoints**: `/api/instituicoes`, `/api/subcontas/*` (com `/historico`, `/rendimento-estimado`, `/eventos-ledger`, `/saldo-ledger`, `/confirmar-saldo`), `/api/patrimonio/resumo`, `/api/patrimonio/evolucao`, `/api/patrimonio/importacoes-ofx/*`, `/api/patrimonio/transferencias/*`, `/api/taxa-cdi/atual`, `/api/net-worth/at-date`, `/api/net-worth/history`
- **LedgerPatrimonial**: Camada de eventos append-only que registra todas as alterações de saldo (deltas). `TIPOS_EVENTO`: `deposito, saque, transferencia_saida, transferencia_entrada, rendimento, aporte, importacao_ofx, importacao_csv, ajuste_manual, snapshot_inicial, correcao`. `ORIGENS_SISTEMA`: `subconta_criacao, confirmacao_manual, importacao_ofx, importacao_csv, transferencia, correcao`. Deduplicação por `(referenciaTipo, referenciaId, subconta)` unique sparse. API: `GET /subcontas/:id/eventos-ledger`, `GET /subcontas/:id/saldo-ledger`. Frontend: seção "Eventos do Ledger (Auditoria)" em `DetalheSubcontaPage` com indicador de consistência.
- **Fluxos**: CRUD Instituição → CRUD Subconta (com `percentualCDI`) → Confirmar saldo (cria HistoricoSaldo + LedgerPatrimonial) → Resumo/evolução; Importar OFX por subconta; Transferências; Simulador; netWorth usa Ledger como fonte de verdade para patrimônio em data
- **Dependências**: Usuario, Transacao (vinculação opcional), TaxaCDI, Transferencia, ImportacaoOFX

### Módulo de Importação OFX
- **Responsabilidade**: Upload de extratos OFX/QFX (formato bancário), parse XML (xml2js), detecção automática de movimentação interna por padrão de MEMO (Caixinha, Resgate, Aporte, Transferência), sugestões de vínculo com Transferência pendente, criação de `TransacaoOFX` por linha (deduplicação por `fitid+subconta`), revisão, aprovação/ignorar, conversão em Transacao.
- **Entidades**: ImportacaoOFX, TransacaoOFX
- **Fluxos**: Upload OFX → Parse → Cria TransacaoOFX → Revisão → Aprovar (cria Transacao e/ou HistoricoSaldo) ou Ignorar; Movimentação interna: detecta padrões e sugere vínculo com Transferência pendente. Finalização: cria um evento `LedgerPatrimonial` para CADA TransacaoOFX aprovada (pendente/aprovada, exceto vinculadas a transferência); crédito→deposito, débito→saque; se soma ≠ delta, cria evento `correcao`.
- **Dependências**: Usuario, Subconta, Transacao, HistoricoSaldo, LedgerPatrimonial, Transferencia, MovimentacaoInternaService

### Módulo de Transferências
- **Responsabilidade**: Transferências entre subcontas do mesmo usuário; status pendente → concluída; vinculação opcional com TransacaoOFX (movimentação interna).
- **Entidades**: Transferencia
- **Endpoints**: `/api/patrimonio/transferencias`
- **Fluxos**: Criar transferência (subcontaOrigem ≠ subcontaDestino, valor, data) → Listar por status → Confirmar (gera eventos no Ledger); TransacaoOFX pode vincular-se a uma Transferência pendente
- **Dependências**: Usuario, Subconta, TransacaoOFX, LedgerPatrimonial

### Módulo de Conta Conjunta (Vínculos Conjuntos)
- **Responsabilidade**: Contas compartilhadas entre o usuário e um participante (ex.: namorado(a), colega de apartamento); divisão de gastos (`parteUsuario`/`parteOutro`), saldo pendente e acertos (quitação FIFO), com dois tipos de acerto (`compensacao` padrão e `pagamento_individual` com `ladoAfetado`).
- **Entidades**: VinculoConjunto, AcertoConjunto; Transacao.contaConjunta (subdocumento)
- **Endpoints**: `/api/vinculos-conjuntos/*` (CRUD, saldo, resumo, extrato, transações, acertos), `/api/acertos/:id` (estornar)
- **Fluxos**: Criar vínculo → Criar transação marcando "conta conjunta" (vinculoId, pagoPor, valorTotal, parteUsuario, parteOutro) → Visualizar saldo/resumo/extrato → Registrar acerto (valor, direcao: recebi/paguei, data, tipo, ladoAfetado) → Acerto aplica FIFO; Estornar acerto
- **Dependências**: Usuario, Transacao (campo `contaConjunta` opcional)

### Módulo de Pessoas
- **Responsabilidade**: Cadastro de pessoas (nome único por usuário) usadas como contraparte em Empréstimos. Contato e observações opcionais. Soft delete bloqueado se houver empréstimos ativos.
- **Entidades**: Pessoa
- **Endpoints**: `/api/pessoas`
- **Fluxos**: CRUD; Excluir (soft delete, bloqueia se há empréstimos ativos)
- **Dependências**: Usuario, Emprestimo

### Módulo de Empréstimos
- **Responsabilidade**: Gestão de empréstimos concedidos ou recebidos, com tipos de retorno (`valor_fixo`, `juros_percentual`, `juros_fixo`, `sem_juros`), cálculo FIFO de principal/juros, criação automática de transação de juros ao quitar, recálculo de status (ativo ↔ quitado), cancelamento, listagem por status/pessoa, breakdown de principal vs juros nas transações vinculadas.
- **Entidades**: Emprestimo; Transacao.emprestimoId / `emprestimoEhJurosAuto`; TransacaoImportada.emprestimoId / emprestimoConfig
- **Endpoints**: `/api/emprestimos` (listar, criar, atualizar, cancelar, obter, listarTransacoes)
- **Lógica de relatórios**: transações com `emprestimoId` em empréstimos **concedidos** são zeradas e marcadas como `_emprestimoEsconderNaLista` no pipeline do report engine (`utils/emprestimoAjuste.js`); a compensação é feita pela transação de juros auto-criada.
- **Fluxos**: Criar (pessoaId, direcao, valorEsperadoRetorno, tipoRetorno, prazoFinal) → Vincular transações (gastos como desembolso, recebíveis como retorno) → Cálculo automático de status ao atingir valor esperado → Criação de transação de juros auto (idempotente: criar/atualizar/deletar) → Cancelar empréstimo (reverte juros, se houver)
- **Dependências**: Usuario, Pessoa, Transacao, VinculoConjunto (não diretamente), ReportEngine (ajuste)

### Módulo de Insights
- **Responsabilidade**: Insights por tag (total consolidado e quantidade de pagamentos) para tags marcadas com `mostrarNoDashboard`. Cards exibidos no Home.
- **Entidades**: Tag (`mostrarNoDashboard`), Transacao
- **Endpoints**: `GET /api/dashboard/tag-insights`
- **Fluxos**: `tagInsightsService.calcularTagInsights` → GET → renderiza cards no Home; página dedicada `/insights` é placeholder
- **Dependências**: Usuario, Tag, Transacao

### Módulo de Email
- **Responsabilidade**: Envio de emails (verificação, redefinição de senha). Rota de teste `/api/email/teste` desabilitada em produção.
- **Fluxos**: Enviar templates (boasVindas, emailVerificacao, redefinicaoSenha)
- **Dependências**: Nodemailer (Gmail)

### Módulo de HowToUse (Tutorial)
- **Responsabilidade**: Página estática `/como-utilizar` com guia passo a passo do sistema. Não tem backend dedicado.
- **Dependências**: Nenhuma

---

## 4️⃣ Modelagem de Dados

### Principais entidades

| Entidade | Campos |
|----------|--------|
| **Usuario** | nome, email (único), senha (hash), emailVerificado, tokens de verificação/redefinição, fotoPerfil, telefone, dataNascimento, genero, biografia, cargo, empresa, redesSociais (linkedin/twitter/instagram), preferencias (tema, moedaPadrao, notificacoes{email,push}, proprietario, categoriaCartaoCreditoId, tagReceberPadraoId, tagRemoverPadraoId), ultimoAcesso, status (ativo/inativo/bloqueado), role (admin/pro/comum) |
| **Transacao** | tipo (gasto/recebivel), descricao, valor, data, observacao, pagamentos[], status (ativo/estornado), usuario, deduplicationKey, **parentTransactionId**, **campos de parcelamento (legado e por pagamento)**, settlementAsSource, settlementApplied, settlementLeftoverFrom, subconta (opcional), contaConjunta (ativo, vinculoId, pagoPor, valorTotal, parteUsuario, parteOutro, acertadoEm), **emprestimoId (opcional)**, **emprestimoEhJurosAuto (bool)** |
| **Pagamento** | pessoa, valor, tags (`{ categoriaId: [tagIds] }`), **parcelamento (sub-schema: ativo, quantidade, intervaloDias)**, **installmentNumber, installmentTotal, installmentGroupId** |
| **Categoria** | codigo, nome, descricao, cor, icone, ativo, usuario |
| **Tag** | codigo, nome, descricao, categoria (ObjectId), cor, icone, ativo, **mostrarNoDashboard**, usuario |
| **Importacao** | descricao, status (pendente/processando/validado/finalizada/estornada/erro), nomeArquivo, caminhoArquivo, totalProcessado/Sucesso/Erro/Ignoradas, totalEsperado, totalPossiveisDuplicatas, totalCreditos, totalDebitos, tagsPadrao, tipoImportacao (normal/complementar), **origem, dataInicial, dataFinal, periodoCompetencia, metadadosInferidos, vencimento, mesVencimento, numeroComplemento, tagSugeridaId, categoriaSugeridaId**, erros, usuario |
| **TransacaoImportada** | importacao, descricao, valor, data, categoria, tipo, status (`pendente/revisada/validada/erro/ja_importada/possivel_duplicata/processada/estornada/ignorada`), erro, **pagamentos com parcelamento**, **observacao**, dadosOriginais, deduplicationKey, transacaoCriada, **transacaoSemelhante* (possível duplicata)**, **pessoaSugerida* (sugestão automática)**, campos de parcelamento, **parentTransactionId**, usuario, subconta, **emprestimoId, emprestimoConfig (sub-schema), emprestimoProcessado, emprestimoIdOrigemCriado**, **contaConjunta** |
| **Settlement** | usuario, receivingTransactionId, appliedTransactions[] (transactionId, amountApplied, pagamentoIndex), tagId, removeTagId, removedTagLog, totalApplied, leftoverAmount, leftoverTransactionId |
| **ModeloRelatorio** | nome, descricao, **aggregation (`default`/`devedor`)**, regras[] (tag ObjectId + effect: add/subtract/ignore), usuario, ativo |
| **Backup** | filename, size, type (mongodump/logical), operation, createdBy, status, errorMessage |
| **Instituicao** | usuario, nome, tipo (`banco_digital/banco_tradicional/carteira_digital/corretora`), cor, icone, ativo |
| **Subconta** | usuario, instituicao, nome, tipo (`corrente/rendimento_automatico/caixinha/investimento_fixo`), proposito (`disponivel/reserva_emergencia/objetivo/guardado`), rendimento (sub-schema `percentualCDI`), **percentualCDI (campo direto)**, saldoAtual, dataUltimaConfirmacao, meta, ativo |
| **HistoricoSaldo** | usuario, subconta, saldo, data, origem (manual/importacao_ofx/importacao_csv), **tipo (com 'ajuste')**, observacao |
| **LedgerPatrimonial** | usuario, subconta, dataEvento, valor (delta), **tipoEvento** (`deposito/saque/transferencia_saida/transferencia_entrada/rendimento/aporte/importacao_ofx/importacao_csv/ajuste_manual/snapshot_inicial/correcao`), **origemSistema** (`subconta_criacao/confirmacao_manual/importacao_ofx/importacao_csv/transferencia/correcao`), referenciaTipo, referenciaId, descricao, metadata — append-only |
| **TaxaCDI** | data (unique), taxaDiaria, taxaMensal, taxaAnual, fonte (`api.bcb.gov.br`) — coleção global |
| **ImportacaoOFX** | usuario, subconta, nomeArquivo, status (`processando/revisao/finalizada/cancelada`), dtStart, dtEnd, saldoFinalExtrato, dataSaldoExtrato, totalTransacoes/Creditos/Debitos/Ignoradas |
| **TransacaoOFX** | importacaoOFX, subconta, usuario, fitid, tipo (credito/debito), valor, data, memo, descricao, status (pendente/aprovada/ignorada/ja_importada), movimentacaoInterna, transferencia (ref), transacaoCriada (ref), deduplicationKey |
| **Transferencia** | usuario, subcontaOrigem, subcontaDestino, valor, data, status (pendente/concluida), transacaoOFX (ref opcional) |
| **VinculoConjunto** | usuario, nome, participante, descricao, ativo |
| **AcertoConjunto** | usuario, vinculo, valor, direcao (recebi/paguei), data, observacao, transacoesQuitadas[], **tipo (`compensacao`/`pagamento_individual`)**, **ladoAfetado (`usuario`/`participante`)** |
| **Pessoa** | usuario, nome (único por usuário), contato, observacoes, ativo |
| **Emprestimo** | usuario, pessoaId, pessoaNomeSnapshot, pessoaContatoSnapshot, direcao (`concedido`/`recebido`), valorEsperadoRetorno, **tipoRetorno** (`valor_fixo`/`juros_percentual`/`juros_fixo`/`sem_juros`), taxaJurosPercentual, valorJurosFixo, prazoFinal, observacao, **status** (`ativo`/`quitado`/`cancelado`), dataQuitacao |

### Enums importantes

```
TAG_EFFECT = { IGNORE: 'ignore', SUBTRACT: 'subtract', ADD: 'add', CUSTOM: 'custom' }
TIPO_RETORNO_EMPRESTIMO = ['valor_fixo', 'juros_percentual', 'juros_fixo', 'sem_juros']
STATUS_EMPRESTIMO = ['ativo', 'quitado', 'cancelado']
DIRECAO_EMPRESTIMO = ['concedido', 'recebido']
TIPO_EVENTO_LEDGER = ['deposito','saque','transferencia_saida','transferencia_entrada','rendimento','aporte','importacao_ofx','importacao_csv','ajuste_manual','snapshot_inicial','correcao']
ORIGEM_SISTEMA_LEDGER = ['subconta_criacao','confirmacao_manual','importacao_ofx','importacao_csv','transferencia','correcao']
TIPO_HISTORICO_SALDO = ['manual', 'importacao_ofx', 'importacao_csv', 'ajuste']
TIPO_ACERTO = ['compensacao', 'pagamento_individual']
LADO_ACERTO = ['usuario', 'participante']
```

### Relacionamentos
- Usuario 1:N (todas as entidades principais)
- Transacao N:1 Usuario; N:1 Settlement (via settlementAsSource); 1:1 Transacao (sobra via settlementLeftoverFrom); N:1 Subconta (opcional); N:1 Emprestimo (opcional); Transacao.contaConjunta.vinculoId → VinculoConjunto
- Pagamento (sub) — pode ter parcelamento próprio, installmentGroupId compartilhado entre pagamentos do mesmo grupo
- Tag N:1 Categoria (por ObjectId; retrocompatibilidade: aceita nome)
- Importacao 1:N TransacaoImportada
- TransacaoImportada N:1 Importacao, N:1 Transacao (transacaoCriada), N:1 Subconta, N:1 Emprestimo
- Settlement N:1 Transacao (receiving), N:1 Tag, N:1 Transacao (leftover)
- Instituicao N:1 Usuario
- Subconta N:1 Usuario, N:1 Instituicao
- HistoricoSaldo N:1 Usuario, N:1 Subconta
- LedgerPatrimonial N:1 Usuario, N:1 Subconta; deduplicação unique sparse por (referenciaTipo, referenciaId, subconta)
- ImportacaoOFX N:1 Usuario, N:1 Subconta; 1:N TransacaoOFX
- TransacaoOFX N:1 ImportacaoOFX, N:1 Subconta, N:1 Usuario, N:1 Transferencia (opcional), N:1 Transacao (transacaoCriada)
- Transferencia N:1 Usuario, N:1 Subconta (origem e destino); 1:1 TransacaoOFX (opcional)
- VinculoConjunto N:1 Usuario
- AcertoConjunto N:1 Usuario, N:1 VinculoConjunto; 1:N Transacao (transacoesQuitadas)
- Pessoa N:1 Usuario; (nome, usuario) único
- Emprestimo N:1 Usuario, N:1 Pessoa

### Entidade central
**Transacao** — núcleo do sistema; todas as funcionalidades principais orbitam em torno dela (importação gera transações, settlement altera tags em transações, relatórios agregam transações, patrimônio pode vincular transações a subcontas, empréstimos vinculam transações a pessoas, conta conjunta divide transações entre usuários e participantes).

### Regras de integridade
- Soma dos `pagamentos[].valor` deve ser igual ao `valor` da transação (validação implícita).
- Transação de recebimento não pode ser usada em mais de um settlement (`settlementAsSource` único).
- Gasto não pode ser quitado em mais de um settlement.
- Categoria: `(nome, usuario)` único; `codigo` único por usuario.
- Tag: `(nome, usuario)` único; `codigo` único por usuario.
- TransacaoImportada: valor não pode ser negativo (pre-save).
- Instituicao: `(nome, usuario)` único.
- Subconta: `(nome, instituicao, usuario)` único; exclusão é soft delete.
- ImportacaoOFX: subconta deve ser tipo `corrente` ou `rendimento_automatico`.
- Transferencia: subcontaOrigem ≠ subcontaDestino; ambas devem pertencer ao usuário.
- VinculoConjunto: `(nome, usuario)` único.
- AcertoConjunto: valor ≤ saldo pendente; direcao coerente com saldo; `pagamento_individual` exige `ladoAfetado`.
- Pessoa: `(nome, usuario)` único; exclusão é soft delete (bloqueada se há empréstimos ativos).
- Emprestimo: pessoaId deve existir e estar ativa; valorEsperadoRetorno ≥ 0; status `cancelado` impede edição de campos relacionados a vínculos; não permite alterar pessoa/direcao se há transações vinculadas ativas.
- LedgerPatrimonial: deduplicação por `(referenciaTipo, referenciaId, subconta)` unique sparse.

### Estados das entidades principais

**Transacao** — `ativo` | `estornado`

**Importacao** — `pendente` → `processando` → `validado` | `erro` → `finalizada` | `estornada`

**TransacaoImportada** — `pendente` → `revisada` → `validada` | `erro` | `possivel_duplicata` | `ignorada` → `processada` | `ja_importada` | `estornada`

**Usuario** — `ativo` | `inativo` | `bloqueado`

**Instituicao / Subconta / Pessoa** — `ativo` | `inativo` (soft delete)

**HistoricoSaldo (origem)** — `manual` | `importacao_ofx` | `importacao_csv` | `ajuste`

**ImportacaoOFX** — `processando` → `revisao` → `finalizada` | `cancelada`

**TransacaoOFX** — `pendente` → `aprovada` | `ignorada` | `ja_importada`

**Transferencia** — `pendente` | `concluida`

**VinculoConjunto** — `ativo` | `inativo` (soft delete)

**AcertoConjunto** — registro imutável; estorno remove e reabre transações; suporta `compensacao` e `pagamento_individual`

**Emprestimo** — `ativo` → `quitado` (automático ao atingir `valorEsperadoRetorno`) | `cancelado` (manual, sem novas transações permitidas)

---

## 5️⃣ Regras de Negócio Importantes

### Validações
- Email único no sistema.
- Transação: tipo enum, status enum, pagamentos obrigatórios.
- Settlement: total aplicado ≤ valor do recebimento.
- Importação: CSV/JSON/XLSX; limite 10MB.
- Parcelamento: ≥ 2 parcelas; intervalo ≥ 1 dia; campo `parcelamento` por pagamento.
- Patrimônio: Instituição/Subconta (nome, usuario) únicos; subconta deve pertencer ao usuário para vincular em transação.
- Conta Conjunta: VinculoConjunto (nome, usuario) único; acerto: valor ≤ saldo pendente; parteUsuario + parteOutro = valorTotal.
- Pessoa: (nome, usuario) único; exclusão bloqueada se há empréstimos ativos.
- Empréstimo: pessoaId ativo; valorEsperadoRetorno ≥ 0; tipoRetorno válido; status `cancelado` é imutável para campos vinculados a transações.

### Processos com múltiplos estados
- **Importação**: pendente → processando → validado/erro → finalizada/estornada. Inclui etapa de **preview** (analisar sem persistir) → **criar importação** → processamento assíncrono.
- **TransacaoImportada**: pendente → revisada → validada/erro/possivel_duplicata/ignorada → processada/ja_importada/estornada. Na finalização, pode enviar `subcontaId` e `saldo` para atualizar saldo e criar HistoricoSaldo.
- **Empréstimo**: ativo → quitado (automático) ↔ ativo (revertido se totalReceived < valorEsperado) | cancelado (manual, terminal).

### Regras de consistência
- Deduplicação CSV/JSON: `deduplicationKey` (SHA256 de `usuarioId|descricao|valor|data|tipo|identificador[|installmentGroupId|installmentNumber]`) — `installmentGroupId/installmentNumber` incluídos para parcelamentos.
- Deduplicação OFX: `deduplicationKey` (SHA256 de `usuarioId|subcontaId|fitid`).
- Deduplicação possível duplicata (CSV/JSON): janela de ±7 dias, valor ±R$0,01, mesma descrição normalizada; marcada com `transacaoSemelhante*` e status `possivel_duplicata`.
- Deduplicação de **complemento Nubank fatura**: `contarComplementosAnteriores` retorna o nº sequencial de complemento para `(parserId, mesVencimento)`.
- Settlement: transações MongoDB em sessão transacional.
- Finalização de importação: transações criadas em sessão transacional.
- **Ledger**: append-only; deduplicação por `(referenciaTipo, referenciaId, subconta)` unique sparse; soma(eventos) deve igualar saldoAtual; importação OFX cria evento por TransacaoOFX (exceto vinculadas a transferência); se soma ≠ delta, cria evento `correcao`.
- Transações com `emprestimoId` em empréstimos **concedidos** são ajustadas no pipeline do report engine: zeradas e marcadas com `_emprestimoEsconderNaLista`; a compensação aparece via transação de juros auto.
- Transação de juros auto: criada/atualizada/deletada idempotentemente conforme `totalJuros` calculado pelo `recalcularStatus`; preserva valor original, principal, juros no breakdown.

### Sincronização
- Processamento de importação é assíncrono (fire-and-forget após criar registro).
- Não há fila de jobs; processamento roda em processo do servidor.
- Importações: previews em arquivo temporário (limpeza automática no startup).

### Regras financeiras
- **Ledger Patrimonial**: saldo = soma(eventos) por subconta; eventos imutáveis; correções via novo evento (tipo `correcao`); Transacao não altera saldo patrimonial — saldo é atualizado por confirmação manual, importação OFX/CSV e confirmação de transferência.
- Cálculo de rendimento CDI (`financial.service.js`):
  - `taxaAnualParaMensalEquivalente`: `(1 + i)^(1/12) - 1`
  - `taxaAnualParaDiariaEquivalente`: `(1 + i)^(1/252) - 1` (252 dias úteis)
  - `simularCdiYield(valor, cdiAnual, percentualCDI, meses)`: juros compostos mensais.
- Transações estornadas não entram em cálculos.
- Settlement: sobra vira nova transação recebível.
- Relatório devedor: totalBruto − totalPago = totalDevido.
- Patrimônio: saldo consolidado = soma de `saldoAtual` das subcontas ativas; rendimento estimado mensal = soma de `(saldo × taxaDiaria × percentualCDI) × 30` por subconta; subconta desatualizada = sem confirmação por 7+ dias.
- Conta Conjunta: saldo = soma(parteOutro) − soma(parteUsuario) para transações pendentes (`acertadoEm=null`); acerto aplica FIFO; direcao `paguei` quita dívidas do usuário; `recebi` quita dívidas do participante; `pagamento_individual` quita apenas um lado (`ladoAfetado`).
- Empréstimo: status `ativo` → `quitado` quando `totalReceived >= valorEsperadoRetorno`; `recalcularStatus` é idempotente e reverte para `ativo` se totalReceived cair abaixo (ex: estorno de recebimento). A transação de juros auto é recalculada/recriada/ajustada conforme o caso.

---

## 6️⃣ Fluxos Principais do Usuário

### Fluxo 1: Autenticação e onboarding
1. Acessar `/login` ou `/registro`.
2. Registrar (nome, email, senha) ou fazer login.
3. Se registro: receber email de verificação → acessar `/verificar-email/:token`.
4. Se email não verificado: redirecionamento para `/email-nao-verificado`.
5. Após login: token armazenado; perfil carregado.
6. Em `/profile`: editar dados pessoais (foto, telefone, gênero, etc.) e preferências (proprietário, categoria de cartão de crédito, tags padrão de recebimento/remoção).

### Fluxo 2: Gestão de transações (Dashboard)
1. Acessar `/` (Home).
2. Sistema carrega transações filtradas por proprietário.
3. Visualizar resumo, gráfico, calendário, últimas transações, **insights por tag** (cards do `tagInsightsService`).
4. Criar transação: modal `NovaTransacaoForm` (com tabs: Principal, Pagamentos, Avançado) → POST /api/transacoes.
5. Editar/estornar: ações no card da transação.
6. Clicar em dia no calendário: modal com transações do dia.
7. Notas rápidas: localStorage (não persistidas no backend).

### Fluxo 3: Importação em massa (CSV/JSON/XLSX)
1. Acessar `/importacao` → listar importações.
2. Clicar em "Nova importação" → `/importacao/nova` → `NovaImportacaoForm`.
3. **Etapa 1 — Upload**: seleciona arquivo; backend detecta parser (Nubank Fatura, Nubank Extrato, CSV genérico, JSON).
4. **Etapa 2 — Preview**: `POST /api/importacoes/preview` retorna transações parseadas + metadados inferidos (vencimento, competência, sugestão de título, nº de complemento Nubank, totais crédito/débito). Usuário revisa e ajusta configuração.
5. Backend processa assincronamente; cria `TransacaoImportada` por linha; aplica inferência de pessoa (`inferenciaPessoaService`), detecta possíveis duplicatas, sugere tag mensal para fatura de cartão.
6. Acessar `/importacao/:id` → revisar transações (editar, validar, ignorar, modal de duplicata, modal de sugestão de pessoa).
7. Finalizar importação → cria `Transacao` para cada `TransacaoImportada` validada (em sessão transacional).
8. Opcional: estornar importação (estorna transações criadas e recalcula empréstimos afetados).

### Fluxo 4: Conciliação (Recebimentos)
1. Acessar `/recebimentos/novo`.
2. Selecionar transação de recebimento (recebíveis não conciliados).
3. Selecionar gastos a quitar (filtros por pessoa, data).
4. Escolher tag a aplicar.
5. Confirmar → cria Settlement; aplica tag nos gastos; cria sobra se houver.
6. Histórico em `/recebimentos/historico`.

### Fluxo 5: Relatórios
1. Acessar `/relatorio`.
2. Selecionar template built-in (simples, devedor) ou modelo customizado (`/api/modelos-relatorio`).
3. Aplicar filtros (data, tipo, pessoas, `excludePessoas`, tags, busca, ordenação).
4. Gerar relatório → exibe linhas + resumo agregado.
5. Export PDF no frontend (jsPDF + jspdf-autotable). Backend retorna JSON.

### Fluxo 6: Tags e Categorias
1. Acessar `/tags` para gerenciar tags e categorias.
2. Tags e categorias carregadas via `DataContext`.
3. Tags usadas em pagamentos (`pagamentos[].tags = { categoriaId: [tagIds] }`).
4. Tag com `mostrarNoDashboard: true` aparece como card de insight no Home.

### Fluxo 7: Patrimônio
1. Acessar `/patrimonio` → resumo (total, rendimento estimado, por instituição, por propósito).
2. Alertas de subcontas desatualizadas (7+ dias sem confirmação).
3. Clicar em "Gerenciar Contas" → `/patrimonio/contas`.
4. Criar instituição → criar subcontas (com `percentualCDI` opcional para rendimento).
5. Clicar em subconta → `/patrimonio/contas/:subcontaId` (detalhe: saldo, histórico, gráfico, transações vinculadas, confirmar saldo).
6. Confirmar saldo → cria HistoricoSaldo + evento Ledger.
7. `/patrimonio/evolucao` (gráfico de evolução patrimonial por período via `/api/net-worth/history`).
8. `/patrimonio/historico` (histórico geral).
9. Transações podem ser vinculadas a subconta (campo opcional).
10. `/patrimonio/transferencias` → criar/listar/confirmar transferências.
11. `/patrimonio/importacoes-ofx` → upload OFX por subconta → revisão → aprovar/ignorar; sugestões de vínculo com transferências pendentes; finalização cria um evento ledger por TransacaoOFX.
12. `/patrimonio/simulador` → Simulador de Rendimentos (valor, % CDI, período) — usa `financial.service.simularCdiYield`.
13. **Eventos do Ledger**: em `/patrimonio/contas/:subcontaId`, seção "Eventos do Ledger (Auditoria)" com tabela, filtro por tipo, indicador de consistência.

### Fluxo 8: Conta Conjunta (Vínculos)
1. Acessar `/conjunto` → listar vínculos.
2. Criar vínculo: nome, participante, descrição.
3. Clicar em vínculo → `/conjunto/:id` (detalhe: saldo, resumo, transações, acertos, extrato).
4. Ao criar transação: marcar "Conta conjunta" → selecionar vínculo, pagoPor (eu/outro), valor total, parte do usuário.
5. Saldo: positivo = participante deve ao usuário; negativo = usuário deve ao participante.
6. Registrar acerto: valor, direção (paguei/recebi), data, tipo (`compensacao` ou `pagamento_individual` com `ladoAfetado`) → quita transações pendentes (FIFO).
7. Estornar acerto: reabre transações quitadas (`/api/acertos/:id` DELETE).

### Fluxo 9: Pessoas
1. Acessar `/pessoas` → listar pessoas ativas.
2. Criar/editar pessoa (nome, contato, observações).
3. Excluir (soft delete) — bloqueado se há empréstimos ativos.
4. Pessoa é usada como contraparte na criação de Empréstimos.

### Fluxo 10: Empréstimos
1. Acessar `/emprestimos` → listar por status (ativo, quitado, cancelado, todos).
2. Criar empréstimo: pessoaId, direcao (concedido/recebido), valorEsperadoRetorno, tipoRetorno (valor_fixo/juros_percentual/juros_fixo/sem_juros), prazoFinal.
3. Vincular transações:
   - Em `/emprestimos/:id` (detalhe) visualizar todas as transações vinculadas (gastos como desembolso, recebíveis como retorno), com breakdown principal/juros.
   - Adicionar via criação de transação (campo `emprestimoId`) ou via importação (`emprestimoConfig`).
4. Cálculo automático: ao atingir `valorEsperadoRetorno`, status vira `quitado` e uma transação de juros auto é criada (idempotente).
5. Cancelar empréstimo: status `cancelado` (terminal para novos vínculos).
6. Edição: `valorEsperadoRetorno`, `tipoRetorno`, `taxaJurosPercentual`, `valorJurosFixo`, `prazoFinal`, `observacao`; pessoa/direcao imutáveis com transações vinculadas.

### Fluxo 11: Modelos de Relatório
1. Acessar `/modelos-relatorio` → listar modelos customizados.
2. Criar modelo: nome, descrição, aggregation (`default`/`devedor`), regras por tag (effect: subtract/ignore).
3. Modelos aparecem como opção no motor de relatórios (`templateId = "modelo-<id>"`).

### Fluxo 12: HowToUse (Tutorial)
1. Acessar `/como-utilizar` → guia passo a passo estático.
2. Cobre: Perfil, Configuração Inicial, Gestão de Transações, Relatórios, Patrimônio, Dicas.

### Fluxo 13: Administração (admin)
1. Acessar `/admin` (requer role `admin`).
2. Gerar/restaurar backup (mongodump ou lógico; restore via upload `.gz`/`.json`).
3. Listar usuários, ver detalhes, resetar senha, verificar email, alterar role/status.

---

## 7️⃣ Pontos Sensíveis / Complexidade Técnica

### Partes mais complexas
- **Importação CSV/JSON/XLSX**: detecção automática de parser, classificação (novas/já importadas/possíveis duplicatas/ignoradas), expansão de parcelas, deduplicação, inferência de pessoa e tag mensal.
- **Importação OFX**: parse XML (xml2js), detecção de encoding (chardet, iconv-lite), extração de BANKMSGSRSV1/STMTTRN, deduplicação por `fitid+subconta`; detecção de movimentação interna e sugestão de vínculo com Transferência.
- **Settlement**: lógica transacional; aplicação/remoção de tags em pagamentos; criação de sobra.
- **Report Engine**: pipeline `fetchFilteredTransactions → processWithRules → aggregate` com suporte a `excludePessoas`, `tagsFilter`, `search`, `sortBy/sortDir`, ajuste de recebíveis de empréstimos concedidos (`utils/emprestimoAjuste.js`); templates built-in (simples, devedor) + modelos custom.
- **Parcelamento**: parcelamento legado (campos na transação) e por pagamento (sub-schema em `Pagamento`); expansão na importação (1 linha → N transações).
- **Patrimônio**: evolução baseada em HistoricoSaldo (último saldo conhecido por subconta por data) **e** Ledger Patrimonial; TaxaCDI externa (BCB); rendimento estimado por `percentualCDI`; vinculação opcional de transações; **Simulador de Rendimentos** com `financial.service.simularCdiYield`.
- **Ledger Patrimonial**: `ledgerService.registrarEvento` centralizado; transações MongoDB nos fluxos de alteração de saldo; migração 003 cria `snapshot_inicial` para subcontas existentes; importação OFX cria evento por TransacaoOFX (`referenciaTipo: transacao_ofx`); evento `correcao` quando soma ≠ delta.
- **Conta Conjunta**: cálculo de saldo a partir de transações pendentes; acerto FIFO; suporte a `compensacao` e `pagamento_individual` com `ladoAfetado`.
- **Empréstimos**: ajuste FIFO de principal/juros; recálculo de status idempotente; transação de juros auto (criada/atualizada/deletada conforme cenário); transações vinculadas são zeradas e ocultas no report engine; validações de edição de pessoa/direcao; cancelamento preserva integridade.
- **Inferência**: `inferenciaImportacaoService` (datas, vencimento, competência, sugestão de título, nº de complemento Nubank, auto-tag mensal por categoria de cartão de crédito); `inferenciaPessoaService` (sugestão de pessoa por descrição similar, com stripping de sufixo de parcela).

### Riscos técnicos
- Processamento de importação assíncrono sem fila: falha silenciosa se processo morrer.
- CORS `origin: '*'` em produção (configuração atual).
- Backup depende de `mongodump` no PATH (fallback para lógico).
- PDF de relatório: backend retorna JSON quando `format=pdf`; geração real é feita no frontend (jsPDF + jspdf-autotable).
- `controladorRelatorio.js` legacy ainda existe no repositório mas **não está montado** no `app.js`; deve ser removido.
- `importacaoApi` em `frontend/src/services/api.js` é legacy (não usado pelo app; `importacaoService.js` é o correto); chama rota inexistente `/importacoes/:id/arquivo`.
- Console.logs de debug em alguns controllers de importação e `importacaoOFXController`.

### Gargalos conhecidos
- `filterService.fetchFilteredTransactions`: limite 50.000 linhas (MAX_EXPORT).
- Settlement: limite 500 gastos pendentes, 100 recebíveis na listagem.
- VinculoConjunto.extrato: cap 1000 entradas; paginação em `transacoes` e `acertos`.

### Débitos técnicos conhecidos
- `validarMultiplas` em `transacaoImportadaController`: valida sem criar `Transacao` (inconsistência com fluxo de finalização).
- Código de debug (console.log) em `transacaoImportadaController` e `importacaoController`.
- `importacaoApi` em `frontend/src/services/api.js` é legacy/não utilizado; o app usa `importacaoService` que envia FormData corretamente.
- PDF de relatório: backend retorna JSON quando `format=pdf` (comentário "Fase 3: PDF no backend - por ora retornamos JSON").
- `controladorRelatorio.js` legacy não está montado em `app.js` (deve ser removido).
- CORS permissivo (`origin: '*'`) em produção.
- Processamento assíncrono de importação sem fila de jobs.
- Sem Service Worker / estratégia offline.
- PWA: apenas `manifest.json`; sem cache.

### Testes
- **Backend**: Jest. Suites: `src/utils/__tests__/emprestimoAjuste.test.js`, `src/utils/__tests__/emprestimoQuitacao.test.js`, `src/services/__tests__/emprestimoService.test.js`, `src/services/__tests__/ledgerService.test.js`, `src/services/__tests__/netWorthService.test.js`, `__tests__/unit/{classificar,parsers,inferencia}.test.js`. Cobertura: parsers, inferência, regras de empréstimo, ledger, netWorth.
- **Frontend**: `craco test` configurado; sem arquivos de teste efetivos.

---

## 8️⃣ Estado Atual do Projeto

### Implementado
- Autenticação completa (registro, login, JWT, verificação de email, redefinição de senha, perfil expandido, foto).
- CRUD de transações, categorias, tags (multi-tenant).
- Dashboard com resumo, gráfico, calendário, notas, **insights por tag** (`tagInsightsService`).
- Importação em massa (CSV/JSON/XLSX) com parsers especializados (Nubank Fatura, Nubank Extrato, CSV genérico, JSON), preview, inferência de pessoa e tag mensal, dedup por nº de complemento Nubank, detecção de possíveis duplicatas (±7 dias).
- Importação OFX (XML, com detecção de encoding e movimentação interna).
- Módulo de recebimentos (Settlement) com `removeTagId`/`removedTagLog` e sobra.
- Relatórios avançados com `reportEngine` (filterService/ruleEngine/aggregator/templates) e modelos customizados.
- Parcelamento (legado e por pagamento).
- Export de transações.
- **Backup/restore** (admin) com mongodump/lógico.
- **Gerenciamento de usuários** (admin) com paginação, ações (resetar senha, verificar email, alterar role/status).
- **Módulo de Patrimônio**: CRUD instituições e subcontas, resumo, evolução patrimonial, histórico de saldo, confirmação de saldo, rendimento estimado (CDI), vinculação de transações a subcontas, alertas de subcontas desatualizadas, **Simulador de Rendimentos** (juros compostos CDI), **Ledger Patrimonial** (eventos append-only, auditoria, consistência).
- **Importação OFX**: upload, parse, TransacaoOFX, revisão, aprovação/ignorar, conversão em Transacao, detecção de movimentação interna, sugestão de vínculo com Transferência; finalização cria um evento ledger por TransacaoOFX (deposito/saque) e evento `correcao` se soma ≠ delta.
- **Transferências**: CRUD entre subcontas, vinculação com TransacaoOFX (movimentação interna).
- **Conta Conjunta**: CRUD vínculos, transações com divisão (`parteUsuario`/`parteOutro`), saldo pendente, acertos FIFO (`compensacao` e `pagamento_individual`), estorno de acerto.
- **Pessoas**: CRUD (multi-tenant), soft delete bloqueado se há empréstimos ativos.
- **Empréstimos**: CRUD, status `ativo` → `quitado` automático, transação de juros auto idempotente, recálculo de status, cancelamento, listagem por status/pessoa, breakdown principal/juros, edição limitada com transações vinculadas, integração com importação (`emprestimoConfig`).
- **Modelos de Relatório**: CRUD com regras por tag e aggregation (`default`/`devedor`).
- **HowToUse**: página de tutorial estática.
- **NetWorth**: patrimônio em data e histórico de evolução baseados no Ledger.

### Parcialmente implementado
- Export PDF de relatórios (frontend; backend retorna JSON; geração real é no cliente).
- Página `/insights` é placeholder (cards já funcionam no Home via `tagInsightsService`).
- PWA (apenas `manifest.json`; sem Service Worker).
- `controladorRelatorio` legacy existe mas não está montado.

### Não implementado
- Service Worker / offline-first.
- Fila de jobs para importação.
- API de Open Banking / integração bancária automatizada.
- App mobile.

---

## 9️⃣ Resumo Estratégico Final

### Pontos fortes
- Arquitetura clara: backend em camadas, frontend com Context API, **report engine modularizado**.
- Modelagem flexível: pagamentos com múltiplas pessoas, tags por categoria, parcelamento por pagamento.
- Deduplicação robusta na importação (CSV/JSON e OFX) e detecção de possíveis duplicatas.
- Settlement com transações MongoDB.
- Report engine extensível (templates + modelos + regras por tag + adjusters de empréstimo).
- Módulo Patrimônio bem integrado: instituições → subcontas → histórico/Ledger; vinculação opcional de transações; TaxaCDI externa; Simulador de Rendimentos com juros compostos.
- Importação OFX completa: parse, detecção de movimentação interna, sugestão de vínculo, evento ledger por TransacaoOFX.
- **Ledger Patrimonial**: append-only, auditoria completa, consistência `saldoAtual` vs soma(eventos), frontend com seção de eventos e indicador de consistência.
- **Empréstimos**: divisão de gastos entre usuários, ajuste FIFO de principal/juros, transação de juros auto idempotente, integração com report engine.
- **Conta Conjunta**: divisão de gastos, acertos FIFO com `compensacao` e `pagamento_individual`, integração com formulário de transação.
- **Multi-tenant corrigido**: pre-save hooks e índices compostos em Categoria/Tag, queries filtradas por `usuario` em todos os controllers e services críticos.
- **Pessoas**: base para Empréstimos com isolamento por usuário e validação de integridade.
- **Inferência automática**: pessoa responsável por descrição similar; tag mensal por categoria de cartão de crédito; nº de complemento Nubank.

### Pontos de melhoria
- Substituir processamento assíncrono de importação por fila (Bull, Agenda, etc.).
- Implementar Service Worker para offline.
- Restringir CORS em produção.
- Remover `importacaoApi` legacy em `frontend/src/services/api.js`.
- Remover `controladorRelatorio.js` legacy (não montado).
- Implementar geração de PDF no backend.
- Remover logs de debug em produção.
- Aumentar cobertura de testes (frontend e partes não cobertas do backend).

### Grau de maturidade
- **Alto**: funcionalidades core estáveis; módulos avançados (importação multi-parser, settlement, relatórios com motor dedicado, patrimônio com Ledger, empréstimos com juros automáticos, conta conjunta) operacionais. Multi-tenant resolvido.

### Capacidade de escalabilidade
- **Moderada**: monólito; sem cache (Redis); sem fila; MongoDB como único banco. Escala vertical; para horizontal seria necessário stateless + fila + cache de sessão.

### Preparação para novas funcionalidades
- **Excelente**: módulos bem delimitados (Pessoas, Empréstimos, Patrimônio, Relatórios); motor de relatórios extensível; novos fluxos podem reutilizar `Transacao`, `Tag`, `Categoria`, `Pessoa`, `VinculoConjunto`. Atenção à consistência entre frontend e backend nas integrações e à eventual revisão dos débitos listados.

---

*Documento gerado com base na análise do código-fonte. Última atualização: junho/2026 (Pessoas + Empréstimos; report engine modularizado; Ledger Patrimonial; OFX; Conta Conjunta; Modelos de Relatório; HowToUse; correções multi-tenant 001–006; inferência de pessoa e tag mensal; simulador CDI; netWorthService).*
