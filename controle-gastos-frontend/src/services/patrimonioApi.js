import api from './api';
import { obterTransacoes } from '../api';

const patrimonioApi = {
  listarInstituicoes: async () => {
    const response = await api.get('/instituicoes');
    return response.data;
  },
  obterInstituicao: async (id) => {
    const response = await api.get(`/instituicoes/${id}`);
    return response.data;
  },
  criarInstituicao: async (dados) => {
    const response = await api.post('/instituicoes', dados);
    return response.data;
  },
  atualizarInstituicao: async (id, dados) => {
    const response = await api.put(`/instituicoes/${id}`, dados);
    return response.data;
  },
  excluirInstituicao: async (id) => {
    const response = await api.delete(`/instituicoes/${id}`);
    return response.data;
  },
  listarSubcontas: async () => {
    const response = await api.get('/subcontas');
    return response.data;
  },
  obterSubconta: async (id) => {
    const response = await api.get(`/subcontas/${id}`);
    return response.data;
  },
  criarSubconta: async (dados) => {
    const response = await api.post('/subcontas', dados);
    return response.data;
  },
  atualizarSubconta: async (id, dados) => {
    const response = await api.put(`/subcontas/${id}`, dados);
    return response.data;
  },
  excluirSubconta: async (id) => {
    const response = await api.delete(`/subcontas/${id}`);
    return response.data;
  },
  confirmarSaldo: async (id, { saldo, observacao, origem }) => {
    const response = await api.post(`/subcontas/${id}/confirmar-saldo`, { saldo, observacao, origem });
    return response.data;
  },
  obterHistorico: async (id) => {
    const response = await api.get(`/subcontas/${id}/historico`);
    return response.data;
  },
  obterRendimentoEstimado: async (id) => {
    const response = await api.get(`/subcontas/${id}/rendimento-estimado`);
    return response.data;
  },
  obterResumoPatrimonio: async () => {
    const response = await api.get('/patrimonio/resumo');
    return response.data;
  },
  obterEvolucaoPatrimonio: async (dataInicio, dataFim) => {
    const params = new URLSearchParams();
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    const response = await api.get(`/patrimonio/evolucao?${params.toString()}`);
    return response.data;
  },
  obterTaxaCDI: async () => {
    const response = await api.get('/taxa-cdi/atual');
    return response.data;
  },
  listarTransacoesPorSubconta: async (subcontaId) => {
    const dados = await obterTransacoes({ subconta: subcontaId });
    return dados.transacoes || [];
  }
};

export default patrimonioApi;
