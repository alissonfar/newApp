/**
 * Migração 009: Limpeza do módulo de Empréstimos (alinhada ao design 2026-06-24)
 *
 * Contexto:
 *  O campo `valorEsperadoRetorno` foi movido do schema Emprestimo para o schema
 *  Transacao (cada gasto vinculado a um Empréstimo agora carrega o seu próprio
 *  valor esperado). Com isso, a representação antiga (1 número global no
 *  Empréstimo) deixa de fazer sentido e precisa ser descartada antes do
 *  deploy do novo schema.
 *
 * Decisão do Alisson: ainda NÃO usou Empréstimos em produção, então é seguro
 * descartar os Empréstimos existentes e desvincular as TXs/TIs.
 *
 * Ações idempotentes:
 *  1. Log dos Empréstimos que serão deletados (para auditoria).
 *  2. `Emprestimo.deleteMany({})` (apaga TODOS os Empréstimos, independente
 *     de usuário — a coleção contém apenas dados locais, e em prod ainda
 *     não há nada em uso real).
 *  3. `Transacao.updateMany({ emprestimoId: { $ne: null } }, ...)` desvincula
 *     todas as TXs que apontavam para um Empréstimo, marcando também
 *     `emprestimoEhJurosAuto = false` para garantir que nenhuma TX de juros
 *     auto fique órfã. **As TXs originais NÃO são removidas** — só perdem
 *     o vínculo com Empréstimo. Gastos/recebíveis continuam existindo.
 *  4. `TransacaoImportada.updateMany({ 'emprestimoConfig.ativo': true }, ...)`
 *     zera o `emprestimoConfig` das TIs que estavam configuradas para virar
 *     Empréstimo. Assim, ao finalizar uma importação, nenhuma TI marcada
 *     resgatará um Empréstimo inexistente.
 *
 * Esta migração é IDEMPOTENTE: pode ser rodada múltiplas vezes sem efeito
 * colateral. Após a segunda execução, as ações de delete/updateMany não
 * encontrarão docs para modificar.
 *
 * NÃO toca em:
 *  - Pessoas (Pessoa collection) — Empréstimos deletados não afetam Pessoas.
 *  - Outras collections (Conta, Subconta, Ledger, NetWorth, Pluggy).
 *
 * COMO EXECUTAR:
 *
 *   Desenvolvimento (usa .env.development com DB_URI):
 *     node scripts/migrations/009-emprestimo-limpeza.js
 *
 *   Produção (usa .env.production com DB_URI):
 *     $env:NODE_ENV="production"; node scripts/migrations/009-emprestimo-limpeza.js
 *     ou: node scripts/migrations/009-emprestimo-limpeza.js --production
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
    const temTransacoes = nomesColecoes.includes('transacoes');
    const temTransacoesImportadas = nomesColecoes.includes('transacoesimportadas');

    if (!temEmprestimos && !temTransacoes && !temTransacoesImportadas) {
      console.log('Nenhuma das colecoes relevantes existe (emprestimos, transacoes, transacoesimportadas).');
      console.log('Nada a limpar. Migracao concluida sem alteracoes.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // ====================================================================
    // 1. EMPRESTIMOS: listar (log) e deletar todos
    // ====================================================================
    let totalEmprestimosDeletados = 0;
    if (temEmprestimos) {
      const colecaoEmp = db.collection('emprestimos');
      const emprestimos = await colecaoEmp.find({})
        .project({ _id: 1, pessoaNomeSnapshot: 1, usuario: 1, status: 1 })
        .toArray();

      if (emprestimos.length > 0) {
        console.log(`[migration 009] Encontrados ${emprestimos.length} emprestimo(s) para limpar:`);
        for (const emp of emprestimos) {
          console.log(`  - _id=${emp._id} | pessoa=${emp.pessoaNomeSnapshot || '(sem snapshot)'} | status=${emp.status || '?'}`);
        }
        const resultadoDel = await colecaoEmp.deleteMany({});
        totalEmprestimosDeletados = resultadoDel.deletedCount || 0;
        console.log(`[migration 009] ${totalEmprestimosDeletados} emprestimo(s) deletado(s)`);
      } else {
        console.log('[migration 009] Colecao emprestimos vazia. Nada a deletar.');
      }
    } else {
      console.log('Colecao emprestimos nao existe. Pulando etapa 1.');
    }

    // ====================================================================
    // 2. TRANSACOES: desvincular emprestimoId e zerar flag de juros auto
    // ====================================================================
    let totalTransacoesDesvinculadas = 0;
    if (temTransacoes) {
      const colecaoTx = db.collection('transacoes');

      // 2a. Listar (log) TXs que serao desvinculadas
      const txsVinculadas = await colecaoTx.find(
        { emprestimoId: { $ne: null } },
        { projection: { _id: 1, descricao: 1, tipo: 1, emprestimoId: 1, emprestimoEhJurosAuto: 1 } }
      ).toArray();
      if (txsVinculadas.length > 0) {
        console.log(`[migration 009] Encontradas ${txsVinculadas.length} transacao(oes) com emprestimoId vinculado. Serao desvinculadas (TXs permanecem ativas).`);
      }

      // 2b. UpdateMany: desvincula emprestimoId e zera flag de juros auto
      const resultadoUnset = await colecaoTx.updateMany(
        { emprestimoId: { $ne: null } },
        { $set: { emprestimoId: null, emprestimoEhJurosAuto: false } }
      );
      totalTransacoesDesvinculadas = resultadoUnset.modifiedCount || 0;
      if (totalTransacoesDesvinculadas > 0) {
        console.log(`[migration 009] ${totalTransacoesDesvinculadas} transacao(oes) desvinculada(s) de emprestimos (emprestimoId=null, emprestimoEhJurosAuto=false)`);
      } else {
        console.log('[migration 009] Nenhuma transacao precisou ser desvinculada.');
      }
    } else {
      console.log('Colecao transacoes nao existe. Pulando etapa 2.');
    }

    // ====================================================================
    // 3. TRANSACOESIMPORTADAS: zerar emprestimoConfig das TIs marcadas
    // ====================================================================
    let totalTIsZeradas = 0;
    if (temTransacoesImportadas) {
      const colecaoTI = db.collection('transacoesimportadas');

      // 3a. Listar (log) TIs que serao afetadas
      const tisComConfig = await colecaoTI.find(
        { 'emprestimoConfig.ativo': true },
        { projection: { _id: 1, descricao: 1, 'emprestimoConfig.pessoaNomeSnapshot': 1 } }
      ).toArray();
      if (tisComConfig.length > 0) {
        console.log(`[migration 009] Encontradas ${tisComConfig.length} TI(s) com emprestimoConfig.ativo=true. Serao zeradas.`);
      }

      // 3b. UpdateMany: zera o sub-objeto emprestimoConfig (mantem a chave, marca ativo=false)
      const resultadoTI = await colecaoTI.updateMany(
        { 'emprestimoConfig.ativo': true },
        { $set: { emprestimoConfig: { ativo: false } } }
      );
      totalTIsZeradas = resultadoTI.modifiedCount || 0;
      if (totalTIsZeradas > 0) {
        console.log(`[migration 009] ${totalTIsZeradas} TI(s) tiveram emprestimoConfig zerado (ativo=false)`);
      } else {
        console.log('[migration 009] Nenhuma TI com emprestimoConfig.ativo=true para zerar.');
      }

      // 3c. Bonus: limpar emprestimoId e emprestimoIdOrigemCriado das TIs (ja nao fazem sentido
      //     sem Emprestimo correspondente)
      const resultadoTIId = await colecaoTI.updateMany(
        { emprestimoId: { $ne: null } },
        { $set: { emprestimoId: null, emprestimoIdOrigemCriado: null } }
      );
      const txsIdLimpos = resultadoTIId.modifiedCount || 0;
      if (txsIdLimpos > 0) {
        console.log(`[migration 009] ${txsIdLimpos} TI(s) com emprestimoId/emprestimoIdOrigemCriado foram desvinculadas`);
      }
    } else {
      console.log('Colecao transacoesimportadas nao existe. Pulando etapa 3.');
    }

    console.log('');
    console.log('========================================');
    console.log('  Migracao 009 concluida');
    console.log('========================================');
    console.log(`  Emprestimos deletados: ${totalEmprestimosDeletados}`);
    console.log(`  Transacoes desvinculadas: ${totalTransacoesDesvinculadas}`);
    console.log(`  TIs com emprestimoConfig zerado: ${totalTIsZeradas}`);
    console.log('========================================');
    console.log('');
    console.log('OBSERVACOES:');
    console.log('  - Migracao idempotente: pode ser rodada multiplas vezes.');
    console.log('  - NAO destrutiva com TXs originais: so desvincula (emprestimoId=null).');
    console.log('  - NAO toca em Pessoas, Subcontas, Ledger, NetWorth, Pluggy.');
    console.log('  - Apos esta migracao, o deploy do novo schema (sem valorEsperadoRetorno');
    console.log('    no Emprestimo) pode ser feito com seguranca.');
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
