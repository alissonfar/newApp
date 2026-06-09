/**
 * Migração 007: Limpar LedgerPatrimonial de sincronizações Pluggy
 * + resetar saldoAtual das subcontas afetadas
 *
 * Após a primeira sincronização Pluggy, o saldo das subcontas fica
 * corrompido porque a sync adiciona todas as transações históricas
 * como eventos individuais no ledger, sobrepondo o saldo existente.
 *
 * Esta migração deleta TODOS os eventos LedgerPatrimonial com
 * origemSistema='importacao_pluggy' e reseta o saldoAtual das
 * subcontas afetadas para 0, permitindo rodar a sync novamente
 * com a correção do snapshot inicial.
 *
 * COMO EXECUTAR:
 *
 *   Desenvolvimento (usa .env.development com DB_URI):
 *     node scripts/migrations/007-limpar-ledger-pluggy.js
 *
 *   Produção (usa .env.production com DB_URI):
 *     $env:NODE_ENV="production"; node scripts/migrations/007-limpar-ledger-pluggy.js
 *     ou: node scripts/migrations/007-limpar-ledger-pluggy.js --production
 *
 *   O script usa DB_URI do .env.development ou .env.production conforme o ambiente.
 */
const path = require('path');
const fs = require('fs');

const forcarProducao = process.argv.includes('--production');
const isProducao = forcarProducao || process.env.NODE_ENV === 'production';

const envFileName = isProducao ? '.env.production' : '.env.development';
const envPath = path.resolve(__dirname, '../../' + envFileName);

