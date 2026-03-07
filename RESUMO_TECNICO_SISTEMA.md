# Resumo Técnico Estruturado — Sistema de Controle de Gastos

> Documento de contexto base para planejamento de novas funcionalidades por IA.

---

## 1️⃣ Visão Geral do Sistema

| Aspecto | Descrição |
|---------|-----------|
| **Nome** | Sistema de Controle de Gastos |
| **Objetivo principal** | Gerenciamento de transações financeiras pessoais e compartilhadas, com suporte a múltiplos participantes por transação, um proprietário definido e contas conjuntas (divisão de gastos com participante e acertos). |
| **Público-alvo** | Usuários que precisam controlar gastos e recebíveis, com divisão por pessoa (participantes) e filtro por proprietário. |
| **Problema que resolve** | Centralização e organização de transações financeiras, conciliação de recebimentos com gastos, importação em massa, relatórios customizáveis, controle de parcelamentos e gestão de patrimônio (contas bancárias, subcontas, evolução e rendimentos). |

---

## 2️⃣ Arquitetura Técnica

### Estrutura geral
- **Frontend**: SPA React (porta 3004)
- **Backend**: API REST Node.js/Express (porta 3001)
- **Mobile**: Não informado (apenas web responsiva)

### Tecnologias utilizadas

| Camada | Stack |
|--------|-------|
| **Frontend** | React 19, React Router 7, MUI 6, Chart.js, React Calendar, Axios, Tailwind CSS, jsPDF, @react-pdf/renderer, SweetAlert2, React Toastify |
| **Backend** | Node.js, Express 4, Mongoose 8 |
| **Banco de dados** | MongoDB |
| **Autenticação** | JWT (jsonwebtoken), bcrypt/bcryptjs |
| **Email** | Nodemailer (Gmail) |
| **Upload/Parse** | Multer, csv-parse, xlsx, xml2js, iconv-lite, chardet |
| **Precisão numérica** | decimal.js (backend e frontend) |

### Padrão arquitetural
- **Backend**: Estrutura em camadas (routes → controllers → services → models)
- **Frontend**: Componentes funcionais + Context API (AuthContext, DataContext, ImportacaoContext)
- Não segue Clean Architecture formal; organização modular por domínio

### Estratégia de autenticação
- JWT com validade configurável (padrão: 1 dia via `JWT_EXPIRES`)
- Token armazenado em `localStorage` no frontend
- Middleware `autenticacao` em todas as rotas protegidas
- Middleware `isAdmin` para rotas administrativas
- Verificação de email obrigatória (`emailVerificado`)
- Tokens de verificação de email (24h) e redefinição de senha (1h)
- Redirecionamento configurável via `LOGIN_REDIRECT_URL` em caso de 401

### Estratégia offline
- **Não implementada**. Existe apenas `manifest.json` genérico (PWA metadata) sem Service Worker ou cache offline.

### Integrações externas
- **Email**: Nodemailer (Gmail) para verificação de email, redefinição de senha e testes
- **MongoDB**: Conexão via `DB_URI`; suporte a transações MongoDB (requer replica set)
- **Taxa CDI**: API BCB (api.bcb.gov.br) para obter taxas CDI diária/mensal/anual (cálculo de rendimento estimado e simulador)
- **Health check**: `GET /api/health` verifica conexão MongoDB e suporte a transações/replica set
- **Não informado**: APIs de terceiros para bancos, Open Banking, etc.

---

## 3️⃣ Estrutura de Módulos

### Módulo de Usuários
- **Responsabilidade**: Registro, login, perfil, preferências (tema, proprietário, moeda, notificações), verificação de email, redefinição de senha.
- **Entidades**: Usuario
- **Fluxos**: Registro → Verificação de email → Login; Esqueci senha → Token → Redefinir senha
- **Dependências**: Nenhuma (base do sistema)

