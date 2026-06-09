// src/controllers/pluggyController.js
const PluggyConfig = require('../models/pluggyConfig');
const ImportacaoPluggy = require('../models/importacaoPluggy');
const TransacaoPluggy = require('../models/transacaoPluggy');
const pluggyService = require('../services/pluggyService');
const pluggySyncService = require('../services/pluggySyncService');
const encryptionService = require('../services/encryptionService');

exports.obterConfig = async (req, res) => {
  try {
    const config = await PluggyConfig.findOne({ usuario: req.userId }).lean();
    if (!config) {
      return res.json({
        configurado: false,
        clientId: '',
        ambiente: 'sandbox',
        ativo: false,
        items: [],
        ultimoTesteConexao: null,
        ultimaSync: null
      });
    }
    delete config.clientSecretEncrypted;
    return res.json({ configurado: true, ...config });
  } catch (err) {
    console.error('[Pluggy] Erro ao obter config:', err);
    return res.status(500).json({ erro: 'Erro ao obter configuracao Pluggy.' });
  }
};

exports.salvarConfig = async (req, res) => {
  try {
    const { clientId, clientSecret, ambiente } = req.body || {};
    if (!clientId || !clientSecret) {
      return res.status(400).json({ erro: 'clientId e clientSecret sao obrigatorios.' });
    }

    const config = await PluggyConfig.findOneAndUpdate(
      { usuario: req.userId },
      {
        $set: {
          clientId: String(clientId).trim(),
          clientSecretEncrypted: encryptionService.encrypt(clientSecret),
          ambiente: ambiente === 'production' ? 'production' : 'sandbox',
          ativo: true
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    delete config.clientSecretEncrypted;
    return res.json({
      mensagem: 'Configuracao Pluggy salva com sucesso.',
      configuracao: config
    });
  } catch (err) {
    console.error('[Pluggy] Erro ao salvar config:', err);
    return res.status(500).json({ erro: 'Erro ao salvar configuracao Pluggy.' });
  }
};

exports.testarConexao = async (req, res) => {
  try {
    let { clientId, clientSecret, ambiente } = req.body || {};

    if ((!clientId || !clientSecret) && req.body?.usarConfigSalva !== false) {
      const config = await PluggyConfig.findOne({ usuario: req.userId });
      if (config) {
        clientId = clientId || config.clientId;
        clientSecret = clientSecret || encryptionService.decrypt(config.clientSecretEncrypted);
        ambiente = config.ambiente;
      }
    }

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        ok: false,
        mensagem: 'Informe clientId e clientSecret ou salve a configuracao primeiro.'
      });
    }

    const resultado = await pluggyService.testarConexao(clientId, clientSecret, ambiente);

    if (resultado.ok) {
      await PluggyConfig.findOneAndUpdate(
        { usuario: req.userId },
        { $set: { ultimoTesteConexao: { data: new Date(), sucesso: true, mensagem: resultado.mensagem } } }
      ).catch(() => {});
    } else {
      await PluggyConfig.findOneAndUpdate(
        { usuario: req.userId },
        { $set: { ultimoTesteConexao: { data: new Date(), sucesso: false, mensagem: resultado.mensagem } } }
      ).catch(() => {});
    }

    return res.json(resultado);
  } catch (err) {
    console.error('[Pluggy] Erro ao testar conexao:', err);
    return res.status(500).json({ ok: false, mensagem: 'Erro ao testar conexao Pluggy.' });
  }
};

exports.listarItems = async (req, res) => {
  try {
    const items = await pluggyService.listarItemsLocal(req.userId);
    return res.json({ items });
  } catch (err) {
    if (err.code === 'PLUGGY_NOT_CONFIGURED') {
      return res.json({ items: [], mensagem: err.message });
    }
    console.error('[Pluggy] Erro ao listar items:', err);
    return res.status(500).json({ erro: 'Erro ao listar items Pluggy.' });
  }
};

