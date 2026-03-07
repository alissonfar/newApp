/**
 * Migração 003: Cria eventos snapshot_inicial no LedgerPatrimonial para subcontas existentes.
 * Dados históricos são tratados como snapshot inicial; a partir da data de deploy,
 * todos os eventos passam a ser registrados no ledger.
 *
 * Executar: node backend/scripts/migrations/003-ledger-snapshot-inicial.js
 */
const mongoose = require('mongoose');
const path = require('path');

const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../.env.production')
  : path.resolve(__dirname, '../../.env.development');

require('dotenv').config({ path: envPath });

const runMigration = async () => {
  const dbUri = process.env.DB_URI;

  if (!dbUri) {
    console.error('Erro: DB_URI não definida no arquivo .env (' + envPath + ').');
    process.exit(1);
  }

  try {
    console.log('Conectando ao MongoDB...');
    await mongoose.connect(dbUri);
    console.log('Conectado ao MongoDB com sucesso.');

    const Subconta = require('../../src/models/subconta');
    const LedgerPatrimonial = require('../../src/models/ledgerPatrimonial');

    const subcontas = await Subconta.find({
      ativo: true,
      $or: [
        { saldoAtual: { $gt: 0 } },
        { saldoAtual: { $lt: 0 } }
      ]
    }).lean();

    console.log(`Encontradas ${subcontas.length} subcontas com saldo não zero.`);

    let criados = 0;
    let ignorados = 0;

    for (const sc of subcontas) {
      const saldo = sc.saldoAtual ?? 0;
      if (saldo === 0) continue;

      const existente = await LedgerPatrimonial.findOne({
        subconta: sc._id,
        tipoEvento: 'snapshot_inicial',
        origemSistema: 'subconta_criacao'
      }).lean();

      if (existente) {
        ignorados++;
        continue;
      }

      const dataEvento = sc.dataUltimaConfirmacao || new Date();

      await LedgerPatrimonial.create({
        usuario: sc.usuario,
        subconta: sc._id,
        dataEvento,
        valor: saldo,
        tipoEvento: 'snapshot_inicial',
        origemSistema: 'subconta_criacao',
        referenciaTipo: 'subconta',
        referenciaId: sc._id,
        descricao: 'Snapshot inicial (migração ledger)',
        metadata: { migracao: '003-ledger-snapshot-inicial' }
      });

      criados++;
      console.log(`  Subconta ${sc._id}: snapshot_inicial valor=${saldo}`);
    }

    console.log('----------------------------------------');
    console.log('Migração 003 concluída.');
    console.log(`- Subcontas processadas: ${subcontas.length}`);
    console.log(`- Eventos criados: ${criados}`);
    console.log(`- Já existentes (ignorados): ${ignorados}`);
    console.log('----------------------------------------');

  } catch (error) {
    console.error('########################################');
    console.error('Erro durante a execução da migração:', error);
    console.error('########################################');
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Desconectado do MongoDB.');
    }
  }
};

runMigration();
