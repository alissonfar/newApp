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

  console.log('[PluggyAPI] Buscando transacoes | accountId:', accountId, '| dateFrom:', dateFrom, '| dateTo:', dateTo);
  const inicio = Date.now();

  try {
    console.log('[PluggyAPI] Chamando fetchAllTransactions com accountId:', accountId, '| options:', JSON.stringify(options));
    const txs = await client.fetchAllTransactions(accountId, options);
    const count = Array.isArray(txs) ? txs.length : 0;
    const duration = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log('[PluggyAPI] Retornou ' + count + ' transacoes em ' + duration + 's');
    if (count > 0) {
      const first = txs[0];
      const last = txs[count - 1];
      console.log('[PluggyAPI] Primeira:', first.description, '| data:', first.date, '| valor:', first.amount, '| type:', first.type, '| status:', first.status);
      console.log('[PluggyAPI] Ultima:', last.description, '| data:', last.date, '| valor:', last.amount, '| type:', last.type, '| status:', last.status);
    } else {
      console.warn('[PluggyAPI] ** NENHUMA transacao retornada para o periodo solicitado **');
      console.log('[PluggyAPI] Debug — tipo do retorno:', typeof txs, '| é array?', Array.isArray(txs));
      if (txs && typeof txs === 'object' && !Array.isArray(txs)) {
        console.log('[PluggyAPI] Debug — chaves do objeto retornado:', Object.keys(txs));
      }
      // Tenta buscar sem filtro de data para ver se há dados
      try {
        console.log('[PluggyAPI] Tentando buscar SEM filtro de data para diagnosticar...');
        const txsSemFiltro = await client.fetchAllTransactions(accountId);
        console.log('[PluggyAPI] Sem filtro retornou', Array.isArray(txsSemFiltro) ? txsSemFiltro.length : '?', 'transacoes');
      } catch (semFiltroErr) {
        console.warn('[PluggyAPI] Busca sem filtro tambem falhou:', semFiltroErr.message);
      }
    }
    return Array.isArray(txs) ? txs : [];
  } catch (err) {
    const t = traduzirErro(err);
    console.error('[PluggyAPI] Erro ao buscar transacoes:', t.mensagem);
    console.error('[PluggyAPI] Erro completo:', err.message, err.stack ? err.stack.slice(0, 500) : '');
    throw new Error(t.mensagem);
  }
}

async function sincronizarItem(usuarioId, itemId, timeoutMs = 20000) {
  const config = await obterConfig(usuarioId);
  const client = criarClientAPartirDaConfig(config);

  console.log('[PluggySync] ===== INICIANDO SYNC =====');
  console.log('[PluggySync] itemId:', itemId, '| timeoutMs:', timeoutMs);
  const inicio = Date.now();

  // Log item status BEFORE update
  try {
    const itemPre = await client.fetchItem(itemId);
    console.log('[PluggySync] Status PRE-sync: status=', itemPre.status, '| executionStatus=', itemPre.executionStatus, '| error=', itemPre.executionStatusError);
  } catch (preErr) {
    console.warn('[PluggySync] Falha ao consultar item ANTES do sync:', preErr.message);
  }

  try {
    console.log('[PluggySync] Chamando client.updateItem...');
    const updateResult = await client.updateItem(itemId);
    console.log('[PluggySync] updateItem retornou:', JSON.stringify(updateResult).slice(0, 300));
  } catch (err) {
    const t = traduzirErro(err);
    console.warn('[PluggySync] Falha ao iniciar sync:', t.mensagem);
    throw new Error('Falha ao iniciar sincronizacao Pluggy: ' + t.mensagem);
  }

  let pollCount = 0;
  while (Date.now() - inicio < timeoutMs) {
    await new Promise(r => setTimeout(r, 1500));
    pollCount++;
    try {
      const item = await client.fetchItem(itemId);
      console.log('[PluggySync] Poll #' + pollCount + ': status=', item.status, '| executionStatus=', item.executionStatus, '| error=', item.executionStatusError);
      if (item.executionStatus === 'COMPLETED' || item.status === 'UPDATED') {
        const duration = ((Date.now() - inicio) / 1000).toFixed(1);
        console.log('[PluggySync] Sincronizacao completada em ' + duration + 's (' + pollCount + ' polls)');
        console.log('[PluggySync] Status final: status=', item.status, '| executionStatus=', item.executionStatus);
        return true;
      }
      if (item.executionStatus === 'ERROR') {
        console.error('[PluggySync] Erro na sincronizacao:', item.executionStatusError);
        throw new Error('Erro na sincronizacao Pluggy: ' + (item.executionStatusError || 'desconhecido'));
      }
    } catch (err) {
      if (err.message && err.message.startsWith('Erro na sincronizacao')) throw err;
      console.warn('[PluggySync] Poll #' + pollCount + ' erro ignorado:', err.message);
    }
  }
  const duration = ((Date.now() - inicio) / 1000).toFixed(1);
  console.warn('[PluggySync] Timeout apos ' + duration + 's (' + pollCount + ' polls) — usando cache');
  return false;
}

async function criarConnectToken(usuarioId, itemId) {
  const config = await obterConfig(usuarioId);
  const client = criarClientAPartirDaConfig(config);

  try {
    const result = await client.createConnectToken(itemId);
    return { accessToken: result.accessToken };
  } catch (err) {
    const t = traduzirErro(err);
    throw new Error(t.mensagem);
  }
}

async function buscarAccountsDoItem(usuarioId, itemId) {
  const config = await obterConfig(usuarioId);
  const client = criarClientAPartirDaConfig(config);

  try {
    const resp = await client.fetchAccounts(itemId);
    return Array.isArray(resp?.results) ? resp.results : [];
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
  buscarTodasTransacoes,
  criarConnectToken,
  buscarAccountsDoItem,
  sincronizarItem
};
