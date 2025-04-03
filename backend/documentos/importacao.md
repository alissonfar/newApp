Plano de Implementação - Funcionalidade de Importação em Massa
Visão Geral
A funcionalidade permitirá que usuários importem dados financeiros em massa a partir de arquivos JSON ou CSV (com possibilidade de expansão para outros formatos). Cada importação será tratada como um objeto no sistema, contendo informações básicas e as transações extraídas do arquivo, que poderão ser revisadas e editadas individualmente antes de serem salvas no banco de dados.
Arquitetura
Estrutura de Dados
javascriptCopiar// Modelo de importação
const importacaoSchema = {
  descricao: String,
  dataImportacao: Date,
  tipoArquivo: String, // "json", "csv", etc.
  status: String, // "em_andamento", "finalizada"
  transacoes: [
    {
      // Dados originais extraídos do arquivo
      dados: {
        tipo: String,
        descricao: String,
        valor: Number,
        data: Date,
        // outros campos que venham no arquivo
      },
      status: String, // "pendente", "salva"
      transacaoId: { type: ObjectId, ref: 'Transacao' } // Referência à transação salva
    }
  ]
}
Arquitetura Modular de Processadores

Diretório de processadores: /src/services/importacao/processadores/

processadorJSON.js
processadorCSV.js
Possibilidade de adicionar novos processadores no futuro


Interface comum para processadores:
javascriptCopiar{
  // Verifica se o arquivo é válido para este processador
  validarArquivo(arquivo),
  
  // Extrai transações do arquivo e retorna no formato padrão
  extrairTransacoes(arquivo),
  
  // Valida cada transação extraída
  validarTransacao(transacao)
}

Registro e fábrica de processadores:
javascriptCopiar// Registro de processadores
const processadores = {
  'json': require('./processadores/processadorJSON'),
  'csv': require('./processadores/processadorCSV'),
};

// Fábrica de processadores
function obterProcessador(tipoArquivo) {
  const processador = processadores[tipoArquivo.toLowerCase()];
  if (!processador) {
    throw new Error(`Processador para o tipo '${tipoArquivo}' não encontrado`);
  }
  return processador;
}


Fluxo Detalhado
1. Criação da Importação

Usuário acessa a seção de "Nova Importação"
Preenche informações básicas (descrição, etc.)
Seleciona o tipo de arquivo (JSON, CSV)
Faz upload do arquivo

2. Processamento do Arquivo

Backend recebe o arquivo e identifica o tipo
Seleciona o processador apropriado usando a fábrica
Processador valida o arquivo
Processador extrai as transações do arquivo
Cada transação é validada pelo processador
O sistema cria um objeto de importação com as transações extraídas
Todas as transações iniciam com status "pendente"

3. Revisão e Edição de Transações

Frontend exibe lista de transações extraídas com status
Implementa filtros para ordenar transações (por data, valor, etc.)
Ao selecionar uma transação, o sistema preenche o formulário existente com os dados extraídos
Usuário pode editar os dados e adicionar informações complementares (pagamentos, tags, etc.)
Ao salvar, a transação é salva no banco e seu status muda para "salva" na lista
A lista é atualizada com indicadores visuais para transações salvas vs. pendentes

4. Persistência e Continuidade

Usuário pode interromper o processo a qualquer momento
O estado atual da importação é salvo (transações pendentes e já salvas)
Usuário pode retornar posteriormente e continuar de onde parou
Transações já salvas permanecem marcadas como "salvas"

5. Finalização

Quando todas as transações forem revisadas/salvas, usuário pode finalizar a importação
Sistema verifica se há transações pendentes e alerta o usuário
Ao confirmar finalização, status da importação muda para "finalizada"
Sistema exibe resumo da importação (total de transações, valores, etc.)

Componentes de Interface
Tela de Criação de Importação

Campos para descrição
Seletor de tipo de arquivo
Uploader de arquivo
Botão para iniciar processamento

Tela de Processamento/Revisão

Lista de transações extraídas
Status de cada transação (pendente/salva)
Filtros para ordenação
Indicador de progresso (ex: 3/10 transações salvas)
Botões de ação (editar, pular)
Botões para salvar estado ou finalizar

Tela de Edição de Transação

Formulário existente de transação, pré-preenchido com dados extraídos:

Tipo (gasto/receita)
Descrição
Valor
Data


Campos para complemento manual:

Pagamentos (pessoas, valores)
Tags
Observações


Botões para salvar, pular, cancelar

Implementação Backend
Rotas da API

POST /api/importacoes - Criar nova importação
POST /api/importacoes/:id/arquivo - Upload de arquivo para importação
GET /api/importacoes/:id - Obter detalhes da importação
GET /api/importacoes/:id/transacoes - Listar transações da importação
PUT /api/importacoes/:id/transacoes/:transacaoId - Salvar transação
PUT /api/importacoes/:id/finalizar - Finalizar importação

Controladores

ImportacaoController - Gerencia importações
TransacaoImportadaController - Gerencia transações da importação

Serviços

ImportacaoService - Lógica de negócio para importações
ProcessadorService - Gerencia processadores de arquivo

Implementação Frontend
Componentes React

ImportacaoForm - Formulário para criar importação
FileUploader - Componente para upload de arquivo
TransacaoList - Lista de transações da importação
TransacaoFilter - Filtros para ordenar transações
ProgressIndicator - Indicador de progresso da importação
TransacaoForm - Formulário existente adaptado para receber dados da importação

Estado e Gerenciamento

Usar Context API ou Redux para gerenciar estado da importação
Implementar persistência local para continuar trabalho interrompido

Considerações Adicionais
Segurança

Validar tipos de arquivo permitidos
Limitar tamanho máximo de arquivos
Sanitizar dados importados

Performance

Implementar paginação para importações grandes
Considerar processamento assíncrono para arquivos muito grandes

Escalabilidade

Estrutura modular permite adicionar novos tipos de importação
Cada processador encapsula lógica específica do formato