### Módulo de Transações
- **Responsabilidade**: CRUD de transações, parcelamento, estorno, bulk create, export, filtros por proprietário.
- **Entidades**: Transacao, Pagamento (subdocumento)
- **Fluxos**: Criar/Editar transação; Estornar; Preview de parcelas; Export
- **Dependências**: Usuario, Categoria (indireto via tags), Tag

### Módulo de Categorias
- **Responsabilidade**: CRUD de categorias (agrupamento lógico para tags).
- **Entidades**: Categoria
- **Fluxos**: Criar, editar, ativar/inativar, excluir
- **Dependências**: Usuario

### Módulo de Tags
- **Responsabilidade**: CRUD de tags vinculadas a categorias; aplicação em pagamentos.
- **Entidades**: Tag
- **Fluxos**: Criar, editar, associar a categoria
- **Dependências**: Usuario, Categoria (campo `categoria` como string)

### Módulo de Importação em Massa
- **Responsabilidade**: Upload de CSV/JSON, parse, classificação (novas/já importadas/ignoradas), revisão, validação, finalização, estorno.
- **Entidades**: Importacao, TransacaoImportada
- **Fluxos**: Upload → Processamento assíncrono → Revisão → Validação → Finalizar (cria Transacao) ou Estornar
- **Dependências**: Usuario, Transacao, TransacaoImportada, ImportacaoService

### Módulo de Recebimentos (Settlement/Conciliação)
- **Responsabilidade**: Conciliação de recebíveis com gastos; aplicação de tag em gastos quitados; geração de transação de sobra; remoção de tag ao reverter (removeTagId, removedTagLog).
- **Entidades**: Settlement
- **Fluxos**: Selecionar recebimento → Selecionar gastos → Aplicar tag → Criar settlement; Excluir settlement (reverte alterações, remove tag aplicada)
- **Dependências**: Transacao, Tag, Usuario

### Módulo de Relatórios
- **Responsabilidade**: Filtros, regras de tag (add/subtract/ignore), agregações (default, devedor), modelos customizados.
- **Entidades**: ModeloRelatorio
- **Fluxos**: Selecionar template/modelo → Aplicar filtros → Gerar relatório (JSON/PDF planejado)
- **Dependências**: Transacao, Tag, ModeloRelatorio

### Módulo de Administração
- **Responsabilidade**: Backup/restore, gerenciamento de usuários (listar, detalhes, resetar senha, verificar email, alterar role/status).
- **Entidades**: Backup
- **Fluxos**: Gerar backup (mongodump ou lógico); Restaurar; Listar usuários; Ações em usuários
- **Dependências**: Usuario, Backup, todos os modelos para restore

### Módulo de Patrimônio
- **Responsabilidade**: Gestão de instituições financeiras (bancos, corretoras, carteiras), subcontas (contas dentro de instituições), histórico de saldo, confirmação de saldo, evolução patrimonial, rendimento estimado (CDI) e simulador de rendimentos.
- **Entidades**: Instituicao, Subconta, HistoricoSaldo, LedgerPatrimonial, TaxaCDI
- **LedgerPatrimonial**: Camada de eventos append-only que registra todas as alterações de saldo (deltas). Permite reconstruir saldo por soma de eventos, auditoria completa e análise temporal. Integrado em: criação de subconta, confirmação de saldo, finalização importação OFX/CSV, confirmação de transferência.
- **Fluxos**: CRUD Instituição → CRUD Subconta (por instituição) → Confirmar saldo (cria HistoricoSaldo + LedgerPatrimonial) → Visualizar resumo/evolução; Rendimento estimado usa TaxaCDI (BCB); Simulador de Rendimentos (`/patrimonio/simulador`) permite simular rendimento com valor, % CDI e período (usa useCdiData, SimuladorForm, CdiDataCard, ComparacaoRapidaCard)
- **Dependências**: Usuario; Transacao (vinculação opcional via `subconta`); TaxaCDI (coleção global, não por usuário)

