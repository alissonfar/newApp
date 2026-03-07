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
  obterEventosLedger: async (subcontaId, { tipoEvento, dataInicio, dataFim, limit } = {}) => {
    const params = new URLSearchParams();
    if (tipoEvento) params.append('tipoEvento', tipoEvento);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (limit) params.append('limit', limit);
    const q = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/subcontas/${subcontaId}/eventos-ledger${q}`);
    return response.data;
  },
  obterSaldoPorLedger: async (subcontaId, ateData) => {
    const params = ateData ? `?ateData=${encodeURIComponent(ateData)}` : '';
    const response = await api.get(`/subcontas/${subcontaId}/saldo-ledger${params}`);
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
  // Patrimônio Histórico (baseado em Ledger)
  obterPatrimonioEmData: async (date, filtros = {}) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (filtros.subcontaIds?.length) params.append('subcontaIds', filtros.subcontaIds.join(','));
    if (filtros.tipo) params.append('tipo', filtros.tipo);
    if (filtros.proposito) params.append('proposito', filtros.proposito);
    if (filtros.origem) params.append('origem', filtros.origem);
    const q = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/net-worth/at-date${q}`);
    return response.data;
  },
  obterEvolucaoPatrimonioHistorico: async (startDate, endDate, interval = 'month', filtros = {}) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (interval) params.append('interval', interval);
    if (filtros.subcontaIds?.length) params.append('subcontaIds', filtros.subcontaIds.join(','));
    if (filtros.tipo) params.append('tipo', filtros.tipo);
    if (filtros.proposito) params.append('proposito', filtros.proposito);
    if (filtros.origem) params.append('origem', filtros.origem);
    const response = await api.get(`/net-worth/history?${params.toString()}`);
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