exports.listarAccountsDoItem = async (req, res) => {
  try {
    const incluirCREDIT = String(req.query.incluirCREDIT || '').toLowerCase() === 'true';
    const accounts = await pluggyService.listarAccounts(req.userId, req.params.itemId, {
      apenasBank: !incluirCREDIT
    });
    return res.json({
      accounts: accounts.map(a => ({
        id: a.id,
        type: a.type,
        subtype: a.subtype,
        number: a.number,
        name: a.name,
        marketingName: a.marketingName,
        balance: a.balance,
        currencyCode: a.currencyCode,
        itemId: a.itemId
      }))
    });
  } catch (err) {
    console.error('[Pluggy] Erro ao listar accounts:', err);
    const t = pluggyService.traduzirErro(err);
    return res.status(500).json({ erro: t.mensagem });
  }
};

exports.adicionarItem = async (req, res) => {
  try {
    const {
      itemId, connectorId, connectorName,
      accountId, accountType, accountSubtype, accountName, accountNumber,
      subcontaId
    } = req.body || {};

    if (!itemId || !accountId || !subcontaId) {
      return res.status(400).json({ erro: 'itemId, accountId e subcontaId sao obrigatorios.' });
    }

    const config = await PluggyConfig.findOne({ usuario: req.userId });
    if (!config) {
      return res.status(400).json({ erro: 'Pluggy nao configurado. Salve as credenciais primeiro.' });
    }

    const outros = config.items.filter(
      i => !(String(i.itemId) === String(itemId) && String(i.accountId) === String(accountId))
    );

    outros.push({
      itemId: String(itemId),
      accountId: String(accountId),
      accountType: accountType === 'CREDIT' ? 'CREDIT' : 'BANK',
      accountSubtype: accountSubtype || null,
      accountName: accountName || '',
      accountNumber: accountNumber || '',
      connectorId: connectorId || null,
      connectorName: connectorName || '',
      subconta: subcontaId,
      status: 'DESCONHECIDO',
      ativo: true
    });

    config.items = outros;
    await config.save();

    const adicionado = config.items.find(
      i => String(i.itemId) === String(itemId) && String(i.accountId) === String(accountId)
    );
    return res.status(201).json({
      mensagem: 'Mapeamento salvo com sucesso.',
      item: {
        itemId: adicionado.itemId,
        accountId: adicionado.accountId,
        accountType: adicionado.accountType,
        accountSubtype: adicionado.accountSubtype,
        accountName: adicionado.accountName,
        accountNumber: adicionado.accountNumber,
        connectorId: adicionado.connectorId,
        connectorName: adicionado.connectorName,
        subconta: adicionado.subconta,
        status: adicionado.status,
        statusDetalhado: pluggyService.traduzirStatusItem(adicionado.status)
      }
    });
  } catch (err) {
    console.error('[Pluggy] Erro ao adicionar item:', err);
    return res.status(500).json({ erro: 'Erro ao adicionar mapeamento Pluggy.' });
  }
};

exports.removerItem = async (req, res) => {
  try {
    const { itemId, accountId } = req.params;
    const config = await PluggyConfig.findOne({ usuario: req.userId });
    if (!config) {
      return res.status(404).json({ erro: 'Configuracao Pluggy nao encontrada.' });
    }
    const antes = config.items.length;
    config.items = config.items.filter(
      i => !(String(i.itemId) === String(itemId) && String(i.accountId) === String(accountId))
    );
    if (config.items.length === antes) {
      return res.status(404).json({ erro: 'Mapeamento nao encontrado.' });
    }
    await config.save();
    return res.json({ mensagem: 'Mapeamento removido com sucesso.' });
  } catch (err) {
    console.error('[Pluggy] Erro ao remover item:', err);
    return res.status(500).json({ erro: 'Erro ao remover mapeamento Pluggy.' });
  }
};