### Módulo de Importação OFX
- **Responsabilidade**: Upload de extratos OFX (formato bancário), parse XML, criação de TransacaoOFX por linha, revisão, aprovação/ignorar, conversão em Transacao ou vinculação a Transferência (movimentação interna).
- **Entidades**: ImportacaoOFX, TransacaoOFX
- **Fluxos**: Upload OFX → Parse (xml2js, chardet, iconv-lite) → Cria TransacaoOFX (deduplicação por fitid+subconta) → Revisão → Aprovar (cria Transacao e/ou HistoricoSaldo) ou Ignorar; Movimentação interna: detecta padrões (Caixinha, Resgate, Aporte, Transferência para conta) e sugere vínculo com Transferência pendente
- **Dependências**: Usuario, Subconta, Transacao, HistoricoSaldo, Transferencia; movimentacaoInternaService (sugestão de transferências)

### Módulo de Transferências
- **Responsabilidade**: Transferências entre subcontas do mesmo usuário; registro manual ou vinculação a TransacaoOFX (reconhecimento de movimentação interna).
- **Entidades**: Transferencia
- **Fluxos**: Criar transferência (subcontaOrigem, subcontaDestino, valor, data); Listar por status; TransacaoOFX pode vincular-se a Transferência (campo `transferencia`) para marcar movimentação interna
- **Dependências**: Usuario, Subconta; TransacaoOFX (opcional, para vínculo bidirecional)

### Módulo de Conta Conjunta (Vínculos Conjuntos)
- **Responsabilidade**: Gestão de contas compartilhadas entre o usuário e um participante (ex.: namorado(a), colega de apartamento); divisão de gastos (parteUsuario/parteOutro), saldo pendente e acertos (quitação FIFO).
- **Entidades**: VinculoConjunto, AcertoConjunto; Transacao.contaConjunta (subdocumento)
- **Fluxos**: Criar vínculo (nome, participante) → Criar transação marcando "conta conjunta" (vinculoId, pagoPor, valorTotal, parteUsuario, parteOutro) → Visualizar saldo (saldo > 0: outro deve ao usuário; saldo < 0: usuário deve ao outro) → Registrar acerto (valor, direcao: recebi/paguei, data) → Acerto aplica FIFO nas transações pendentes; Estornar acerto (reabre transações quitadas)
- **Dependências**: Usuario, Transacao (campo contaConjunta opcional)

### Módulo de Insights
- **Responsabilidade**: Placeholder para funcionalidade futura (análises, tendências).
- **Estado**: Em desenvolvimento (página vazia com mensagem "Esta funcionalidade está em desenvolvimento").
- **Dependências**: Nenhuma (ainda)

### Módulo de Email
- **Responsabilidade**: Envio de emails (teste, verificação, redefinição de senha).
- **Fluxos**: Teste de conexão; Envio de templates
- **Dependências**: Configuração Nodemailer

---

## 4️⃣ Modelagem de Dados

### Principais entidades

