// src/services/pluggySyncService.js
const crypto = require('crypto');
const pluggyService = require('./pluggyService');
const PluggyConfig = require('../models/pluggyConfig');
const ImportacaoPluggy = require('../models/importacaoPluggy');
const TransacaoPluggy = require('../models/transacaoPluggy');
const Subconta = require('../models/subconta');
const ledgerService = require('./ledgerService');
const { startTransactionSession } = require('../utils/transactionHelper');

/**
 * Gera chave de deduplicação para Pluggy: SHA256(usuarioId|subcontaId|pluggyTransactionId)
 */
function gerarDeduplicationKeyPluggy(usuarioId, subcontaId, pluggyTransactionId) {
  const composicao = `${usuarioId}|${subcontaId}|${pluggyTransactionId}`;
  return crypto.createHash('sha256').update(composicao).digest('hex');
}

/**
 * Inicia sincronização Pluggy: busca transações de todas as accounts mapeadas
 * e cria TransacaoPluggy com status 'aprovada' (pulando revisão).
 * 
 * @param {string} usuarioId - ID do usuário
 * @param {Object} opcoes - { dateFrom, dateTo } (opcional)
 * @returns {Object} ImportacaoPluggy criada
 */
async function iniciarSincronizacao(usuarioId, opcoes = {}) {
  const config = await PluggyConfig.findOne({ usuario: usuarioId, ativo: true });
  if (!config) {
    throw new Error('Pluggy não configurado. Salve clientId e clientSecret primeiro.');
  }

  const itemsAtivos = config.items.filter(i => i.ativo);
  if (itemsAtivos.length === 0) {
    throw new Error('Nenhum item mapeado. Adicione pelo menos um mapeamento itemId/accountId → subconta.');
  }

  const importacao = new ImportacaoPluggy({
    usuario: usuarioId,
    status: 'processando',
    itens: [],
    dataInicioSync: opcoes.dateFrom ? new Date(opcoes.dateFrom) : null,
    dataFimSync: opcoes.dateTo ? new Date(opcoes.dateTo) : null,
    totalTransacoes: 0,
    totalCreditos: 0,
    totalDebitos: 0,
    totalIgnoradas: 0,
    totalJaImportadas: 0
  });
  await importacao.save();

  let totalGeralTransacoes = 0;
  let totalGeralCreditos = 0;
  let totalGeralDebitos = 0;
  let totalGeralIgnoradas = 0;
  let totalGeralJaImportadas = 0;

  try {
    for (const item of itemsAtivos) {
      const itemSync = {
        itemId: item.itemId,
        accountId: item.accountId,
        accountName: item.accountName,
        accountNumber: item.accountNumber,
        accountType: item.accountType,
        connectorId: item.connectorId,
        connectorName: item.connectorName,
        subconta: item.subconta,
        saldoPluggy: null,
        dataSaldoPluggy: null,
        totalTransacoes: 0,
        totalCreditos: 0,
        totalDebitos: 0,
        totalIgnoradas: 0,
        totalJaImportadas: 0,
        erro: null
      };

      try {
        // Busca saldo da account (apenas para BANK)
        if (item.accountType === 'BANK') {
          try {
            const accounts = await pluggyService.listarAccounts(usuarioId, item.itemId, { apenasBank: true });
            const account = accounts.find(a => a.id === item.accountId);
            if (account) {
              itemSync.saldoPluggy = account.balance;
              itemSync.dataSaldoPluggy = new Date();
            }
          } catch (saldoErr) {
            console.warn(`[PluggySync] Erro ao buscar saldo da account ${item.accountId}:`, saldoErr.message);
          }
        }

        // Busca transações
        const txs = await pluggyService.buscarTodasTransacoes(usuarioId, item.accountId, {
          dateFrom: opcoes.dateFrom,
          dateTo: opcoes.dateTo
        });

        let totalCreditos = 0;
        let totalDebitos = 0;
        let totalIgnoradas = 0;
        let totalJaImportadas = 0;
        const txIdsVistos = new Set();

        for (const tx of txs) {
          if (!tx || !tx.id) {
            totalIgnoradas++;
            continue;
          }

          if (txIdsVistos.has(tx.id)) {
            totalIgnoradas++;
            continue;
          }
          txIdsVistos.add(tx.id);

          // Ignora transações PENDING (ainda não confirmadas pelo banco)
          if (tx.status === 'PENDING') {
            totalIgnoradas++;
            continue;
          }

          const amount = Math.abs(parseFloat(tx.amount) || 0);
          const tipo = tx.type === 'CREDIT' ? 'credito' : 'debito';
          const data = tx.date ? new Date(tx.date) : null;

          if (!data || isNaN(data.getTime())) {
            totalIgnoradas++;
            continue;
          }

          const dedupKey = gerarDeduplicationKeyPluggy(
            usuarioId.toString(),
            item.subconta.toString(),
            tx.id
          );

          const jaExiste = await TransacaoPluggy.findOne({
            usuario: usuarioId,
            deduplicationKey: dedupKey
          }).lean();

          const status = jaExiste ? 'ja_importada' : 'aprovada';
          if (jaExiste) {
            totalJaImportadas++;
            totalIgnoradas++;
          }

          const transacaoPluggy = new TransacaoPluggy({
            importacaoPluggy: importacao._id,
            itemId: item.itemId,
            accountId: item.accountId,
            subconta: item.subconta,
            usuario: usuarioId,
            pluggyTransactionId: tx.id,
            pluggyAccountId: tx.accountId || item.accountId,
            tipo,
            valor: amount,
            data,
            descricao: (tx.description || tx.descriptionRaw || 'Transação Pluggy').trim(),
            descricaoRaw: tx.descriptionRaw || null,
            providerCode: tx.providerCode || null,
            currencyCode: tx.currencyCode || 'BRL',
            pluggyStatus: tx.status || 'POSTED',
            status,
            categoriaPluggy: tx.category || null,
            dadosOriginais: tx,
            deduplicationKey: dedupKey
          });
          await transacaoPluggy.save();

          if (tipo === 'credito') totalCreditos += amount;
          else totalDebitos += amount;
        }

        itemSync.totalTransacoes = txs.length;
        itemSync.totalCreditos = totalCreditos;
        itemSync.totalDebitos = totalDebitos;
        itemSync.totalIgnoradas = totalIgnoradas;
        itemSync.totalJaImportadas = totalJaImportadas;

        totalGeralTransacoes += txs.length;
        totalGeralCreditos += totalCreditos;
        totalGeralDebitos += totalDebitos;
        totalGeralIgnoradas += totalIgnoradas;
        totalGeralJaImportadas += totalJaImportadas;

        // Atualiza status do item no config
        const idx = config.items.findIndex(i => i.itemId === item.itemId && i.accountId === item.accountId);
        if (idx !== -1) {
          config.items[idx].lastSyncAt = new Date();
          config.items[idx].lastSyncError = null;
        }

      } catch (itemErr) {
        itemSync.erro = itemErr.message;
        const idx = config.items.findIndex(i => i.itemId === item.itemId && i.accountId === item.accountId);
        if (idx !== -1) {
          config.items[idx].lastSyncError = itemErr.message;
        }
        console.error(`[PluggySync] Erro ao sincronizar item ${item.itemId}/${item.accountId}:`, itemErr);
      }

      importacao.itens.push(itemSync);
    }

    importacao.totalTransacoes = totalGeralTransacoes;
    importacao.totalCreditos = totalGeralCreditos;
    importacao.totalDebitos = totalGeralDebitos;
    importacao.totalIgnoradas = totalGeralIgnoradas;
    importacao.totalJaImportadas = totalGeralJaImportadas;
    importacao.status = 'revisao';
    await importacao.save();

    await config.save();

    return importacao;

  } catch (err) {
    await TransacaoPluggy.deleteMany({ importacaoPluggy: importacao._id, usuario: usuarioId }).catch(() => {});
    await ImportacaoPluggy.deleteOne({ _id: importacao._id, usuario: usuarioId }).catch(() => {});
    throw err;
  }
}

