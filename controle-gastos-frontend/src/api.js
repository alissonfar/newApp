// src/api.js
import api from './services/api';

const API_BASE = process.env.REACT_APP_API_BASE;

// Utilitário para obter o token armazenado
function getToken() {
  return localStorage.getItem('token') || '';
}

// Monta os headers padrão para as requisições
function getHeaders(isJson = true) {
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/* ----- Categorias ----- */
export async function obterCategorias(incluirInativas = false) {
  const query = incluirInativas ? '?incluirInativas=true' : '';
  const resposta = await fetch(`${API_BASE}/categorias${query}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    console.error("Resposta inválida em obterCategorias:", resposta.status, dados);
    throw new Error(dados?.erro || `Erro ${resposta.status} ao obter categorias.`);
  }

  if (!Array.isArray(dados)) {
    console.error("Formato inesperado em obterCategorias:", typeof dados, dados);
    return [];
  }

  return dados.map(cat => ({
    ...cat,
    codigo: cat._id
  }));
}

export async function ativarCategoria(codigo) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}/ativar`, {
    method: 'PUT',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro ao ativar categoria.');
  }
  return { ...dados, codigo: dados._id };
}

export async function inativarCategoria(codigo) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}/inativar`, {
    method: 'PUT',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro ao inativar categoria.');
  }
  return { ...dados, codigo: dados._id };
}

export async function criarCategoria(categoria) {
  const resposta = await fetch(`${API_BASE}/categorias`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(categoria)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function atualizarCategoria(codigo, categoria) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      ...categoria,
      _id: codigo // Adiciona o _id no corpo da requisição
    })
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function excluirCategoria(codigo) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

/* ----- Tags ----- */
export async function obterTags() {
  const resposta = await fetch(`${API_BASE}/tags`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    console.error("Resposta inválida em obterTags:", resposta.status, dados);
    throw new Error(dados?.erro || `Erro ${resposta.status} ao obter tags.`);
  }

  if (!Array.isArray(dados)) {
    console.error("Formato inesperado em obterTags:", typeof dados, dados);
    return [];
  }

  return dados.map(tag => ({
    ...tag,
    codigo: tag._id
  }));
}

export async function criarTag(tag) {
  const resposta = await fetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(tag)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function atualizarTag(codigo, tag) {
  const resposta = await fetch(`${API_BASE}/tags/${codigo}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      ...tag,
      _id: codigo // Adiciona o _id no corpo da requisição
    })
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function obterTagInsights() {
  const { data } = await api.get('/dashboard/tag-insights');
  return Array.isArray(data) ? data : [];
}

export async function excluirTag(codigo) {
  const resposta = await fetch(`${API_BASE}/tags/${codigo}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

/* ----- Autenticação ----- */
// Registrar usuário
export async function registrarUsuario({ nome, email, senha }) {
  const resposta = await fetch(`${API_BASE}/usuarios/registrar`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ nome, email, senha })
  });
  return await resposta.json();
}

// Fazer login
export async function loginUsuario({ email, senha }) {
  const resposta = await fetch(`${API_BASE}/usuarios/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, senha })
  });
  return await resposta.json();
}