| Entidade | Descrição |
|----------|-----------|
| **Usuario** | nome, email, senha (hash), emailVerificado, tokens de verificação/redefinição, preferencias (tema, proprietario, moedaPadrao, notificacoes), role (admin/pro/comum), status (ativo/inativo/bloqueado) |
| **Transacao** | tipo (gasto/recebivel), descricao, valor, data, observacao, pagamentos[], status (ativo/estornado), usuario, deduplicationKey, campos de parcelamento, settlementAsSource, settlementApplied, settlementLeftoverFrom, subconta (opcional, ref Subconta), contaConjunta (ativo, vinculoId, pagoPor, valorTotal, parteUsuario, parteOutro, acertadoEm) |
| **Pagamento** | pessoa, valor, tags (objeto { categoriaId: [tagIds] }) |
| **Categoria** | codigo, nome, descricao, cor, icone, ativo, usuario |
| **Tag** | codigo, nome, descricao, categoria (string), cor, icone, ativo, usuario |
| **Importacao** | descricao, status, nomeArquivo, caminhoArquivo, totalProcessado/Sucesso/Erro/Ignoradas, tagsPadrao, tipoImportacao (normal/complementar), usuario |
| **TransacaoImportada** | importacao, descricao, valor, data, categoria, tipo, status, pagamentos, dadosOriginais, deduplicationKey, transacaoCriada, campos de parcelamento, usuario |
| **Settlement** | usuario, receivingTransactionId, appliedTransactions[] (transactionId, amountApplied), tagId, removeTagId, removedTagLog, totalApplied, leftoverAmount, leftoverTransactionId |
| **ModeloRelatorio** | nome, descricao, aggregation (default/devedor), regras (tag + effect), usuario, ativo |
| **Backup** | filename, size, type (mongodump/logical), operation, createdBy, status, errorMessage |
| **Instituicao** | usuario, nome, tipo (banco_digital/banco_tradicional/carteira_digital/corretora), cor, icone, ativo |
| **Subconta** | usuario, instituicao, nome, tipo (corrente/rendimento_automatico/caixinha/investimento_fixo), proposito (disponivel/reserva_emergencia/objetivo/guardado), rendimento (percentualCDI), saldoAtual, dataUltimaConfirmacao, meta, ativo |
| **HistoricoSaldo** | usuario, subconta, saldo, data, origem (manual/importacao_ofx/importacao_csv), tipo, observacao |
| **LedgerPatrimonial** | usuario, subconta, dataEvento, valor (delta), tipoEvento, origemSistema, referenciaTipo, referenciaId, descricao, metadata — append-only, eventos imutáveis |
| **TaxaCDI** | data (unique), taxaDiaria, taxaMensal, taxaAnual, fonte (api.bcb.gov.br) — coleção global, não por usuário |
| **ImportacaoOFX** | usuario, subconta, nomeArquivo, status (processando/revisao/finalizada/cancelada), dtStart, dtEnd, saldoFinalExtrato, dataSaldoExtrato, totalTransacoes/Creditos/Debitos/Ignoradas |
| **TransacaoOFX** | importacaoOFX, subconta, usuario, fitid, tipo (credito/debito), valor, data, memo, descricao, status (pendente/aprovada/ignorada/ja_importada), movimentacaoInterna, transferencia (ref), transacaoCriada (ref), deduplicationKey |
| **Transferencia** | usuario, subcontaOrigem, subcontaDestino, valor, data, status (pendente/concluida), transacaoOFX (ref opcional) |
| **VinculoConjunto** | usuario, nome, participante, descricao, ativo |
| **AcertoConjunto** | usuario, vinculo, valor, direcao (recebi/paguei), data, observacao, transacoesQuitadas[] |

### Relacionamentos
- Usuario 1:N Transacao, Categoria, Tag, Importacao, TransacaoImportada, Settlement, ModeloRelatorio, Instituicao, Subconta, HistoricoSaldo, ImportacaoOFX, TransacaoOFX, Transferencia, VinculoConjunto, AcertoConjunto
- Transacao N:1 Usuario; N:1 Settlement (via settlementAsSource); 1:1 Transacao (sobra via settlementLeftoverFrom); N:1 Subconta (opcional)
- Tag N:1 Categoria (por string `categoria`)
- Importacao 1:N TransacaoImportada
- TransacaoImportada N:1 Importacao; N:1 Transacao (transacaoCriada); N:1 Subconta (opcional)
- Settlement N:1 Transacao (receivingTransactionId); N:1 Tag; N:1 Transacao (leftoverTransactionId)
- Instituicao N:1 Usuario
- Subconta N:1 Usuario; N:1 Instituicao
- HistoricoSaldo N:1 Usuario; N:1 Subconta
- LedgerPatrimonial N:1 Usuario; N:1 Subconta; referencias opcionais (referenciaTipo, referenciaId) para deduplicação
- ImportacaoOFX N:1 Usuario; N:1 Subconta; 1:N TransacaoOFX
- TransacaoOFX N:1 ImportacaoOFX; N:1 Subconta; N:1 Usuario; N:1 Transferencia (opcional); N:1 Transacao (transacaoCriada)
- Transferencia N:1 Usuario; N:1 Subconta (origem e destino); 1:1 TransacaoOFX (opcional)
- VinculoConjunto N:1 Usuario
- AcertoConjunto N:1 Usuario; N:1 VinculoConjunto; 1:N Transacao (transacoesQuitadas)
- Transacao: contaConjunta.vinculoId ref VinculoConjunto; contaConjunta.acertadoEm ref AcertoConjunto