exports.adicionarItemsBatch = async (req, res) => {
  try {
    const { itemId, connectorName, mapeamentos } = req.body || {};

    if (!itemId || !mapeamentos || !Array.isArray(mapeamentos) || mapeamentos.length === 0) {
      return res.status(400).json({ erro: 'itemId e mapeamentos (array) sao obrigatorios.' });
    }

    const config = await PluggyConfig.findOne({ usuario: req.userId });
    if (!config) {
      return res.status(400).json({ erro: 'Pluggy nao configurado. Salve as credenciais primeiro.' });
    }

    // Remove only mappings for accounts in this batch, preserve existing ones not in the batch
    const outros = config.items.filter(i =>
      String(i.itemId) !== String(itemId) ||
      !mapeamentos.some(m => String(m.accountId) === String(i.accountId))
    );

    const novos = mapeamentos.map(m => ({
      itemId: String(itemId),
      accountId: String(m.accountId),
      accountType: m.accountType === 'CREDIT' ? 'CREDIT' : 'BANK',
      accountSubtype: m.accountSubtype || null,
      accountName: m.accountName || '',
      accountNumber: m.accountNumber || '',
      connectorId: m.connectorId || null,
      connectorName: connectorName || '',
      subconta: m.subcontaId,
      status: 'DESCONHECIDO',
      ativo: true
    }));

    config.items = [...outros, ...novos];
    await config.save();

    return res.status(201).json({
      mensagem: novos.length + ' mapeamento(s) salvo(s) com sucesso.',
      items: novos
    });
  } catch (err) {
    console.error('[Pluggy] Erro ao adicionar items batch:', err);
    return res.status(500).json({ erro: 'Erro ao salvar mapeamentos em lote.' });
  }
};

exports.atualizarStatusItem = async (req, res) => {
  try {
    const resultado = await pluggyService.atualizarStatusItem(req.userId, req.params.itemId);
    if (!resultado) {
      return res.status(404).json({ erro: 'Item nao encontrado na configuracao local.' });
    }
    return res.json(resultado);
  } catch (err) {
    console.error('[Pluggy] Erro ao atualizar status do item:', err);
    return res.status(500).json({ erro: err.message || 'Erro ao atualizar status.' });
  }
};

exports.iniciarSync = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body || {};
    const importacao = await pluggySyncService.iniciarSincronizacao(req.userId, { dateFrom, dateTo });
    const finalizada = await pluggySyncService.finalizarSincronizacao(importacao._id, req.userId);
    return res.json({
      mensagem: 'Sincronizacao concluida com sucesso.',
      importacao: finalizada
    });
  } catch (err) {
    console.error('[Pluggy] Erro ao sincronizar:', err);
    return res.status(500).json({ erro: err.message || 'Erro ao sincronizar Pluggy.' });
  }
};

exports.listarImportacoes = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const importacoes = await pluggySyncService.listarImportacoes(req.userId, page, limit);
    return res.json(importacoes);
  } catch (err) {
    console.error('[Pluggy] Erro ao listar importacoes:', err);
    return res.status(500).json({ erro: 'Erro ao listar importacoes Pluggy.' });
  }
};

exports.obterDetalhes = async (req, res) => {
  try {
    const detalhes = await pluggySyncService.obterDetalhesImportacao(req.params.id, req.userId);
    if (!detalhes) {
      return res.status(404).json({ erro: 'Importacao Pluggy nao encontrada.' });
    }
    return res.json(detalhes);
  } catch (err) {
    console.error('[Pluggy] Erro ao obter detalhes:', err);
    return res.status(500).json({ erro: 'Erro ao obter detalhes da importacao Pluggy.' });
  }
};

exports.criarConnectToken = async (req, res) => {
  try {
    const { itemId } = req.body || {};
    const result = await pluggyService.criarConnectToken(req.userId, itemId || undefined);
    return res.json(result);
  } catch (err) {
    console.error('[Pluggy] Erro ao criar connect token:', err);
    const t = pluggyService.traduzirErro(err);
    return res.status(500).json({ erro: t.mensagem });
  }
};

