// src/services/pluggyCronService.js
const PluggyConfig = require('../models/pluggyConfig');
const pluggyService = require('./pluggyService');
const pluggySyncService = require('./pluggySyncService');

const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 horas
let cronTimer = null;
let isRunning = false;

/**
 * Executa o sync automatico para todos os usuarios com Pluggy configurado.
 * Para cada usuario, busca transacoes novas de todos os items mapeados.
 * Transacoes duplicadas sao ignoradas (dedup por pluggyTransactionId).
 */
async function executarSyncAutomatico() {
  if (isRunning) {
    console.log('[PluggyCron] Sync ja em execucao, pulando.');
    return;
  }

  isRunning = true;
  console.log('[PluggyCron] Iniciando sync automatico...');

  try {
    const configs = await PluggyConfig.find({ ativo: true, items: { $exists: true, $not: { $size: 0 } } });

    if (configs.length === 0) {
      console.log('[PluggyCron] Nenhum usuario com Pluggy configurado.');
      return;
    }

    console.log('[PluggyCron] ' + configs.length + ' usuario(s) com Pluggy configurado.');

    for (const config of configs) {
      const usuarioId = config.usuario;
      const itemsAtivos = config.items.filter(i => i.ativo);

      if (itemsAtivos.length === 0) {
        continue;
      }

      console.log('[PluggyCron] Processando usuario ' + usuarioId + ' com ' + itemsAtivos.length + ' item(s).');

      try {
        // Sync incremental: busca apenas transações após o último sync
        const ultimosSyncs = itemsAtivos
          .map(i => i.lastSyncAt)
          .filter(d => d != null)
          .map(d => new Date(d).getTime());
        const dateFrom = ultimosSyncs.length > 0
          ? new Date(Math.min(...ultimosSyncs)).toISOString()
          : undefined;
        const importacao = await pluggySyncService.iniciarSincronizacao(usuarioId.toString(), { dateFrom });

        // Sempre finalizar para permitir reconciliação (captura rendimento CDI
        // e outras mudanças não-transacionais). finalizarSincronizacao decide
        // internamente o que fazer com base no que foi inserido.
        await pluggySyncService.finalizarSincronizacao(importacao._id, usuarioId.toString());
        console.log('[PluggyCron] Usuario ' + usuarioId + ': sync finalizado (com ou sem transacoes novas).');
      } catch (err) {
        console.error('[PluggyCron] Erro ao processar usuario ' + usuarioId + ':', err.message);
      }
    }

    console.log('[PluggyCron] Sync automatico concluido.');
  } catch (err) {
    console.error('[PluggyCron] Erro geral no sync automatico:', err);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o cron de sync automatico a cada 12 horas.
 * Tambem executa imediatamente no startup (apos 30 segundos para dar tempo do DB conectar).
 */
function iniciarCron() {
  if (cronTimer) {
    console.log('[PluggyCron] Cron ja esta rodando.');
    return;
  }

  console.log('[PluggyCron] Cron configurado para executar a cada 12 horas.');

  // Executa 30 segundos apos o startup
  setTimeout(() => {
    executarSyncAutomatico().catch(err => {
      console.error('[PluggyCron] Erro no primeiro sync:', err);
    });
  }, 30000);

  // Executa a cada 12 horas
  cronTimer = setInterval(() => {
    executarSyncAutomatico().catch(err => {
      console.error('[PluggyCron] Erro no sync periodico:', err);
    });
  }, SYNC_INTERVAL_MS);
}

/**
 * Para o cron (util para testes ou shutdown gracioso).
 */
function pararCron() {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log('[PluggyCron] Cron parado.');
  }
}

module.exports = {
  iniciarCron,
  pararCron,
  executarSyncAutomatico,
  SYNC_INTERVAL_MS
};