/* ----- Transações ----- */
export async function obterTransacoes(params = {}) {
  const query = new URLSearchParams(params).toString();
  const resposta = await fetch(`${API_BASE}/transacoes?${query}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  if (!resposta.ok || dados?.erro) {
    console.error("Resposta inválida em obterTransacoes:", resposta.status, dados);
    throw new Error(dados?.erro || `Erro ${resposta.status} ao obter transações.`);
  }

  if (Array.isArray(dados.transacoes)) {
    dados.transacoes = dados.transacoes.map(t => ({
      ...t,
      id: t._id,
    }));
  }
  return dados;
}

export async function obterTransacoesPaginadas(params = {}) {
  const q = new URLSearchParams();
  if (params.page != null) q.set('page', params.page);
  if (params.limit != null) q.set('limit', params.limit);
  if (params.dataInicio) q.set('dataInicio', params.dataInicio);
  if (params.dataFim) q.set('dataFim', params.dataFim);
  if (params.tipo) q.set('tipo', params.tipo);
  if (params.search) q.set('search', params.search);
  if (params.sortBy) q.set('sortBy', params.sortBy);
  if (params.sortDir) q.set('sortDir', params.sortDir);
  if (params.pessoas?.length) {
    params.pessoas.forEach(p => q.append('pessoas', p));
  }
  if (params.excludePessoas?.length) {
    params.excludePessoas.forEach(p => q.append('excludePessoas', p));
  }
  if (params.tagsFilter && Object.keys(params.tagsFilter).length > 0) {
    q.set('tagsFilter', JSON.stringify(params.tagsFilter));
  }
  const resposta = await fetch(`${API_BASE}/transacoes?${q.toString()}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  if (!resposta.ok || dados?.erro) {
    console.error("Resposta inválida em obterTransacoesPaginadas:", resposta.status, dados);
    throw new Error(dados?.erro || `Erro ${resposta.status} ao obter transações.`);
  }

  if (Array.isArray(dados.data)) {
    dados.data = dados.data.map(t => ({ ...t, id: t._id }));
  }
  return dados;
}

export async function obterTransacaoPorId(id) {
  const resposta = await fetch(`${API_BASE}/transacoes/${id}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados._id ? { ...dados, id: dados._id } : dados;
}

export async function obterPessoasDistintas() {
  const resposta = await fetch(`${API_BASE}/transacoes/distinct-pessoas`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados.pessoas || [];
}

export async function obterTransacoesExport(params = {}) {
  const q = new URLSearchParams();
  if (params.dataInicio) q.set('dataInicio', params.dataInicio);
  if (params.dataFim) q.set('dataFim', params.dataFim);
  if (params.tipo) q.set('tipo', params.tipo);
  if (params.search) q.set('search', params.search);
  if (params.sortBy) q.set('sortBy', params.sortBy);
  if (params.sortDir) q.set('sortDir', params.sortDir);
  if (params.pessoas?.length) {
    params.pessoas.forEach(p => q.append('pessoas', p));
  }
  if (params.excludePessoas?.length) {
    params.excludePessoas.forEach(p => q.append('excludePessoas', p));
  }
  if (params.tagsFilter && Object.keys(params.tagsFilter).length > 0) {
    q.set('tagsFilter', JSON.stringify(params.tagsFilter));
  }
  const resposta = await fetch(`${API_BASE}/transacoes/export?${q.toString()}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  if (!resposta.ok || dados?.erro) {
    console.error("Resposta inválida em obterTransacoesExport:", resposta.status, dados);
    throw new Error(dados?.erro || `Erro ${resposta.status} ao exportar transações.`);
  }

  if (Array.isArray(dados.transacoes)) {
    dados.transacoes = dados.transacoes.map(t => ({ ...t, id: t._id }));
  }
  return dados;
}

export async function gerarRelatorioAvancado(params = {}) {
  const resposta = await fetch(`${API_BASE}/reports/advanced`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      templateId: params.templateId || 'simples',
      filters: params.filters || {},
      format: params.format || 'json'
    })
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados;
}

export async function listarTemplatesRelatorio() {
  const resposta = await fetch(`${API_BASE}/reports/templates`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados.templates || [];
}

/* ----- Modelos de Relatório ----- */
export async function listarModelosRelatorio() {
  const resposta = await fetch(`${API_BASE}/modelos-relatorio`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return Array.isArray(dados) ? dados : [];
}

export async function obterModeloRelatorio(id) {
  const resposta = await fetch(`${API_BASE}/modelos-relatorio/${id}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados;
}

export async function criarModeloRelatorio(modelo) {
  const resposta = await fetch(`${API_BASE}/modelos-relatorio`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(modelo)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados;
}

export async function atualizarModeloRelatorio(id, modelo) {
  const resposta = await fetch(`${API_BASE}/modelos-relatorio/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(modelo)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados;
}

export async function excluirModeloRelatorio(id) {
  const resposta = await fetch(`${API_BASE}/modelos-relatorio/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (dados.erro) throw new Error(dados.erro);
  return dados;
}

export async function criarTransacao(transacao) {
  const resposta = await fetch(`${API_BASE}/transacoes`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(transacao)
  });
  return await resposta.json();
}

export async function atualizarTransacao(id, transacao) {
  const resposta = await fetch(`${API_BASE}/transacoes/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(transacao)
  });
  return await resposta.json();
}

export async function excluirTransacao(id) {
  const resposta = await fetch(`${API_BASE}/transacoes/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  return await resposta.json();
}

export async function estornarParcelamento(installmentGroupId) {
  const resposta = await fetch(`${API_BASE}/transacoes/parcelamento/${installmentGroupId}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  return await resposta.json();
}

export async function obterPreviewParcelas({ totalAmount, totalInstallments, intervalInDays, startDate }) {
  const params = new URLSearchParams({
    totalAmount: String(totalAmount || 0),
    totalInstallments: String(totalInstallments || 2),
    intervalInDays: String(intervalInDays || 30),
    startDate: startDate || new Date().toISOString().split('T')[0]
  });
  const resposta = await fetch(`${API_BASE}/transacoes/preview-parcelas?${params}`, {
    headers: getHeaders(false)
  });
  return await resposta.json();
}

// Função para registrar transações em massa
export const registrarTransacoesEmMassa = async (transacoes) => {
  try {
    const response = await fetch(`${API_BASE}/transacoes/bulk`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ transacoes })
    });
    return await response.json();
  } catch (error) {
    throw error.response?.data || error;
  }
};

/* ----- Relatório ----- */
export async function obterRelatorio() {
  const resposta = await fetch(`${API_BASE}/relatorio`, {
    headers: getHeaders(false)
  });
  return await resposta.json();
}

/* ----- Settlements (Conciliação de Recebimentos) ----- */
export async function listarSettlements(params = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.limit) q.set('limit', params.limit);
  const resposta = await fetch(`${API_BASE}/settlements?${q.toString()}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao listar conciliações.');
  return dados;
}

export async function listarRecebimentosDisponiveis(params = {}) {
  const { signal, ...rest } = params;
  const q = new URLSearchParams();
  if (rest.dataInicio) q.set('dataInicio', rest.dataInicio);
  if (rest.dataFim) q.set('dataFim', rest.dataFim);
  const fetchOpts = { headers: getHeaders(false) };
  if (signal) fetchOpts.signal = signal;
  const resposta = await fetch(`${API_BASE}/settlements/recebimentos-disponiveis?${q.toString()}`, fetchOpts);
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao listar recebimentos.');
  return dados.transacoes || [];
}

export async function listarPendentes(params = {}) {
  const { signal, ...rest } = params;
  const q = new URLSearchParams();
  if (rest.pessoa) q.set('pessoa', rest.pessoa);
  if (rest.pessoas?.length) rest.pessoas.forEach(p => q.append('pessoas', p));
  if (rest.dataInicio) q.set('dataInicio', rest.dataInicio);
  if (rest.dataFim) q.set('dataFim', rest.dataFim);
  if (rest.excludeTransactionId) q.set('excludeTransactionId', rest.excludeTransactionId);
  const fetchOpts = { headers: getHeaders(false) };
  if (signal) fetchOpts.signal = signal;
  const resposta = await fetch(`${API_BASE}/settlements/pendentes?${q.toString()}`, fetchOpts);
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao listar pendentes.');
  return dados.transacoes || [];
}

export async function criarSettlement(dados) {
  const resposta = await fetch(`${API_BASE}/settlements`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(dados)
  });
  const dadosResposta = await resposta.json();
  if (!resposta.ok || dadosResposta?.erro) throw new Error(dadosResposta?.erro || 'Erro ao criar conciliação.');
  return dadosResposta;
}

export async function excluirSettlement(id) {
  const resposta = await fetch(`${API_BASE}/settlements/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao excluir conciliação.');
  return dados;
}

/* ----- Vínculos Conjuntos (Conta Conjunta) ----- */
export async function listarVinculosConjuntos() {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao listar vínculos.');
  return Array.isArray(dados) ? dados : [];
}

export async function criarVinculoConjunto(dados) {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(dados)
  });
  const dadosResposta = await resposta.json();
  if (!resposta.ok || dadosResposta?.erro) throw new Error(dadosResposta?.erro || 'Erro ao criar vínculo.');
  return dadosResposta;
}

