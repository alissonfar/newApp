/**
 * Migração 008: Simplificação do módulo de Empréstimos
 *
 * Normaliza dados legados para o modelo simplificado:
 *  - tipoRetorno: 'juros_percentual'/'juros_fixo' → 'valor_fixo' (preserva valorEsperadoRetorno)
 *  - direcao: 'recebido' → 'concedido' (campo será removido do schema na próxima fase)
 *  - Remove campos taxaJurosPercentual e valorJurosFixo (não fazem mais parte do schema)
 *  - Mesma normalização em transacoesimportadas.emprestimoConfig
 *
 * Esta migração é IDEMPOTENTE: pode ser rodada múltiplas vezes sem efeito colateral.
 * NÃO é destrutiva: apenas normaliza dados antigos para o novo modelo.
 *
 * NÃO recalcula TXs de juros auto: a decisão foi manter histórico "como está" e deixar
 * que `recalcularStatus` corrija naturalmente em próxima edição, caso haja discrepância.
 *
 * COMO EXECUTAR:
 *
 *   Desenvolvimento (usa .env.development com DB_URI):
 *     node scripts/migrations/008-emprestimo-simplificacao.js
 *
 *   Produção (usa .env.production com DB_URI):
 *     $env:NODE_ENV="production"; node scripts/migrations/008-emprestimo-simplificacao.js
 *     ou: node scripts/migrations/008-emprestimo-simplificacao.js --production
 *
 *   O script usa DB_URI do .env.development ou .env.production conforme o ambiente.
 */
const path = require('path');
const fs = require('fs');

const forcarProducao = process.argv.includes('--production');
if (forcarProducao) process.env.NODE_ENV = 'production';

const envFileName = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const envPath = path.resolve(__dirname, '../../' + envFileName);

let envFile = envPath;
if (!fs.existsSync(envPath)) {
  const fallback = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(fallback)) {
    envFile = fallback;
    if (process.env.NODE_ENV === 'production') {
      console.warn('Aviso: .env.production nao encontrado, usando .env como fallback.');
    }
  } else if (process.env.DB_URI || process.env.MONGODB_URI) {
    console.log(envFileName + ' nao encontrado — usando DB_URI do ambiente (Railway/Docker).');
  } else {
    console.error('Erro: ' + envFileName + ' nao encontrado e DB_URI nao definida no ambiente.');
    console.error('Esperado: ' + envPath);
    process.exit(1);
  }
}
if (envFile) {
  require('dotenv').config({ path: envFile });
}

const mongoose = require('mongoose');

function detectarAmbiente(uri) {
  if (!uri) return { tipo: 'local', descricao: 'padrao (localhost:27017)' };
  const u = uri.toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1')) {
    return { tipo: 'desenvolvimento', descricao: 'banco local' };
  }
  if (u.includes('mongodb.net') || u.includes('atlas')) {
    return { tipo: 'producao', descricao: 'MongoDB Atlas / remoto' };
  }
  return { tipo: 'remoto', descricao: 'banco remoto (nao-localhost)' };
}