let envFile = fs.existsSync(envPath) ? envPath : null;
if (!envFile) {
  const fallback = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(fallback)) {
    envFile = fallback;
    console.warn('Aviso: ' + envFileName + ' nao encontrado, usando .env como fallback.');
  } else if (process.env.DB_URI || process.env.MONGODB_URI) {
    console.log('Arquivo ' + envFileName + ' nao encontrado — usando DB_URI do ambiente (Railway/Docker).');
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatarData(d) {
  if (!d) return '-';
  const data = new Date(d);
  if (isNaN(data.getTime())) return '-';
  return pad2(data.getDate()) + '/' + pad2(data.getMonth() + 1) + '/' + data.getFullYear() +
    ' ' + pad2(data.getHours()) + ':' + pad2(data.getMinutes());
}

async function run() {
  const uri = process.env.DB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Erro: DB_URI (ou MONGODB_URI) nao definida.');
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
    const nomesColecoes = colecoes.map(function(c) { return c.name; });

    // Verifica se as colecoes existem
    const temLedger = nomesColecoes.includes('ledgerpatrimonials');
    const temTransacaoPluggy = nomesColecoes.includes('transacaopluggies');
    const temImportacaoPluggy = nomesColecoes.includes('importacaopluggies');
    const temSubconta = nomesColecoes.includes('subcontas');
    const temPluggyConfig = nomesColecoes.includes('pluggyconfigs');

    if (!temLedger && !temTransacaoPluggy && !temImportacaoPluggy) {
      console.log('Colecoes ledgerpatrimonials, transacaopluggies e importacaopluggies nao existem.');
      console.log('Nada a limpar. Migracao concluida sem alteracoes.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // 1. Contar documentos a serem deletados / resetados
    const colecaoLedger = db.collection('ledgerpatrimonials');
    const colecaoTransacao = temTransacaoPluggy ? db.collection('transacaopluggies') : null;
    const colecaoImportacao = temImportacaoPluggy ? db.collection('importacaopluggies') : null;

    let totalLedger = 0;
    let totalTransacoes = 0;
    let totalImportacoes = 0;
    let subcontasAfetadasLedger = [];
    let subcontasAfetadasTx = [];

    if (temLedger) {
      totalLedger = await colecaoLedger.countDocuments({ origemSistema: 'importacao_pluggy' });
      subcontasAfetadasLedger = await colecaoLedger.distinct('subconta', {
        origemSistema: 'importacao_pluggy'
      });
    }

    if (temTransacaoPluggy) {
      totalTransacoes = await colecaoTransacao.countDocuments({});
      subcontasAfetadasTx = await colecaoTransacao.distinct('subconta', {});
    }

    if (temImportacaoPluggy) {
      totalImportacoes = await colecaoImportacao.countDocuments({});
    }

    // Union das subcontas afetadas (de ledger OU transacoes)
    const subcontasAfetadasSet = new Set();
    subcontasAfetadasLedger.forEach(function(id) { subcontasAfetadasSet.add(id.toString()); });
    subcontasAfetadasTx.forEach(function(id) { subcontasAfetadasSet.add(id.toString()); });
    const subcontasAfetadas = Array.from(subcontasAfetadasSet);

    if (totalLedger === 0 && totalTransacoes === 0 && totalImportacoes === 0) {
      console.log('Nenhum dado Pluggy encontrado para limpar. Migracao concluida.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Buscar dados das subcontas
    let dadosSubcontas = [];
    if (temSubconta && subcontasAfetadas.length > 0) {
      const colecaoSub = db.collection('subcontas');
      dadosSubcontas = await colecaoSub.find({
        _id: { $in: subcontasAfetadas.map(function(id) {
          try {
            return new mongoose.Types.ObjectId(id);
          } catch (_e) { return id; }
        })}
      }).project({ nome: 1, saldoAtual: 1, tipo: 1 }).toArray();
    }

    console.log('');
    console.log('========================================');
    console.log('  ATENCAO: Migracao DESTRUTIVA');
    console.log('========================================');
    console.log('  LedgerPatrimonial (importacao_pluggy):', totalLedger);
    console.log('  TransacaoPluggy:', totalTransacoes);
    console.log('  ImportacaoPluggy (historico de syncs):', totalImportacoes);
    console.log('  Subcontas afetadas:', subcontasAfetadas.length);
    dadosSubcontas.forEach(function(s) {
      console.log('    -', s.nome || s._id, '| tipo:', s.tipo, '| saldoAtual:', s.saldoAtual);
    });
    console.log('  PluggyConfig.lastSyncAt: limpo (full sync na proxima vez)');
    console.log('========================================');
    console.log('');

    // 2. Confirmacao do usuario
    const eProducao = ambiente.tipo === 'producao' || ambiente.tipo === 'remoto';
    const pergunta = eProducao
      ? 'Digite SIM para confirmar a migracao DESTRUTIVA: '
      : 'Tem certeza que deseja continuar? (s/N): ';

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const resposta = await new Promise(function(resolve) {
      rl.question(pergunta, resolve);
    });
    rl.close();

    const confirmou = resposta.trim().toLowerCase();
    const esperado = eProducao ? 'sim' : 's';
    if (confirmou !== esperado && confirmou !== 'sim') {
      console.log('Operacao cancelada pelo usuario. Nenhuma alteracao foi feita.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // 3. Executar delecoes
    if (temLedger && totalLedger > 0) {
      const resultadoDelete = await colecaoLedger.deleteMany({
        origemSistema: 'importacao_pluggy'
      });
      console.log('Deletados:', resultadoDelete.deletedCount, 'documento(s) do LedgerPatrimonial');
    } else {
      console.log('Nenhum LedgerPatrimonial para deletar.');
    }

    if (colecaoTransacao && totalTransacoes > 0) {
      const resultadoDeleteTx = await colecaoTransacao.deleteMany({});
      console.log('Deletados:', resultadoDeleteTx.deletedCount, 'documento(s) do TransacaoPluggy');
    } else {
      console.log('Nenhum TransacaoPluggy para deletar.');
    }

    if (colecaoImportacao && totalImportacoes > 0) {
      const resultadoDeleteImp = await colecaoImportacao.deleteMany({});
      console.log('Deletados:', resultadoDeleteImp.deletedCount, 'documento(s) do ImportacaoPluggy (historico de syncs)');
    } else {
      console.log('Nenhum ImportacaoPluggy para deletar.');
    }

    // 4. Resetar saldoAtual das subcontas afetadas
    if (temSubconta && subcontasAfetadas.length > 0) {
      const colecaoSub = db.collection('subcontas');
      const resultadoReset = await colecaoSub.updateMany(
        { _id: { $in: subcontasAfetadas.map(function(id) {
          try {
            return new mongoose.Types.ObjectId(id);
          } catch (_e) { return id; }
        })} },
        { $set: { saldoAtual: 0 } }
      );
      console.log('Subcontas resetadas:', resultadoReset.modifiedCount, '(saldoAtual -> 0)');
    }

    // 5. Resetar lastSyncAt/lastSyncError no PluggyConfig (forca full sync)
    if (temPluggyConfig) {
      const colecaoPluggy = db.collection('pluggyconfigs');
      const resultadoPluggy = await colecaoPluggy.updateMany(
        {},
        {
          $set: {
            'items.$[].lastSyncAt': null,
            'items.$[].lastSyncError': null
          }
        }
      );
      console.log('PluggyConfigs atualizados:', resultadoPluggy.modifiedCount, '(lastSyncAt/lastSyncError resetados)');
    } else {
      console.log('Colecao pluggyconfigs nao encontrada. Nada a resetar.');
    }

    console.log('');
    console.log('Migracao 007 concluida com sucesso.');
    console.log('');
    console.log('PROXIMOS PASSOS:');
    console.log('  1. Reinicie o backend (npm run dev)');
    console.log('  2. Va em Pluggy > Sincronizacao e clique em "Sincronizar"');
    console.log('  3. Va em Pluggy > Importacoes e finalize a sync pendente');
    console.log('  4. O saldo da subconta sera ajustado para o valor informado pelo banco');
    console.log('     (em vez de somar todas as transacoes historicas)');
    console.log('  5. O lastSyncAt foi resetado — a proxima sincronizacao sera completa (full sync)');
    console.log('  6. O historico de importacoes antigas foi apagado — iniciara limpo');
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