export async function obterVinculoConjunto(id) {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos/${id}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao obter vínculo.');
  return dados;
}

export async function atualizarVinculoConjunto(id, dados) {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(dados)
  });
  const dadosResposta = await resposta.json();
  if (!resposta.ok || dadosResposta?.erro) throw new Error(dadosResposta?.erro || 'Erro ao atualizar vínculo.');
  return dadosResposta;
}

export async function excluirVinculoConjunto(id) {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao excluir vínculo.');
  return dados;
}

export async function obterSaldoVinculo(id) {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos/${id}/saldo`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao obter saldo.');
  return dados;
}

export async function obterResumoVinculo(id, params = {}) {
  const q = new URLSearchParams();
  if (params.dataInicio) q.set('dataInicio', params.dataInicio);
  if (params.dataFim) q.set('dataFim', params.dataFim);
  const query = q.toString();
  const url = `${API_BASE}/vinculos-conjuntos/${id}/resumo${query ? '?' + query : ''}`;
  const resposta = await fetch(url, { headers: getHeaders(false) });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao obter resumo.');
  return dados;
}

export async function listarTransacoesVinculo(id, params = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.limit) q.set('limit', params.limit);
  if (params.dataInicio) q.set('dataInicio', params.dataInicio);
  if (params.dataFim) q.set('dataFim', params.dataFim);
  if (params.pendente !== undefined) q.set('pendente', params.pendente);
  if (params.euDevo === true) q.set('euDevo', 'true');
  if (params.outroDeve === true) q.set('outroDeve', 'true');
  const query = q.toString();
  const url = `${API_BASE}/vinculos-conjuntos/${id}/transacoes${query ? '?' + query : ''}`;
  const resposta = await fetch(url, { headers: getHeaders(false) });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao listar transações.');
  return dados;
}

export async function obterExtratoVinculo(id, params = {}) {
  const q = new URLSearchParams();
  if (params.dataInicio) q.set('dataInicio', params.dataInicio);
  if (params.dataFim) q.set('dataFim', params.dataFim);
  if (params.limit) q.set('limit', params.limit);
  if (params.page) q.set('page', params.page);
  const query = q.toString();
  const url = `${API_BASE}/vinculos-conjuntos/${id}/extrato${query ? '?' + query : ''}`;
  const resposta = await fetch(url, { headers: getHeaders(false) });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao obter extrato.');
  return dados;
}

export async function listarAcertosVinculo(id) {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos/${id}/acertos`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao listar acertos.');
  return Array.isArray(dados) ? dados : [];
}

export async function registrarAcertoVinculo(vinculoId, dados) {
  const resposta = await fetch(`${API_BASE}/vinculos-conjuntos/${vinculoId}/acertos`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(dados)
  });
  const dadosResposta = await resposta.json();
  if (!resposta.ok || dadosResposta?.erro) throw new Error(dadosResposta?.erro || 'Erro ao registrar acerto.');
  return dadosResposta;
}

export async function estornarAcerto(acertoId) {
  const resposta = await fetch(`${API_BASE}/acertos/${acertoId}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok || dados?.erro) throw new Error(dados?.erro || 'Erro ao estornar acerto.');
  return dados;
}

