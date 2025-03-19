// src/api.js

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
  // Adiciona o parâmetro proprietario na query string se estiver definido
  const query = new URLSearchParams(params).toString();
  const resposta = await fetch(`${API_BASE}/transacoes?${query}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  // Mapeia _id para id
  if (dados.transacoes) {
    dados.transacoes = dados.transacoes.map(t => ({
      ...t,
      id: t._id,
    }));
  }
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

/* ----- Tags ----- */
export async function obterTags() {
  const resposta = await fetch(`${API_BASE}/tags`, {
    headers: getHeaders(false)
  });
  return await resposta.json();
}

export async function criarTag(tag) {
  const resposta = await fetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(tag)
  });
  return await resposta.json();
}

export async function atualizarTag(id, tag) {
  const resposta = await fetch(`${API_BASE}/tags/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(tag)
  });
  return await resposta.json();
}

export async function excluirTag(id) {
  const resposta = await fetch(`${API_BASE}/tags/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  return await resposta.json();
}

/* ----- Categorias ----- */
export async function obterCategorias() {
  const resposta = await fetch(`${API_BASE}/categorias`, {
    headers: getHeaders(false)
  });
  return await resposta.json();
}

export async function criarCategoria(categoria) {
  const resposta = await fetch(`${API_BASE}/categorias`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(categoria)
  });
  return await resposta.json();
}

export async function atualizarCategoria(id, categoria) {
  const resposta = await fetch(`${API_BASE}/categorias/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(categoria)
  });
  return await resposta.json();
}

export async function excluirCategoria(id) {
  const resposta = await fetch(`${API_BASE}/categorias/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  return await resposta.json();
}
