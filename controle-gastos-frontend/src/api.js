// src/api.js

const API_BASE = 'https://newapp-ridz.onrender.com/api';

export async function obterTransacoes(params = {}) {
  const query = new URLSearchParams(params).toString();
  const resposta = await fetch(`${API_BASE}/transacoes?${query}`);
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transacao)
  });
  return await resposta.json();
}

export async function atualizarTransacao(id, transacao) {
  const resposta = await fetch(`${API_BASE}/transacoes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transacao)
  });
  return await resposta.json();
}

export async function excluirTransacao(id) {
  const resposta = await fetch(`${API_BASE}/transacoes/${id}`, {
    method: 'DELETE'
  });
  return await resposta.json();
}

export async function obterRelatorio() {
  const resposta = await fetch(`${API_BASE}/relatorio`);
  return await resposta.json();
}

export async function obterTags() {
  const resposta = await fetch(`${API_BASE}/tags`);
  return await resposta.json();
}

export async function criarTag(tag) {
  const resposta = await fetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tag)
  });
  return await resposta.json();
}

export async function atualizarTag(id, tag) {
  const resposta = await fetch(`${API_BASE}/tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tag)
  });
  return await resposta.json();
}

export async function excluirTag(id) {
  const resposta = await fetch(`${API_BASE}/tags/${id}`, {
    method: 'DELETE'
  });
  return await resposta.json();
}

export async function obterCategorias() {
  const resposta = await fetch(`${API_BASE}/categorias`);
  return await resposta.json();
}

export async function criarCategoria(categoria) {
  const resposta = await fetch(`${API_BASE}/categorias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoria)
  });
  return await resposta.json();
}

export async function atualizarCategoria(id, categoria) {
  const resposta = await fetch(`${API_BASE}/categorias/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoria)
  });
  return await resposta.json();
}

export async function excluirCategoria(id) {
  const resposta = await fetch(`${API_BASE}/categorias/${id}`, {
    method: 'DELETE'
  });
  return await resposta.json();
}
