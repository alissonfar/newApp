import api from './api';

const contaFixaApi = {
  listar: async () => {
    const response = await api.get('/contas-fixas');
    return response.data;
  },

  obter: async (id) => {
    const response = await api.get(`/contas-fixas/${id}`);
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/contas-fixas', dados);
    return response.data;
  },

  atualizar: async (id, dados) => {
    const response = await api.put(`/contas-fixas/${id}`, dados);
    return response.data;
  },

  excluir: async (id) => {
    await api.delete(`/contas-fixas/${id}`);
  },

  pausar: async (id) => {
    const response = await api.post(`/contas-fixas/${id}/pausar`);
    return response.data;
  },

  reativar: async (id) => {
    const response = await api.post(`/contas-fixas/${id}/reativar`);
    return response.data;
  },

  listarPendencias: async () => {
    const response = await api.get('/contas-fixas/pendencias');
    return response.data;
  },

  confirmar: async (id, dados) => {
    const response = await api.post(`/contas-fixas/${id}/confirmar`, dados);
    return response.data;
  },

  pular: async (id) => {
    const response = await api.post(`/contas-fixas/${id}/pular`);
    return response.data;
  }
};

export default contaFixaApi;
