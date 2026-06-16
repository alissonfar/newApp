// src/services/pluggySyncService.js
const crypto = require('crypto');
const pluggyService = require('./pluggyService');
const cotacaoService = require('./cotacaoService');
const PluggyConfig = require('../models/pluggyConfig');
const ImportacaoPluggy = require('../models/importacaoPluggy');
const TransacaoPluggy = require('../models/transacaoPluggy');
const Subconta = require('../models/subconta');
const LedgerPatrimonial = require('../models/ledgerPatrimonial');
const ledgerService = require('./ledgerService');
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
  // ─── Lock de concorrência: impede syncs simultâneos para o mesmo usuário ───
  const importPendente = await ImportacaoPluggy.findOne({
    usuario: usuarioId,
    status: { $in: ['processando', 'revisao'] }
  });
  if (importPendente) {
    const idadeMin = (Date.now() - new Date(importPendente.createdAt).getTime()) / 60000;
    if (idadeMin < 15) {
      throw new Error(
        'Já existe uma sincronização em andamento para este usuário. ' +
        'Aguarde a conclusão ou tente novamente em alguns minutos.'
      );
    }
    // Importação órfã (> 15min) — limpa e começa do zero
    await TransacaoPluggy.deleteMany({ importacaoPluggy: importPendente._id }).catch(() => {});
    await ImportacaoPluggy.deleteOne({ _id: importPendente._id }).catch(() => {});
    console.log('[PluggySync] Importação órfã ' + importPendente._id +
      ' (status: ' + importPendente.status + ', ' + idadeMin.toFixed(0) + 'min) limpa.');
  }

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
        saldoPluggyInicial: null,
        dataSaldoPluggy: null,
        totalTransacoes: 0,
        totalCreditos: 0,
        totalDebitos: 0,
        totalIgnoradas: 0,
        totalJaImportadas: 0,
        erro: null
      };

      try {
        // Busca saldo da account (BANK e CREDIT)
        try {
          const accounts = await pluggyService.listarAccounts(usuarioId, item.itemId, { apenasBank: false });
          const account = accounts.find(a => a.id === item.accountId);
          if (account) {
            itemSync.saldoPluggy = account.balance;
            itemSync.dataSaldoPluggy = new Date();
          }
        } catch (saldoErr) {
          console.warn(`[PluggySync] Erro ao buscar saldo da account ${item.accountId}:`, saldoErr.message);
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
        let totalPendentes = 0;
        const moedas = {};
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

          const amount = Math.abs(parseFloat(tx.amount) || 0);

          let valorConvertido = amount;
          let moedaOriginal = null;
          let cotacaoUsada = null;
          if (tx.currencyCode && tx.currencyCode !== 'BRL') {
            try {
              const conv = await cotacaoService.converterSeMoedaEstrangeira(tx);
              if (conv.cotacaoUsada) {
                valorConvertido = conv.valorConvertido;
                moedaOriginal = conv.moedaOriginal;
                cotacaoUsada = conv.cotacaoUsada;
              }
            } catch (convErr) {
              console.warn('[PluggySync] Erro na conversão de moeda:', convErr.message);
            }
          }

          // Track PENDING and currency distribution for this item
          if (tx.status === 'PENDING') totalPendentes++;
          const currCode = tx.currencyCode || 'BRL';
          moedas[currCode] = (moedas[currCode] || 0) + 1;

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

          if (jaExiste) {
            totalJaImportadas++;
            totalIgnoradas++;
            continue;
          }

          const status = 'aprovada';

          const transacaoPluggy = new TransacaoPluggy({
            importacaoPluggy: importacao._id,
            itemId: item.itemId,
            accountId: item.accountId,
            subconta: item.subconta,
            usuario: usuarioId,
            pluggyTransactionId: tx.id,
            pluggyAccountId: tx.accountId || item.accountId,
            tipo,
            valor: valorConvertido,
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

          if (tipo === 'credito') totalCreditos += valorConvertido;
          else totalDebitos += valorConvertido;
        }

        // Calculate initial balance (saldo antes das transacoes) for snapshot
        if (itemSync.saldoPluggy != null) {
          const sumDeltas = totalCreditos - totalDebitos;
          itemSync.saldoPluggyInicial = itemSync.saldoPluggy - sumDeltas;
        }

        itemSync.totalTransacoes = txs.length;
        itemSync.totalCreditos = totalCreditos;
        itemSync.totalDebitos = totalDebitos;
        itemSync.totalIgnoradas = totalIgnoradas;
        itemSync.totalJaImportadas = totalJaImportadas;
        itemSync.totalPendentes = totalPendentes;
        itemSync.moedas = moedas;

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

  // Check which subcontas already have ledger events from a previous sync
  const subcontasUnicas = {};
  for (const tp of transacoesPluggy) {
    subcontasUnicas[tp.subconta.toString()] = true;
  }
  const subcontasComLedger = {};
  for (const subId of Object.keys(subcontasUnicas)) {
    const existe = await LedgerPatrimonial.findOne({
      subconta: subId,
      usuario: usuarioId,
      origemSistema: 'importacao_pluggy'
    }).lean();
    subcontasComLedger[subId] = !!existe;
  }

  // Build accountType lookup from importacao.itens
  const accountTypeMap = {};
  for (const it of importacao.itens) {
    const key = it.itemId + '|' + it.accountId;
    accountTypeMap[key] = it.accountType;
  }

  const saldosPorSubconta = {};

  for (const tp of transacoesPluggy) {
    const valorDelta = tp.tipo === 'credito' ? tp.valor : -tp.valor;
    const subcontaStr = tp.subconta.toString();

    // Determine tipoEvento based on account type
    const tpKey = tp.itemId + '|' + tp.accountId;
    const accountType = accountTypeMap[tpKey] || 'BANK';
    let tipoEvento;
    if (accountType === 'CREDIT') {
      tipoEvento = tp.tipo === 'credito' ? 'pagamento_fatura' : 'compra_credito';
    } else {
      tipoEvento = tp.tipo === 'credito' ? 'deposito' : 'saque';
    }

    // Register individual event for every transaction (ledgerService has dedup)
    await ledgerService.registrarEvento({
      usuarioId,
      subcontaId: tp.subconta,
      valor: valorDelta,
      tipoEvento: tipoEvento,
      origemSistema: 'importacao_pluggy',
      referenciaTipo: 'transacao_pluggy',
      referenciaId: tp._id,
      descricao: tp.descricao || 'Pluggy ' + (tp.tipo === 'credito' ? 'credito' : 'debito') + ' - ' + tp.pluggyTransactionId,
      dataEvento: tp.data
    });

    if (!saldosPorSubconta[subcontaStr]) {
      saldosPorSubconta[subcontaStr] = 0;
    }
    saldosPorSubconta[subcontaStr] += valorDelta;

    await TransacaoPluggy.updateOne(
      { _id: tp._id },
      { $set: { status: 'aprovada' } }
    );
  }

  // Update subcontas first, then mark import as finalized.
  // Ledger dedup protects against duplicate events on retry.
  for (const [subcontaId, delta] of Object.entries(saldosPorSubconta)) {
    const subconta = await Subconta.findById(subcontaId);
    if (!subconta) continue;

    if (!subcontasComLedger[subcontaId]) {
      // ─── Primeira sync para esta subconta ───
      const item = importacao.itens.find(function(i) {
        return i.subconta && i.subconta.toString() === subcontaId;
      });
      if (item && item.saldoPluggyInicial != null) {
        const txsDaSub = transacoesPluggy.filter(function(t) {
          return t.subconta.toString() === subcontaId;
        });
        const primeiraData = txsDaSub.length > 0 && txsDaSub[0].data
          ? new Date(txsDaSub[0].data.getTime() - 1)
          : new Date();
        await ledgerService.registrarEvento({
          usuarioId,
          subcontaId: subcontaId,
          valor: item.saldoPluggyInicial,
          tipoEvento: 'snapshot_inicial',
          origemSistema: 'importacao_pluggy',
          descricao: 'Saldo inicial calculado (saldo banco - transacoes)',
          dataEvento: primeiraData
        });
      }
      subconta.saldoAtual = item && item.saldoPluggy != null
        ? item.saldoPluggy
        : (subconta.saldoAtual || 0) + delta;
    } else {
      // ─── Syncs subsequentes ───
      subconta.saldoAtual = (subconta.saldoAtual || 0) + delta;
    }

    subconta.dataUltimaConfirmacao = new Date();
    await subconta.save();
  }

  // FASE DE RECONCILIAÇÃO: alinhar saldoAtual ao account.balance da Pluggy
  // Captura rendimento CDI, juros, tarifas e qualquer mudança não-transacional.
  // Roda mesmo sem transações novas para manter saldoAtual próximo do saldo real.
  for (const item of importacao.itens) {
    if (!item.saldoPluggy || !item.subconta) continue;

    const jaTemSnapshot = await LedgerPatrimonial.findOne({
      subconta: item.subconta,
      usuario: usuarioId,
      origemSistema: 'importacao_pluggy',
      tipoEvento: 'snapshot_inicial',
      referenciaTipo: { $ne: 'reconciliacao_pluggy' }
    });
    if (jaTemSnapshot) {
      const sub = await Subconta.findById(item.subconta);
      if (sub) {
        sub.dataUltimaConfirmacao = new Date();
        await sub.save();
      }
      continue;
    }

    const subconta = await Subconta.findById(item.subconta);
    if (!subconta) continue;

    const diff = Number((Number(item.saldoPluggy) - Number(subconta.saldoAtual || 0)).toFixed(2));
    if (Math.abs(diff) < 0.01) {
      subconta.dataUltimaConfirmacao = new Date();
      await subconta.save();
      continue;
    }

    await ledgerService.registrarEvento({
      usuarioId,
      subcontaId: item.subconta,
      valor: diff,
      tipoEvento: 'correcao',
      origemSistema: 'importacao_pluggy',
      referenciaTipo: 'reconciliacao_pluggy',
      referenciaId: importacao._id,
      descricao: 'Reconciliação Pluggy: diff=R$ ' + diff.toFixed(2),
      dataEvento: new Date(),
      metadata: {
        origem: 'reconciliacao_pluggy',
        saldoAnterior: subconta.saldoAtual,
        saldoPluggy: item.saldoPluggy,
        diferenca: diff
      }
    });

    subconta.saldoAtual = item.saldoPluggy;
    subconta.dataUltimaConfirmacao = new Date();
    await subconta.save();
    console.log('[PluggySync] Reconciliacao: subconta=' + item.subconta + ' diff=R$ ' + diff.toFixed(2));
  }

  importacao.status = 'finalizada';
  importacao.finalizedAt = new Date();
  await importacao.save();

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
    }
  );

  return importacao;
}

/**
 * Lista importações Pluggy do usuário (paginada).
 */
async function listarImportacoes(usuarioId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    ImportacaoPluggy.find({ usuario: usuarioId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ImportacaoPluggy.countDocuments({ usuario: usuarioId })
  ]);
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
