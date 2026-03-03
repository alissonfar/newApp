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
  confirmarSaldo: async (id, { saldo, observacao, origem, tipo }) => {
    const response = await api.post(`/subcontas/${id}/confirmar-saldo`, { saldo, observacao, origem, tipo });
    return response.data;
  },
  obterHistorico: async (id, { tipo } = {}) => {
    const params = tipo ? `?tipo=${encodeURIComponent(tipo)}` : '';
    const response = await api.get(`/subcontas/${id}/historico${params}`);
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
  obterTaxaCDI: async (forceRefresh = false) => {
    const params = new URLSearchParams();
    if (forceRefresh) {
      params.append('force', '1');
      params.append('_t', String(Date.now())); // Cache-busting para evitar resposta em cache
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/taxa-cdi/atual${query}`);
    return response.data;
  },
  listarTransacoesPorSubconta: async (subcontaId) => {
    const dados = await obterTransacoes({ subconta: subcontaId });
    return dados.transacoes || [];
  },
  // Importação OFX
  listarImportacoesOFX: async () => {
    const response = await api.get('/patrimonio/importacoes-ofx');
    return response.data;
  },
  obterImportacaoOFX: async (id) => {
    const response = await api.get(`/patrimonio/importacoes-ofx/${id}`);
    return response.data;
  },
  uploadOFX: async (arquivo, subcontaId) => {
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    formData.append('subcontaId', subcontaId);
    const response = await api.post('/patrimonio/importacoes-ofx', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },
  atualizarTransacaoOFX: async (importacaoId, transacaoOFXId, dados) => {
    const response = await api.patch(
      `/patrimonio/importacoes-ofx/${importacaoId}/transacoes/${transacaoOFXId}`,
      dados
    );
    return response.data;
  },
  criarTransacaoDeOFX: async (importacaoId, transacaoOFXId) => {
    const response = await api.post(
      `/patrimonio/importacoes-ofx/${importacaoId}/transacoes/${transacaoOFXId}/criar-transacao`
    );
    return response.data;
  },
  finalizarImportacaoOFX: async (id) => {
    const response = await api.post(`/patrimonio/importacoes-ofx/${id}/finalizar`);
    return response.data;
  },
  cancelarImportacaoOFX: async (id) => {
    await api.delete(`/patrimonio/importacoes-ofx/${id}`);
  },
  listarTransferencias: async (status) => {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/patrimonio/transferencias${params}`);
    return response.data;
  },
  criarTransferencia: async (dados) => {
    const response = await api.post('/patrimonio/transferencias', dados);
    return response.data;
  },
  confirmarTransferencia: async (id) => {
    const response = await api.post(`/patrimonio/transferencias/${id}/confirmar`);
    return response.data;
  }
};

export default patrimonioApi;