### Entidade central
**Transacao** — núcleo do sistema; todas as funcionalidades principais orbitam em torno dela (importação gera transações, settlement altera tags em transações, relatórios agregam transações, patrimônio pode vincular transações a subcontas).

### Regras de integridade
- Soma dos `pagamentos[].valor` deve ser igual ao `valor` da transação (validação implícita no fluxo)
- Transação de recebimento não pode ser usada em mais de um settlement (`settlementAsSource` único)
- Gasto não pode ser quitado em mais de um settlement
- Categoria: `(nome, usuario)` único
- Tag: `(nome, usuario)` único
- TransacaoImportada: valor não pode ser negativo (pre-save)
- Instituicao: `(nome, usuario)` único
- Subconta: `(nome, instituicao, usuario)` único; exclusão é soft delete (ativo=false)
- ImportacaoOFX: subconta deve ser tipo `corrente` ou `rendimento_automatico`
- Transferencia: subcontaOrigem ≠ subcontaDestino; ambas devem pertencer ao usuário
- VinculoConjunto: (nome, usuario) único
- AcertoConjunto: valor do acerto ≤ saldo pendente; direcao deve ser coerente com saldo

### Estados das entidades principais

**Transacao**
- `ativo` | `estornado`

**Importacao**
- `pendente` → `processando` → `validado` | `erro` → `finalizada` | `estornada`

**TransacaoImportada**
- `pendente` → `revisada` → `validada` | `erro` | `ignorada` → `processada` | `ja_importada` | `estornada`

**Usuario**
- `ativo` | `inativo` | `bloqueado`

**Instituicao / Subconta**
- `ativo` | `inativo` (soft delete)

**HistoricoSaldo (origem)**
- `manual` | `importacao_ofx` | `importacao_csv`

**ImportacaoOFX**
- `processando` → `revisao` → `finalizada` | `cancelada`

**TransacaoOFX**
- `pendente` → `aprovada` | `ignorada` | `ja_importada`

**Transferencia**
- `pendente` | `concluida`

**VinculoConjunto**
- `ativo` | `inativo` (soft delete)

**AcertoConjunto**
- Sem estados; registro imutável (estorno remove o acerto e reabre transações)

---

## 5️⃣ Regras de Negócio Importantes

### Validações
- Email único no sistema
- Transação: tipo enum, status enum, pagamentos obrigatórios
- Settlement: total aplicado ≤ valor do recebimento
- Importação: apenas CSV/JSON; limite 10MB
- Parcelamento: ≥ 2 parcelas; intervalo ≥ 1 dia
- Patrimônio: Instituição (nome, usuario) único; Subconta (nome, instituicao, usuario) único; subconta deve pertencer ao usuário para vincular em transação
- Conta Conjunta: VinculoConjunto (nome, usuario) único; acerto: valor ≤ saldo pendente; parteUsuario + parteOutro = valorTotal

### Processos com múltiplos estados
- **Importação**: pendente → processando → validado/erro → finalizada/estornada
- **TransacaoImportada**: pendente → revisada → validada/erro/ignorada → processada/ja_importada/estornada; suporta campo `subconta` opcional; na finalização da importação, pode-se enviar `subcontaId` e `saldo` para atualizar saldo da subconta e criar HistoricoSaldo

