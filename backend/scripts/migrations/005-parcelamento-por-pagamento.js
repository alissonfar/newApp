/**
 * Migração: parcelamento por pagamento/participante
 *
 * 1. Popular parentTransactionId = installmentGroupId nas transações existentes
 *    com isInstallment === true (retrocompatibilidade).
 * 2. Popular campos de installment (installmentNumber, installmentTotal,
 *    installmentGroupId) no pagamentos[0] de cada transação parcelada.
 *
 * COMO EXECUTAR:
 *
 *   Desenvolvimento:
 *     node scripts/migrations/005-parcelamento-por-pagamento.js
 *
 *   Produção:
 *     node scripts/migrations/005-parcelamento-por-pagamento.js --production
 *     ou (PowerShell): $env:NODE_ENV="production"; node scripts/migrations/005-parcelamento-por-pagamento.js
 */
const path = require('path');
const fs = require('fs');

const forcarProducao = process.argv.includes('--production');
if (forcarProducao) process.env.NODE_ENV = 'production';

const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../.env.production')
  : path.resolve(__dirname, '../../.env.development');

let envFile = envPath;
if (!fs.existsSync(envPath)) {
  const fallback = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(fallback)) {
    envFile = fallback;
    if (process.env.NODE_ENV === 'production') {
      console.warn('Aviso: .env.production não encontrado, usando .env como fallback.');
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('Erro: .env.production não encontrado em', envPath);
    console.error('Crie o arquivo com DB_URI apontando para o banco de produção.');
    process.exit(1);
  }
}
require('dotenv').config({ path: envFile });

const mongoose = require('mongoose');

function detectarAmbiente(uri) {
  if (!uri) return { tipo: 'local', descricao: 'padrão (localhost:27017)' };
  const u = uri.toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1')) {
    return { tipo: 'desenvolvimento', descricao: 'banco local' };
  }
  if (u.includes('mongodb.net') || u.includes('atlas')) {
    return { tipo: 'produção', descricao: 'MongoDB Atlas / remoto' };
  }
  return { tipo: 'remoto', descricao: 'banco remoto (não-localhost)' };
}

async function run() {
  const uri = process.env.DB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Erro: DB_URI (ou MONGODB_URI) não definida.');
    console.error('Configure em:', envFile);
    process.exit(1);
  }
  const ambiente = detectarAmbiente(uri);
  const uriExibicao = uri.replace(/:[^:@]+@/, ':****@');

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    console.log('---');
    console.log('Migração 005: parcelamento por pagamento');
    console.log('Arquivo .env:', envFile || envPath);
    console.log('Banco:', dbName);
    console.log('URI:', uriExibicao);
    console.log('Ambiente detectado:', ambiente.tipo.toUpperCase(), '-', ambiente.descricao);
    console.log('---');

    const colecoes = await db.listCollections().toArray();
    const nomesColecoes = colecoes.map((c) => c.name);
    const temTransacoes = nomesColecoes.includes('transacaos');

    if (!temTransacoes) {
      console.log('Coleção transacaos não existe. Nada a migrar.');
    } else {
      const colecao = db.collection('transacaos');

      // Passo 1: Popular parentTransactionId onde installmentGroupId existe e parentTransactionId é null
      const result1 = await colecao.updateMany(
        {
          isInstallment: true,
          installmentGroupId: { $ne: null },
          parentTransactionId: { $eq: null }
        },
        [
          { $set: { parentTransactionId: '$installmentGroupId' } }
        ]
      );
      console.log(`Passo 1 - parentTransactionId populado: ${result1.modifiedCount} transações`);

      // Passo 2: Popular campos de installment no pagamentos[0] de cada transação parcelada
      const transacoesParceladas = await colecao.find({
        isInstallment: true,
        installmentGroupId: { $ne: null },
        'pagamentos.0': { $exists: true }
      }).project({ _id: 1, installmentNumber: 1, installmentTotal: 1, installmentGroupId: 1 }).toArray();

      let pagamentosAtualizados = 0;
      for (const t of transacoesParceladas) {
        if (t.installmentNumber == null && t.installmentTotal == null) continue;

        const updateFields = {};
        if (t.installmentNumber != null) {
          updateFields['pagamentos.0.installmentNumber'] = t.installmentNumber;
        }
        if (t.installmentTotal != null) {
          updateFields['pagamentos.0.installmentTotal'] = t.installmentTotal;
        }
        if (t.installmentGroupId != null) {
          updateFields['pagamentos.0.installmentGroupId'] = t.installmentGroupId;
        }

        if (Object.keys(updateFields).length > 0) {
          await colecao.updateOne(
            { _id: t._id, 'pagamentos.0.installmentNumber': { $eq: null } },
            { $set: updateFields }
          );
          pagamentosAtualizados++;
        }
      }
      console.log(`Passo 2 - pagamentos atualizados: ${pagamentosAtualizados} transações`);

      // Passo 3: Criar índice parentTransactionId (se não existe)
      try {
        await colecao.createIndex(
          { usuario: 1, parentTransactionId: 1 },
          { sparse: true }
        );
        console.log('Passo 3 - Índice (usuario, parentTransactionId) criado');
      } catch (e) {
        if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
          console.log('Passo 3 - Índice (usuario, parentTransactionId) já existe');
        } else throw e;
      }
    }

    console.log('Migração 005 concluída com sucesso.');
  } catch (err) {
    console.error('Erro na migração:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
