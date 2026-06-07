// src/services/pluggyService.js
const { PluggyClient } = require('pluggy-sdk');
const encryptionService = require('./encryptionService');
const PluggyConfig = require('../models/pluggyConfig');

function traduzirStatusItem(status) {
  switch (status) {
    case 'UPDATED':
      return { codigo: status, label: 'Atualizado', saudavel: true };
    case 'UPDATING':
      return { codigo: status, label: 'Sincronizando...', saudavel: true };
    case 'WAITING_USER_INPUT':
    case 'WAITING_USER_ACTION':
      return { codigo: status, label: 'Aguardando autorizacao no banco', saudavel: false };
    case 'LOGIN_ERROR':
      return { codigo: status, label: 'Erro de login — reautorizar', saudavel: false };
    case 'OUTDATED':
      return { codigo: status, label: 'Desatualizado — reautorizar', saudavel: false };
    case 'MERGING':
      return { codigo: status, label: 'Mesclando dados...', saudavel: true };
    default:
      return { codigo: status || 'DESCONHECIDO', label: 'Desconhecido', saudavel: false };
  }
}

function criarClientAPartirDaConfig(pluggyConfig) {
  if (!pluggyConfig || !pluggyConfig.clientId || !pluggyConfig.clientSecretEncrypted) {
    throw new Error('PluggyConfig invalida: clientId/clientSecret ausentes.');
  }
  const clientSecret = encryptionService.decrypt(pluggyConfig.clientSecretEncrypted);
  return new PluggyClient({
    clientId: pluggyConfig.clientId,
    clientSecret
  });
}

async function obterConfig(usuarioId) {
  const config = await PluggyConfig.findOne({ usuario: usuarioId, ativo: true });
  if (!config) {
    const e = new Error('Pluggy nao configurado. Salve clientId e clientSecret primeiro.');
    e.code = 'PLUGGY_NOT_CONFIGURED';
    throw e;
  }
  return config;
}

async function testarConexao(clientId, clientSecret, ambiente = 'sandbox') {
  const client = new PluggyClient({ clientId, clientSecret });
  try {
    await client.createConnectToken();
    return {
      ok: true,
      mensagem: `Conexao com Pluggy (${ambiente}) estabelecida com sucesso.`
    };
  } catch (err) {
    const traduzido = traduzirErro(err);
    return { ok: false, mensagem: traduzido.mensagem };
  }
}

function traduzirErro(err) {
  const status = err?.response?.statusCode || err?.statusCode;
  const mensagemOriginal = err?.response?.body?.message || err?.message || 'Erro desconhecido';

  if (status === 401) {
    return { mensagem: 'Credenciais Pluggy invalidas ou expiradas.', code: 'PLUGGY_AUTH_FAILED' };
  }
  if (status === 403) {
    return { mensagem: 'Acesso negado pela Pluggy. Verifique permissoes do app.', code: 'PLUGGY_FORBIDDEN' };
  }
  if (status === 404) {
    return { mensagem: 'Recurso nao encontrado na Pluggy.', code: 'PLUGGY_NOT_FOUND' };
  }
  if (status === 429) {
    return { mensagem: 'Limite de requisicoes da Pluggy atingido. Tente em instantes.', code: 'PLUGGY_RATE_LIMIT' };
  }
  if (status >= 500) {
    return { mensagem: 'Pluggy instavel. Tente novamente em alguns minutos.', code: 'PLUGGY_SERVER_ERROR' };
  }
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT') {
    return { mensagem: 'Falha de rede ao contactar a Pluggy.', code: 'PLUGGY_NETWORK' };
  }
  return { mensagem: `Erro Pluggy: ${String(mensagemOriginal).slice(0, 200)}`, code: 'PLUGGY_ERROR' };
}

async function listarItemsLocal(usuarioId) {
  const config = await obterConfig(usuarioId);
  return config.items.map(item => ({
    itemId: item.itemId,
    accountId: item.accountId,
    accountType: item.accountType,
    accountSubtype: item.accountSubtype,
    accountName: item.accountName,
    accountNumber: item.accountNumber,
    connectorId: item.connectorId,
    connectorName: item.connectorName,
    subconta: item.subconta,
    status: item.status,
    statusDetalhado: traduzirStatusItem(item.status),
    lastSyncAt: item.lastSyncAt,
    lastSyncError: item.lastSyncError,
    ativo: item.ativo
  }));
}

async function atualizarStatusItem(usuarioId, itemId) {
  const config = await obterConfig(usuarioId);
  const client = criarClientAPartirDaConfig(config);

  let itemPluggy;
  try {
    itemPluggy = await client.fetchItem(itemId);
  } catch (err) {
    const t = traduzirErro(err);
    throw new Error(t.mensagem);
  }

  const idx = config.items.findIndex(i => i.itemId === itemId);
  if (idx === -1) {
    return null;
  }
  config.items[idx].status = itemPluggy.status || 'DESCONHECIDO';
  await config.save();
  return {
    itemId,
    status: config.items[idx].status,
    statusDetalhado: traduzirStatusItem(config.items[idx].status),
    executionStatus: itemPluggy.executionStatus
  };
}

async function listarAccounts(usuarioId, itemId, { apenasBank = true } = {}) {
  const config = await obterConfig(usuarioId);
  const client = criarClientAPartirDaConfig(config);

  try {
    const resp = await client.fetchAccounts(itemId);
    let contas = Array.isArray(resp?.results) ? resp.results : [];
    if (apenasBank) {
      contas = contas.filter(a => a.type === 'BANK');
    }
    return contas;
  } catch (err) {
    const t = traduzirErro(err);
    throw new Error(t.mensagem);
  }
}

async function buscarTodasTransacoes(usuarioId, accountId, { dateFrom, dateTo } = {}) {
  const config = await obterConfig(usuarioId);
  const client = criarClientAPartirDaConfig(config);

  const options = {};
  if (dateFrom) options.dateFrom = dateFrom;
  if (dateTo) options.dateTo = dateTo;

  try {
    const txs = await client.fetchAllTransactions(accountId, options);
    return Array.isArray(txs) ? txs : [];
  } catch (err) {
    const t = traduzirErro(err);
    throw new Error(t.mensagem);
  }
}

module.exports = {
  criarClientAPartirDaConfig,
  obterConfig,
  testarConexao,
  traduzirErro,
  traduzirStatusItem,
  listarItemsLocal,
  atualizarStatusItem,
  listarAccounts,
  buscarTodasTransacoes
};