### Regras de consistência
- Deduplicação CSV/JSON: `deduplicationKey` (SHA256 de usuarioId|descricao|valor|data|tipo|identificador) evita duplicatas na importação
- Deduplicação OFX: `deduplicationKey` (SHA256 de usuarioId|subcontaId|fitid) evita duplicatas por transação bancária
- Settlement: transações MongoDB em sessão transacional
- Finalização de importação: transações criadas em sessão transacional

### Sincronização
- Processamento de importação é assíncrono (fire-and-forget após criar registro)
- Não há fila de jobs; processamento roda em processo do servidor

### Regras financeiras
- Transações estornadas não entram em cálculos
- Settlement: sobra vira nova transação recebível
- Relatório devedor: totalBruto - totalPago = totalDevido
- Patrimônio: saldo consolidado = soma de saldoAtual das subcontas ativas; rendimento estimado mensal = soma de (saldo × taxaDiaria × percentualCDI) × 30 por subconta; subconta desatualizada = sem confirmação por 7+ dias
- Conta Conjunta: saldo = soma(parteOutro) - soma(parteUsuario) para transações pendentes (acertadoEm=null); acerto aplica FIFO (transações mais antigas primeiro); direcao "paguei" quita dívidas do usuário; direcao "recebi" quita dívidas do participante

---

## 6️⃣ Fluxos Principais do Usuário

### Fluxo 1: Autenticação e onboarding
1. Acessar `/login` ou `/registro`
2. Registrar (nome, email, senha) ou fazer login
3. Se registro: receber email de verificação → acessar `/verificar-email/:token`
4. Se email não verificado: redirecionamento para `/email-nao-verificado`
5. Após login: token armazenado; perfil carregado
6. Definir proprietário em `/profile` (preferências)

### Fluxo 2: Gestão de transações (Dashboard)
1. Acessar `/` (Home)
2. Sistema carrega transações filtradas por proprietário
3. Visualizar resumo, gráfico, calendário, últimas transações
4. Criar transação: modal NovaTransacaoForm → POST /api/transacoes
5. Editar/estornar: ações no card da transação
6. Clicar em dia no calendário: modal com transações do dia
7. Notas rápidas: localStorage (não persistidas no backend)

### Fluxo 3: Importação em massa
1. Acessar `/importacao` → listar importações
2. Clicar em "Nova importação" → `/importacao/nova`
3. Upload de CSV/JSON + descrição + tags padrão
4. Backend processa assincronamente; cria TransacaoImportada por linha
5. Acessar `/importacao/:id` → revisar transações (editar, validar, ignorar)
6. Finalizar importação → cria Transacao para cada TransacaoImportada validada
7. Opcional: estornar importação (estorna transações criadas)

### Fluxo 4: Conciliação (Recebimentos)
1. Acessar `/recebimentos/novo`
2. Selecionar transação de recebimento (recebíveis não conciliados)
3. Selecionar gastos a quitar (filtros por pessoa, data)
4. Escolher tag a aplicar
5. Confirmar → cria Settlement; aplica tag nos gastos; cria sobra se houver
6. Histórico em `/recebimentos/historico`

### Fluxo 5: Relatórios
1. Acessar `/relatorio`
2. Selecionar template (simples, devedor, ou modelo customizado)
3. Aplicar filtros (data, tipo, pessoas, tags, busca)
4. Gerar relatório → exibe linhas + resumo agregado
5. Export PDF (frontend: jsPDF)

### Fluxo 6: Tags e Categorias
1. Acessar `/tags` para gerenciar tags
2. Categorias e tags carregadas via DataContext (obterCategorias, obterTags)
3. Tags usadas em pagamentos (estrutura `pagamentos[].tags = { categoriaId: [tagIds] }`)

