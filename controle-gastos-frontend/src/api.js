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

/* ----- Categorias ----- */
export async function obterCategorias() {
  const resposta = await fetch(`${API_BASE}/categorias`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return dados.map(cat => ({
    ...cat,
    codigo: cat._id
  }));
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
  // Mapeia _id para codigo para manter compatibilidade
  return dados.map(tag => ({
    ...tag,
    codigo: tag._id,
    // Garante que a categoria seja sempre o ID
    categoria: typeof tag.categoria === 'object' ? tag.categoria._id : tag.categoria
  }));
}

export async function criarTag(tag) {
  // Garante que a categoria seja enviada como ID
  const tagData = {
    ...tag,
    categoria: typeof tag.categoria === 'object' ? tag.categoria._id : tag.categoria
  };

  const resposta = await fetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(tagData)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id,
    // Garante que a categoria seja sempre o ID
    categoria: typeof dados.categoria === 'object' ? dados.categoria._id : dados.categoria
  };
}

export async function atualizarTag(codigo, tag) {
  // Garante que a categoria seja enviada como ID
  const tagData = {
    ...tag,
    _id: codigo,
    categoria: typeof tag.categoria === 'object' ? tag.categoria._id : tag.categoria
  };

  const resposta = await fetch(`${API_BASE}/tags/${codigo}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(tagData)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id,
    // Garante que a categoria seja sempre o ID
    categoria: typeof dados.categoria === 'object' ? dados.categoria._id : dados.categoria
  };
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