async function run() {
  const uri = process.env.DB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Erro: DB_URI (ou MONGODB_URI) nao definida.');
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
    console.log('Conectado ao MongoDB');
    console.log('Arquivo .env:', envFile);
    console.log('Banco:', dbName);
    console.log('URI:', uriExibicao);
    console.log('Ambiente detectado:', ambiente.tipo.toUpperCase(), '-', ambiente.descricao);
    console.log('---');

    const colecoes = await db.listCollections().toArray();
    const nomesColecoes = colecoes.map((c) => c.name);
    const temEmprestimos = nomesColecoes.includes('emprestimos');
    const temTransacoesImportadas = nomesColecoes.includes('transacoesimportadas');

    if (!temEmprestimos && !temTransacoesImportadas) {
      console.log('Colecoes emprestimos e transacoesimportadas nao existem.');
      console.log('Nada a normalizar. Migracao concluida sem alteracoes.');
      await mongoose.disconnect();
      process.exit(0);
    }

    let totalEmprestimosNormalizados = 0;
    let totalTransacoesImportadasNormalizadas = 0;

    // ====================================================================
    // 1. EMPRESTIMOS: normalizar tipoRetorno, direcao e remover campos
    // ====================================================================
    if (temEmprestimos) {
      const colecaoEmp = db.collection('emprestimos');

      // 1a. tipoRetorno: 'juros_percentual' ou 'juros_fixo' → 'valor_fixo'
      const docsTipoAntigo = await colecaoEmp.find({
        tipoRetorno: { $in: ['juros_percentual', 'juros_fixo'] }
      }).project({ _id: 1, tipoRetorno: 1 }).toArray();

      if (docsTipoAntigo.length > 0) {
        const ids = docsTipoAntigo.map(d => d._id);
        const resultadoTipo = await colecaoEmp.updateMany(
          { _id: { $in: ids } },
          { $set: { tipoRetorno: 'valor_fixo' } }
        );
        console.log(`[emprestimos] tipoRetorno normalizado em ${resultadoTipo.modifiedCount} doc(s) (juros_* -> valor_fixo)`);
        totalEmprestimosNormalizados += resultadoTipo.modifiedCount;
      } else {
        console.log('[emprestimos] Nenhum doc com tipoRetorno antigo (juros_*)');
      }

      // 1b. direcao: 'recebido' → 'concedido'
      const resultadoDirecao = await colecaoEmp.updateMany(
        { direcao: 'recebido' },
        { $set: { direcao: 'concedido' } }
      );
      if (resultadoDirecao.modifiedCount > 0) {
        console.log(`[emprestimos] direcao normalizada em ${resultadoDirecao.modifiedCount} doc(s) (recebido -> concedido)`);
        totalEmprestimosNormalizados += resultadoDirecao.modifiedCount;
      } else {
        console.log('[emprestimos] Nenhum doc com direcao=recebido');
      }

      // 1c. Remover campos taxaJurosPercentual e valorJurosFixo
      const resultadoUnset = await colecaoEmp.updateMany(
        {},
        { $unset: { taxaJurosPercentual: '', valorJurosFixo: '' } }
      );
      if (resultadoUnset.modifiedCount > 0) {
        console.log(`[emprestimos] Campos taxaJurosPercentual/valorJurosFixo removidos de ${resultadoUnset.modifiedCount} doc(s)`);
      } else {
        console.log('[emprestimos] Nenhum doc com taxaJurosPercentual/valorJurosFixo para remover');
      }
    } else {
      console.log('Colecao emprestimos nao existe. Pulando normalizacao de emprestimos.');
    }

    // ====================================================================
    // 2. TRANSACOESIMPORTADAS: normalizar emprestimoConfig
    // ====================================================================
    if (temTransacoesImportadas) {
      const colecaoTI = db.collection('transacoesimportadas');

      // 2a. emprestimoConfig.tipoRetorno: 'juros_*' → 'valor_fixo'
      const docsTipoAntigo = await colecaoTI.find({
        'emprestimoConfig.tipoRetorno': { $in: ['juros_percentual', 'juros_fixo'] }
      }).project({ _id: 1 }).toArray();

      if (docsTipoAntigo.length > 0) {
        const ids = docsTipoAntigo.map(d => d._id);
        const resultadoTipo = await colecaoTI.updateMany(
          { _id: { $in: ids } },
          { $set: { 'emprestimoConfig.tipoRetorno': 'valor_fixo' } }
        );
        console.log(`[transacoesimportadas] emprestimoConfig.tipoRetorno normalizado em ${resultadoTipo.modifiedCount} doc(s)`);
        totalTransacoesImportadasNormalizadas += resultadoTipo.modifiedCount;
      } else {
        console.log('[transacoesimportadas] Nenhum doc com emprestimoConfig.tipoRetorno antigo');
      }

      // 2b. emprestimoConfig.direcao: 'recebido' → 'concedido'
      const resultadoDirecao = await colecaoTI.updateMany(
        { 'emprestimoConfig.direcao': 'recebido' },
        { $set: { 'emprestimoConfig.direcao': 'concedido' } }
      );
      if (resultadoDirecao.modifiedCount > 0) {
        console.log(`[transacoesimportadas] emprestimoConfig.direcao normalizada em ${resultadoDirecao.modifiedCount} doc(s)`);
        totalTransacoesImportadasNormalizadas += resultadoDirecao.modifiedCount;
      } else {
        console.log('[transacoesimportadas] Nenhum doc com emprestimoConfig.direcao=recebido');
      }

      // 2c. Remover emprestimoConfig.taxaJurosPercentual e emprestimoConfig.valorJurosFixo
      const resultadoUnset = await colecaoTI.updateMany(
        {},
        { $unset: { 'emprestimoConfig.taxaJurosPercentual': '', 'emprestimoConfig.valorJurosFixo': '' } }
      );
      if (resultadoUnset.modifiedCount > 0) {
        console.log(`[transacoesimportadas] Campos emprestimoConfig.taxaJurosPercentual/valorJurosFixo removidos de ${resultadoUnset.modifiedCount} doc(s)`);
      } else {
        console.log('[transacoesimportadas] Nenhum doc com emprestimoConfig.taxaJurosPercentual/valorJurosFixo para remover');
      }
    } else {
      console.log('Colecao transacoesimportadas nao existe. Pulando normalizacao de TIs.');
    }

    console.log('');
    console.log('========================================');
    console.log('  Migracao 008 concluida');
    console.log('========================================');
    console.log(`  Emprestimos normalizados: ${totalEmprestimosNormalizados}`);
    console.log(`  TIs normalizadas: ${totalTransacoesImportadasNormalizadas}`);
    console.log('========================================');
    console.log('');
    console.log('OBSERVACOES:');
    console.log('  - Migracao idempotente: pode ser rodada multiplas vezes.');
    console.log('  - NAO recalcula TXs de juros auto. recalcularStatus cuida disso em');
    console.log('    proxima edicao caso haja discrepancia.');
    console.log('  - Apos esta migracao, o schema do backend pode ser deployado com');
    console.log('    seguranca (remocao de direcao/taxaJurosPercentual/valorJurosFixo).');
    console.log('');

  } catch (err) {
    console.error('Erro na migracao:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