### Fluxo 7: Patrimônio
1. Acessar `/patrimonio` → resumo (total geral, rendimento estimado, por instituição, por propósito)
2. Alertas de subcontas desatualizadas (7+ dias sem confirmação)
3. Clicar em "Gerenciar Contas" → `/patrimonio/contas`
4. Criar instituição (modal) → criar subcontas por instituição
5. Clicar em subconta → `/patrimonio/contas/:subcontaId` (detalhe: saldo, histórico, gráfico, transações vinculadas, confirmar saldo)
6. Confirmar saldo → cria HistoricoSaldo (origem: manual); atualiza saldoAtual e dataUltimaConfirmacao
7. Ver evolução → `/patrimonio/evolucao` (gráfico de evolução patrimonial por período)
8. Transações podem ser vinculadas a subconta (campo opcional na criação/edição)
9. Transferências: `/patrimonio/transferencias` → criar/listar transferências entre subcontas
10. Importação OFX: `/patrimonio/importacoes-ofx` → upload OFX por subconta → revisão → aprovar/ignorar; movimentações internas podem vincular a transferências pendentes
11. Simulador de Rendimentos: `/patrimonio/simulador` → valor, % CDI (presets ou custom), período → cálculo de rendimento estimado; link direto do detalhe da subconta com valor e percentual pré-preenchidos

### Fluxo 8: Conta Conjunta (Vínculos)
1. Acessar `/conjunto` → listar vínculos (contas conjuntas)
2. Criar vínculo: nome (ex.: "Apartamento"), participante (ex.: "Maria"), descrição opcional
3. Clicar em vínculo → `/conjunto/:id` (detalhe: saldo, resumo, transações, acertos)
4. Ao criar transação (NovaTransacaoForm): marcar "Conta conjunta" → selecionar vínculo, quem pagou (eu/outro), valor total, parte do usuário
5. Saldo exibido: positivo = participante deve ao usuário; negativo = usuário deve ao participante
6. Registrar acerto: valor, direção (paguei/recebi), data → quita transações pendentes (FIFO)
7. Estornar acerto: reabre transações quitadas

### Fluxo 9: Administração (admin)
1. Acessar `/admin` (requer role admin)
2. Gerar/restaurar backup
3. Listar usuários, ver detalhes, resetar senha, verificar email, alterar role/status

---

## 7️⃣ Pontos Sensíveis / Complexidade Técnica

### Partes mais complexas
- **Importação CSV/JSON**: Parser com múltiplos formatos, classificação (novas/já importadas/ignoradas), expansão de parcelas, deduplicação
- **Importação OFX**: Parse XML (xml2js), detecção de encoding (chardet, iconv-lite), extração de BANKMSGSRSV1/STMTTRN, deduplicação por fitid; detecção de movimentação interna (padrões no MEMO) e sugestão de vínculo com Transferência
- **Settlement**: Lógica transacional; aplicação/remoção de tags em pagamentos; criação de sobra
- **Report Engine**: Flatten de pagamentos, regras por tag (add/subtract/ignore), agregações (default/devedor)
- **Parcelamento**: Preview vs persistência; expansão na importação (1 linha → N transações)
- **Patrimônio**: Evolução baseada em HistoricoSaldo (último saldo conhecido por subconta por data); TaxaCDI externa (BCB); rendimento estimado por percentualCDI
- **Conta Conjunta**: Cálculo de saldo a partir de transações pendentes; acerto FIFO (transações mais antigas quitadas primeiro); lógica de direção (paguei/recebi) vs saldo

### Riscos técnicos
- Processamento de importação assíncrono sem fila: falha silenciosa se processo morrer
- CORS `origin: '*'` em produção (configuração atual)
- Backup depende de `mongodump` no PATH (fallback para lógico)

### Gargalos conhecidos
- `fetchFilteredTransactions`: limite 50.000 linhas (MAX_EXPORT)
- Settlement: limite 500 gastos pendentes, 100 recebíveis na listagem