exports.obterAccountsDoItem = async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ erro: 'itemId e obrigatorio.' });
    }
    const accounts = await pluggyService.buscarAccountsDoItem(req.userId, itemId);
    return res.json({
      accounts: accounts.map(a => ({
        id: a.id,
        type: a.type,
        subtype: a.subtype,
        number: a.number,
        name: a.name,
        marketingName: a.marketingName,
        balance: a.balance,
        currencyCode: a.currencyCode
      }))
    });
  } catch (err) {
    console.error('[Pluggy] Erro ao buscar accounts do item:', err);
    const t = pluggyService.traduzirErro(err);
    return res.status(500).json({ erro: t.mensagem });
  }
};

exports.obterStatusSync = async (req, res) => {
  try {
    const config = await PluggyConfig.findOne({ usuario: req.userId }).lean();
    if (!config) {
      return res.json({ configurado: false, ultimaSync: null, proximoSync: null });
    }
    delete config.clientSecretEncrypted;
    const proximoSync = config.ultimaSync && config.ultimaSync.data
      ? new Date(new Date(config.ultimaSync.data).getTime() + 12 * 60 * 60 * 1000)
      : null;
    return res.json({
      configurado: true,
      ultimaSync: config.ultimaSync,
      proximoSync,
      items: config.items.map(i => ({
        itemId: i.itemId,
        accountId: i.accountId,
        accountName: i.accountName,
        connectorName: i.connectorName,
        status: i.status,
        lastSyncAt: i.lastSyncAt,
        lastSyncError: i.lastSyncError
      }))
    });
  } catch (err) {
    console.error('[Pluggy] Erro ao obter status sync:', err);
    return res.status(500).json({ erro: 'Erro ao obter status de sincronizacao.' });
  }
};

exports.salvarConexao = async (req, res) => {
  try {
    const { itemId, connectorId, connectorName } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ erro: 'itemId e obrigatorio.' });
    }

    const config = await PluggyConfig.findOne({ usuario: req.userId });
    if (!config) {
      return res.status(400).json({ erro: 'Pluggy nao configurado.' });
    }

    const jaExiste = config.conexoes && config.conexoes.some(c => String(c.itemId) === String(itemId));
    if (!jaExiste) {
      config.conexoes.push({
        itemId: String(itemId),
        connectorId: connectorId || null,
        connectorName: connectorName || '',
        connectedAt: new Date()
      });
      await config.save();
    }

    return res.json({ mensagem: 'Conexao salva com sucesso.' });
  } catch (err) {
    console.error('[Pluggy] Erro ao salvar conexao:', err);
    return res.status(500).json({ erro: 'Erro ao salvar conexao.' });
  }
};

exports.listarConexoes = async (req, res) => {
  try {
    const config = await PluggyConfig.findOne({ usuario: req.userId });
    if (!config) {
      return res.json({ conexoes: [] });
    }
    return res.json({ conexoes: config.conexoes || [] });
  } catch (err) {
    console.error('[Pluggy] Erro ao listar conexoes:', err);
    return res.status(500).json({ erro: 'Erro ao listar conexoes.' });
  }
};

exports.removerConexao = async (req, res) => {
  try {
    const { itemId } = req.params;
    const config = await PluggyConfig.findOne({ usuario: req.userId });
    if (!config) {
      return res.status(404).json({ erro: 'Configuracao Pluggy nao encontrada.' });
    }
    const antes = config.conexoes ? config.conexoes.length : 0;
    config.conexoes = (config.conexoes || []).filter(c => String(c.itemId) !== String(itemId));
    if (config.conexoes.length === antes) {
      return res.status(404).json({ erro: 'Conexao nao encontrada.' });
    }
    await config.save();
    return res.json({ mensagem: 'Conexao removida com sucesso.' });
  } catch (err) {
    console.error('[Pluggy] Erro ao remover conexao:', err);
    return res.status(500).json({ erro: 'Erro ao remover conexao.' });
  }
};
