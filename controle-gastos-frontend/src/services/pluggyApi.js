import api from './api';

const pluggyApi = {
  obterConfig: async () => {
    const response = await api.get('/pluggy/config');
    return response.data;
  },
  salvarConfig: async (dados) => {
    const response = await api.post('/pluggy/config', dados);
    return response.data;
  },
  testarConexao: async (dados) => {
    const response = await api.post('/pluggy/test-connection', dados);
    return response.data;
  },
  listarItems: async () => {
    const response = await api.get('/pluggy/items');
    return response.data;
  },
  listarAccountsDoItem: async (itemId, incluirCREDIT = false) => {
    const params = incluirCREDIT ? '?incluirCREDIT=true' : '';
    const response = await api.get(`/pluggy/items/${itemId}/accounts${params}`);
    return response.data;
  },
  adicionarItem: async (dados) => {
    const response = await api.post('/pluggy/items', dados);
    return response.data;
  },
  removerItem: async (itemId, accountId) => {
    const response = await api.delete(`/pluggy/items/${itemId}/${accountId}`);
    return response.data;
  },
  atualizarStatusItem: async (itemId) => {
    const response = await api.post(`/pluggy/items/${itemId}/refresh-status`);
    return response.data;
  },
  iniciarSync: async (opcoes = {}) => {
    const response = await api.post('/pluggy/sync', opcoes);
    return response.data;
  },
  listarImportacoes: async () => {
    const response = await api.get('/pluggy/importacoes');
    return response.data;
  },
  obterDetalhesImportacao: async (id) => {
    const response = await api.get(`/pluggy/importacoes/${id}`);
    return response.data;
  }
};

export default pluggyApi;