/**
 * Finaliza sincronização Pluggy: cria Transacao real, registra evento no Ledger,
 * atualiza saldo da Subconta para cada TransacaoPluggy aprovada.
 * 
 * @param {string} importacaoId - ID da ImportacaoPluggy
 * @param {string} usuarioId - ID do usuário
 * @returns {Object} ImportacaoPluggy finalizada
 */
async function finalizarSincronizacao(importacaoId, usuarioId) {
  const importacao = await ImportacaoPluggy.findOne({
    _id: importacaoId,
    usuario: usuarioId
  });

  if (!importacao) {
    throw new Error('Importação Pluggy não encontrada.');
  }
  if (importacao.status !== 'revisao') {
    throw new Error('Só é possível finalizar importações com status revisao.');
  }

  const transacoesPluggy = await TransacaoPluggy.find({
    importacaoPluggy: importacaoId,
    status: 'aprovada'
  }).sort({ data: 1 }).lean();

  let session;
  try {
    session = await startTransactionSession();
  } catch (txErr) {
    session = null;
  }

  const opts = session ? { session } : {};

  try {
    // Agrupa por subconta para atualizar saldos
    const saldosPorSubconta = {};

    for (const tp of transacoesPluggy) {
      const valorDelta = tp.tipo === 'credito' ? tp.valor : -tp.valor;

      await ledgerService.registrarEvento({
        usuarioId,
        subcontaId: tp.subconta,
        valor: valorDelta,
        tipoEvento: tp.tipo === 'credito' ? 'deposito' : 'saque',
        origemSistema: 'importacao_pluggy',
        referenciaTipo: 'transacao_pluggy',
        referenciaId: tp._id,
        descricao: tp.descricao || 'Pluggy ' + (tp.tipo === 'credito' ? 'credito' : 'debito') + ' - ' + tp.pluggyTransactionId,
        dataEvento: tp.data
      }, session);

      const subcontaStr = tp.subconta.toString();
      if (!saldosPorSubconta[subcontaStr]) {
        saldosPorSubconta[subcontaStr] = 0;
      }
      saldosPorSubconta[subcontaStr] += valorDelta;

      await TransacaoPluggy.updateOne(
        { _id: tp._id },
        { $set: { status: 'aprovada' } },
        opts
      );
    }

    // Atualiza saldos das subcontas e cria HistoricoSaldo
    for (const [subcontaId, delta] of Object.entries(saldosPorSubconta)) {
      const subconta = await Subconta.findById(subcontaId);
      if (subconta) {
        subconta.saldoAtual = (subconta.saldoAtual || 0) + delta;
        subconta.dataUltimaConfirmacao = new Date();
        await subconta.save(opts);
      }
    }

    // Atualiza status da importação
    importacao.status = 'finalizada';
    importacao.finalizedAt = new Date();
    await importacao.save(opts);

    // Atualiza ultimaSync no PluggyConfig
    await PluggyConfig.findOneAndUpdate(
      { usuario: usuarioId },
      {
        $set: {
          ultimaSync: {
            data: new Date(),
            totalImportacoes: 1,
            totalTransacoes: transacoesPluggy.length
          }
        }
      },
      opts
    );

    if (session) {
      await session.commitTransaction();
    }

    return importacao;

  } catch (err) {
    if (session) {
      await session.abortTransaction().catch(() => {});
    }
    throw err;
  } finally {
    if (session) session.endSession();
  }
}

/**
 * Lista importações Pluggy do usuário.
 */
async function listarImportacoes(usuarioId) {
  return ImportacaoPluggy.find({ usuario: usuarioId })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Obtém detalhes de uma importação Pluggy (com transações).
 */
async function obterDetalhesImportacao(importacaoId, usuarioId) {
  const importacao = await ImportacaoPluggy.findOne({
    _id: importacaoId,
    usuario: usuarioId
  }).lean();

  if (!importacao) {
    return null;
  }

  const transacoes = await TransacaoPluggy.find({
    importacaoPluggy: importacaoId,
    usuario: usuarioId
  })
    .populate('transacaoCriada', 'descricao valor data tipo')
    .sort({ data: -1 })
    .lean();

  return {
    ...importacao,
    transacoes
  };
}

module.exports = {
  gerarDeduplicationKeyPluggy,
  iniciarSincronizacao,
  finalizarSincronizacao,
  listarImportacoes,
  obterDetalhesImportacao
};