### Débitos técnicos conhecidos
- `validarMultiplas` em transacaoImportadaController: valida sem criar Transacao (inconsistência com fluxo de finalização)
- Código de debug (console.log) em transacaoImportadaController e importacaoController
- api.js: `importacaoApi` é legacy/não utilizado; o app usa `importacaoService` que envia FormData corretamente. `importacaoApi.uploadArquivo` chama rota inexistente `/importacoes/:id/arquivo`
- PDF de relatório: backend retorna JSON quando format=pdf (comentário "Fase 3: PDF no backend - por ora retornamos JSON")

---

## 8️⃣ Estado Atual do Projeto

### Implementado
- Autenticação (registro, login, JWT, verificação de email, redefinição de senha)
- CRUD de transações, categorias, tags
- Dashboard com resumo, gráfico, calendário, notas
- Importação em massa (CSV/JSON) com revisão e finalização
- Módulo de recebimentos (Settlement)
- Relatórios avançados com templates e modelos customizados
- Parcelamento de transações
- Export de transações
- Backup/restore (admin)
- Gerenciamento de usuários (admin)
- Responsividade
- **Módulo de Patrimônio**: CRUD instituições e subcontas, resumo (total, por instituição, por propósito), evolução patrimonial, histórico de saldo, confirmação de saldo, rendimento estimado (CDI), vinculação de transações a subcontas, alertas de subcontas desatualizadas, **Simulador de Rendimentos** (valor, % CDI, período)
- **Importação OFX**: Upload de extratos OFX, parse XML, TransacaoOFX, revisão, aprovação/ignorar, conversão em Transacao, detecção de movimentação interna e sugestão de vínculo com Transferência
- **Transferências**: CRUD entre subcontas, vinculação opcional com TransacaoOFX (movimentação interna)
- **Conta Conjunta (Vínculos)**: CRUD vínculos, transações com divisão (parteUsuario/parteOutro), saldo pendente, acertos FIFO, estorno de acerto

### Parcialmente implementado
- Export PDF de relatórios (frontend; backend retorna JSON)
- Modelos de relatório (CRUD existe; integração com report engine)
- PWA (apenas manifest; sem Service Worker)

### Planejado mas não implementado
- **Não informado** explicitamente no código

---

## 9️⃣ Resumo Estratégico Final

### Pontos fortes
- Arquitetura clara: backend em camadas, frontend com Context API
- Modelagem flexível: pagamentos com múltiplas pessoas e tags por categoria
- Deduplicação robusta na importação (CSV/JSON e OFX)
- Settlement com transações MongoDB
- Report engine extensível (templates + modelos)
- Suporte a parcelamento na criação e na importação
- Módulo Patrimônio bem integrado: instituições → subcontas → histórico; vinculação opcional de transações; TaxaCDI externa para rendimento estimado; Simulador de Rendimentos com CDI
- Importação OFX completa: parse de extratos bancários, detecção de movimentação interna, sugestão de vínculo com transferências
- Módulo Conta Conjunta: divisão de gastos com participante, acertos FIFO, integração com formulário de transação

### Pontos de melhoria
- Substituir processamento assíncrono de importação por fila (Bull, Agenda, etc.)
- Implementar Service Worker para offline
- Remover CORS permissivo em produção
- Remover código legacy `importacaoApi` em api.js (não utilizado; importacaoService é o correto)
- Implementar geração de PDF no backend
- Remover logs de debug em produção

### Grau de maturidade
- **Médio-alto**: funcionalidades core estáveis; módulos avançados (importação, settlement, relatórios) operacionais com débitos técnicos pontuais.

### Capacidade de escalabilidade
- **Moderada**: monólito; sem cache (Redis); sem fila; MongoDB como único banco. Escala vertical; para horizontal seria necessário stateless + fila.

### Preparação para novas funcionalidades
- **Boa**: módulos bem delimitados; extensão de relatórios e modelos é natural; novos fluxos podem reutilizar Transacao, Tag, Categoria. Atenção à consistência entre frontend e backend nas integrações.

---

*Documento gerado com base na análise do código-fonte. Última atualização: março/2026 (Simulador de Rendimentos, ajustes Settlement/Transacao, correção débito técnico importação).*
