import api from './api';

export const criarRegra = async (regra) => {
  const response = await api.post('/regras', regra);
  return response.data;
};

export const listarRegras = async () => {
  const response = await api.get('/regras');
  return response.data;
};

export const obterRegraPorId = async (id) => {
  const response = await api.get(`/regras/${id}`);
  return response.data;
};

export const atualizarRegra = async (id, regra) => {
  const response = await api.put(`/regras/${id}`, regra);
  return response.data;
};

export const excluirRegra = async (id) => {
  const response = await api.delete(`/regras/${id}`);
  return response.data;
};

export const simularRegra = async (id) => {
  const response = await api.post(`/regras/${id}/simular`);
  return response.data;
};

export const executarRegra = async (id) => {
  const response = await api.post(`/regras/${id}/executar`);
  return response.data;
};

export const desfazerUltimaExecucao = async (id) => {
  const response = await api.post(`/regras/${id}/desfazer`);
  return response.data;
};

export const obterOpcoesCampos = async () => {
  const response = await api.get('/regras/opcoes');
  return response.data;
};