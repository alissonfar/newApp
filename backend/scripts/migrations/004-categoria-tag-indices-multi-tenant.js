/**
 * Migração: índices multi-tenant para Categoria e Tag
 *
 * Remove o índice único global em 'codigo' e garante que o índice composto
 * { usuario: 1, codigo: 1 } unique exista.
 *
 * COMO EXECUTAR:
 *
 *   Desenvolvimento (usa .env.development com DB_URI):
 *     npm run migrate:004
 *     ou: node scripts/migrations/004-categoria-tag-indices-multi-tenant.js
 *
 *   Produção (usa .env.production com DB_URI):
 *     NODE_ENV=production node scripts/migrations/004-categoria-tag-indices-multi-tenant.js
 *
 *   O script usa a mesma configuração da aplicação: DB_URI em .env.development
 *   ou .env.production (conforme NODE_ENV).
 */
const path = require('path');
const fs = require('fs');
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../.env.production')
  : path.resolve(__dirname, '../../.env.development');

// Carrega .env.development ou .env.production; fallback para .env se não existir
const envFile = fs.existsSync(envPath) ? envPath : path.resolve(__dirname, '../../.env');
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
  // Usa DB_URI (mesma variável da aplicação e das outras migrações)
  const uri = process.env.DB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Erro: DB_URI não definida. Configure em', envFile || envPath);
    process.exit(1);
  }
  const ambiente = detectarAmbiente(uri);

  // Mascara senha na exibição
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
    const temCategorias = nomesColecoes.includes('categorias');
    const temTags = nomesColecoes.includes('tags');

    if (!temCategorias) {
      console.log('Coleção categorias não existe (banco vazio ou sem dados). Pulando.');
    } else {
      // Categoria: drop índice antigo codigo_1 (unique global) se existir
      try {
        await db.collection('categorias').dropIndex('codigo_1');
        console.log('Índice categorias.codigo_1 removido');
      } catch (e) {
        if (e.code === 27 || e.codeName === 'IndexNotFound') {
          console.log('Índice categorias.codigo_1 não existia');
        } else if (e.code === 26 || e.codeName === 'NamespaceNotFound') {
          console.log('Coleção categorias não encontrada');
        } else throw e;
      }

      // Categoria: cria índice composto { usuario: 1, codigo: 1 } unique
      try {
        await db.collection('categorias').createIndex(
          { usuario: 1, codigo: 1 },
          { unique: true }
        );
        console.log('Índice categorias (usuario, codigo) criado');
      } catch (e) {
        if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
          console.log('Índice categorias (usuario, codigo) já existe');
        } else throw e;
      }
    }

    if (!temTags) {
      console.log('Coleção tags não existe (banco vazio ou sem dados). Pulando.');
    } else {
      // Tag: drop índice antigo codigo_1 (unique global) se existir
      try {
        await db.collection('tags').dropIndex('codigo_1');
        console.log('Índice tags.codigo_1 removido');
      } catch (e) {
        if (e.code === 27 || e.codeName === 'IndexNotFound') {
          console.log('Índice tags.codigo_1 não existia');
        } else if (e.code === 26 || e.codeName === 'NamespaceNotFound') {
          console.log('Coleção tags não encontrada');
        } else throw e;
      }

      // Tag: cria índice composto { usuario: 1, codigo: 1 } unique
      try {
        await db.collection('tags').createIndex(
          { usuario: 1, codigo: 1 },
          { unique: true }
        );
        console.log('Índice tags (usuario, codigo) criado');
      } catch (e) {
        if (e.code === 85 || e.codeName === 'IndexOptionsConflict') {
          console.log('Índice tags (usuario, codigo) já existe');
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
