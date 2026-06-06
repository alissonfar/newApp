/**
 * Migração: adicionar campo emprestimoId em TransacaoImportada + índices sparse
 *
 * Após o refactor do módulo de empréstimos, TransacaoImportada passou a aceitar
 * vínculo com empréstimo (campo emprestimoId, opcional) e sub-schema
 * emprestimoConfig para permitir criar um empréstimo a partir da importação.
 *
 * Esta migração é idempotente:
 *  - Garante que todos os documentos existentes tenham emprestimoId: null
 *  - Cria o índice sparse { emprestimoId: 1 }
 *  - Cria o índice sparse { importacao: 1, emprestimoId: 1 }
 *
 * COMO EXECUTAR:
 *
 *   Desenvolvimento (usa .env.development com DB_URI):
 *     npm run migrate:006
 *     ou: node scripts/migrations/006-emprestimo-transacao-importada.js
 *
 *   Produção (usa .env.production com DB_URI):
 *     npm run migrate:006:prod
 *     ou: node scripts/migrations/006-emprestimo-transacao-importada.js --production
 *     ou (PowerShell): $env:NODE_ENV="production"; node scripts/migrations/006-emprestimo-transacao-importada.js
 *
 *   O script usa DB_URI do .env.development ou .env.production conforme o ambiente.
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
    console.error('Exemplo: DB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/banco');
    process.exit(1);
  }
  const ambiente = detectarAmbiente(uri);
  const uriExibicao = uri.replace(/:[^:@]+@/, ':****@');

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    console.log('---');
    console.log('Conectado ao MongoDB');
    console.log('Arquivo .env:', envFile || envPath);
    console.log('Banco:', dbName);
    console.log('URI:', uriExibicao);
    console.log('Ambiente detectado:', ambiente.tipo.toUpperCase(), '-', ambiente.descricao);
    console.log('---');

    const colecoes = await db.listCollections().toArray();
    const nomesColecoes = colecoes.map((c) => c.name);
    const temTransacoesImportadas = nomesColecoes.includes('transacoesimportadas');

    if (!temTransacoesImportadas) {
      console.log('Coleção transacoesimportadas não existe (banco vazio). Pulando.');
      console.log('Quando o schema for carregado, os campos serão criados automaticamente com default null.');
    } else {
      const colecao = db.collection('transacoesimportadas');

      const semCampo = await colecao.countDocuments({ emprestimoId: { $exists: false } });
      if (semCampo > 0) {
        const resultado = await colecao.updateMany(
          { emprestimoId: { $exists: false } },
          { $set: { emprestimoId: null } }
        );
        console.log(`emprestimoId preenchido em ${resultado.modifiedCount} documento(s)`);
      } else {
        console.log('Todos os documentos já possuem emprestimoId');
      }

      try {
        await colecao.createIndex({ emprestimoId: 1 }, { sparse: true });
        console.log('Índice transacoesimportadas.emprestimoId_1 (sparse) criado');
      } catch (e) {
        if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
          console.log('Índice transacoesimportadas.emprestimoId_1 já existe');
        } else throw e;
      }

      try {
        await colecao.createIndex({ importacao: 1, emprestimoId: 1 }, { sparse: true });
        console.log('Índice transacoesimportadas (importacao, emprestimoId) criado');
      } catch (e) {
        if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
          console.log('Índice transacoesimportadas (importacao, emprestimoId) já existe');
        } else throw e;
      }
    }

    console.log('Migração concluída com sucesso.');
  } catch (err) {
    console.error('Erro na migração:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
