import api from './api';

const importacaoService = {
  // Criar nova importação
  criarImportacao: async (descricao, tipoArquivo) => {
    try {
      const response = await api.post('/importacoes', { descricao, tipoArquivo });
      return response.data;
    } catch (error) {
      throw new Error('Erro ao criar importação: ' + error.message);
    }
  },

  // Upload do arquivo
  uploadArquivo: async (importacaoId, arquivo) => {
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);

      const response = await api.post(`/importacoes/${importacaoId}/arquivo`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error('Erro ao fazer upload do arquivo: ' + error.message);
    }
  },

  // Obter detalhes de uma importação
  obterImportacao: async (importacaoId) => {
    try {
      const response = await api.get(`/importacoes/${importacaoId}`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao obter detalhes da importação: ' + error.message);
    }
  },

  // Listar todas as importações
  listarImportacoes: async () => {
    try {
      const response = await api.get('/importacoes');
      return response.data;
    } catch (error) {
      throw new Error('Erro ao listar importações: ' + error.message);
    }
  },

  // Listar transações de uma importação
  listarTransacoes: async (importacaoId) => {
    try {
      const response = await api.get(`/importacoes/${importacaoId}/transacoes`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao listar transações da importação: ' + error.message);
    }
  },

  // Salvar uma transação da importação
  salvarTransacao: async (importacaoId, transacaoId, dados) => {
    try {
      const response = await api.put(`/importacoes/${importacaoId}/transacoes/${transacaoId}`, dados);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao salvar transação: ' + error.message);
    }
  },

  // Finalizar importação
  finalizarImportacao: async (importacaoId) => {
    try {
      const response = await api.put(`/importacoes/${importacaoId}/finalizar`);
      return response.data;
    } catch (error) {
      throw new Error('Erro ao finalizar importação: ' + error.message);
    }
  }
};

export default importacaoService; 