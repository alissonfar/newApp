# Documentação do Módulo de Importação

## Visão Geral
O módulo de importação é responsável por gerenciar a importação em massa de transações no sistema. Ele permite que os usuários importem transações através de arquivos JSON ou CSV, além de oferecer funcionalidades para validação, edição e gerenciamento das transações importadas.

## Estrutura do Módulo

### Backend

#### Models

1. **Importacao (`/backend/src/models/importacao.js`)**
   - Gerencia os metadados da importação
   - Campos principais:
     - `descricao`: Descrição da importação
     - `status`: Estado atual ('pendente', 'processando', 'concluido', 'concluido_com_erros', 'erro')
     - `nomeArquivo`: Nome do arquivo original
     - `caminhoArquivo`: Local onde o arquivo está armazenado
     - `totalProcessado`, `totalSucesso`, `totalErro`: Estatísticas de processamento
     - `usuario`: Referência ao usuário que criou a importação

2. **TransacaoImportada (`/backend/src/models/transacaoImportada.js`)**
   - Gerencia as transações individuais importadas
   - Campos principais:
     - `importacao`: Referência à importação
     - `descricao`, `valor`, `data`, `tipo`: Dados da transação
     - `status`: Estado da transação ('pendente', 'validada', 'erro')
     - `pagamentos`: Array de pagamentos com pessoa, valor e tags
     - `dadosOriginais`: Dados brutos da importação
     - `usuario`: Referência ao usuário

#### Controllers

1. **ImportacaoController (`/backend/src/controllers/importacaoController.js`)**
   - Gerencia operações principais de importação
   - Métodos:
     - `criar`: Inicia nova importação
     - `listar`: Lista importações do usuário
     - `obterDetalhes`: Obtém detalhes de uma importação
     - `excluir`: Remove uma importação

2. **TransacaoImportadaController (`/backend/src/controllers/transacaoImportadaController.js`)**
   - Gerencia operações em transações importadas
   - Métodos:
     - `listarTransacoes`: Lista transações de uma importação
     - `atualizarTransacao`: Atualiza dados de uma transação
     - `validarTransacao`: Converte transação importada em transação normal
     - `marcarErro`: Marca transação com erro
     - `validarMultiplas`: Valida várias transações de uma vez

#### Services

1. **ImportacaoService (`/backend/src/services/importacaoService.js`)**
   - Lógica de negócio para processamento de importações
   - Funcionalidades:
     - Processamento de arquivos JSON e CSV
     - Validação de dados
     - Gerenciamento de estado da importação
     - Conversão de formatos

### Frontend

#### Pages

1. **NovaImportacaoPage (`/src/pages/ImportacaoMassa/NovaImportacaoPage.js`)**
   - Interface para iniciar nova importação
   - Componentes:
     - Formulário de upload
     - Seleção de arquivo
     - Campo de descrição

2. **GerenciamentoImportacoesPage (`/src/pages/ImportacaoMassa/GerenciamentoImportacoesPage.js`)**
   - Lista todas as importações
   - Funcionalidades:
     - Filtros e paginação
     - Ações por importação
     - Visualização de estatísticas

3. **DetalhesImportacaoPage (`/src/pages/ImportacaoMassa/DetalhesImportacaoPage.js`)**
   - Detalhes e gerenciamento de uma importação
   - Funcionalidades:
     - Lista de transações
     - Edição de transações
     - Validação individual ou em massa
     - Finalização da importação

#### Services

1. **importacaoService (`/src/services/importacaoService.js`)**
   - Interface com a API do backend
   - Métodos principais:
     - `criarImportacao`: Cria nova importação
     - `listarImportacoes`: Lista importações
     - `obterImportacao`: Obtém detalhes
     - `listarTransacoes`: Lista transações
     - `atualizarTransacao`: Atualiza transação
     - `validarTransacao`: Valida transação
     - `finalizarImportacao`: Finaliza importação

#### Context

1. **ImportacaoContext (`/src/contexts/ImportacaoContext.js`)**
   - Gerenciamento de estado global
   - Estados:
     - `importacaoAtual`: Importação em processamento
     - `transacoes`: Lista de transações
     - `progresso`: Estado do processamento
     - `filtros`: Filtros aplicados

## Fluxo de Importação

1. **Início da Importação**
   - Usuário acessa página de nova importação
   - Seleciona arquivo (JSON/CSV)
   - Fornece descrição
   - Submete formulário

2. **Processamento do Arquivo**
   - Backend recebe arquivo
   - Valida formato
   - Inicia processamento assíncrono
   - Cria registro de importação

3. **Processamento das Transações**
   - Arquivo é lido e parseado
   - Cada transação é validada
   - Transações são salvas como `TransacaoImportada`
   - Estatísticas são atualizadas

4. **Revisão e Edição**
   - Usuário revisa transações importadas
   - Pode editar transações individuais
   - Pode validar transações
   - Pode marcar erros

5. **Finalização**
   - Usuário finaliza importação
   - Transações validadas são convertidas
   - Importação é marcada como concluída

## Rotas da API

### Importação
- `POST /importacoes`: Cria nova importação
- `GET /importacoes`: Lista importações
- `GET /importacoes/:id`: Obtém detalhes
- `DELETE /importacoes/:id`: Remove importação

### Transações
- `GET /importacoes/:importacaoId/transacoes`: Lista transações
- `PUT /importacoes/transacoes/:id`: Atualiza transação
- `POST /importacoes/transacoes/:id/validar`: Valida transação
- `POST /importacoes/transacoes/:id/erro`: Marca erro
- `POST /importacoes/transacoes/validar-multiplas`: Valida múltiplas

## Considerações de Segurança

1. **Autenticação**
   - Todas as rotas requerem autenticação
   - Usuário só acessa suas próprias importações
   - Token JWT utilizado para autenticação

2. **Validação de Arquivos**
   - Limite de tamanho: 10MB
   - Tipos permitidos: JSON, CSV
   - Validação de conteúdo antes do processamento

3. **Processamento Assíncrono**
   - Arquivos grandes são processados em background
   - Usuário pode acompanhar progresso
   - Sistema mantém consistência em caso de erros

## Boas Práticas

1. **Logs**
   - Todas as operações são logadas
   - Erros são registrados com detalhes
   - Logs incluem IDs para rastreamento

2. **Tratamento de Erros**
   - Erros são capturados e tratados
   - Mensagens amigáveis para usuário
   - Detalhes técnicos nos logs

3. **Performance**
   - Paginação em listagens
   - Processamento em lotes
   - Índices otimizados no banco

## Manutenção

1. **Arquivos Temporários**
   - Arquivos são removidos após processamento
   - Sistema limpa arquivos órfãos periodicamente

2. **Monitoramento**
   - Estatísticas de uso são mantidas
   - Erros são monitorados
   - Performance é acompanhada 