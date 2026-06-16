/**
 * Diagnostico READ-ONLY do modulo Pluggy.
 *
 * Objetivo: investigar a Hipotese 4 do parecer forense
 * ("existe divergencia entre Subconta.saldoAtual e saldoPluggy
 *   ou entre saldoAtual e o saldo reconstituido pelo ledger?").
 *
 * Este script NAO escreve nada no banco.
 * Apenas find, findOne, countDocuments, distinct, aggregate, listCollections.
 *
 * Probe da API Pluggy (secoes [8] [9] [10]):
 * - Apenas chamadas READ-ONLY: fetchItem, fetchAccounts, fetchAllTransactions.
 * - Credenciais podem ser informadas via env (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET)
 *   ou via prompt interativo. NAO sao persistidas.
 * - Se nao houver credenciais, as secoes de probe sao puladas.
 *
 * COMO EXECUTAR:
 *
 *   Desenvolvimento (usa .env.development):
 *     node scripts/diagnostico/saldo-pluggy-readonly.js
 *
 *   Para um usuario especifico:
 *     node scripts/diagnostico/saldo-pluggy-readonly.js --usuarioId=6a2fe5f9b9821a97c06cf0f8
 *
 *   Para detalhar uma importacao especifica:
 *     node scripts/diagnostico/saldo-pluggy-readonly.js --importacaoId=<ObjectId>
 *
 *   Com credenciais Pluggy via env (probe da API habilitado):
 *     $env:PLUGGY_CLIENT_ID="<id>"; $env:PLUGGY_CLIENT_SECRET="<secret>"; \
 *       node scripts/diagnostico/saldo-pluggy-readonly.js
 *
 *   Sem env, o probe sera solicitado via prompt no terminal.
 *
 *   Producao:
 *     $env:NODE_ENV="production"; node scripts/diagnostico/saldo-pluggy-readonly.js
 *     ou: node scripts/diagnostico/saldo-pluggy-readonly.js --production
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
    console.log('Arquivo ' + envFileName + ' nao encontrado — usando DB_URI do ambiente.');
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

const Subconta = require('../../src/models/subconta');
const LedgerPatrimonial = require('../../src/models/ledgerPatrimonial');
const ImportacaoPluggy = require('../../src/models/importacaoPluggy');
const PluggyConfig = require('../../src/models/pluggyConfig');
const TransacaoPluggy = require('../../src/models/transacaoPluggy');

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
    ' ' + pad2(data.getHours()) + ':' + pad2(data.getMinutes()) + ':' + pad2(data.getSeconds());
}

function formatarValor(v) {
  if (v == null || isNaN(v)) return '-';
  return Number(v).toFixed(2).padStart(12, ' ');
}

function parseArg(nome) {
  const arg = process.argv.find(function(a) { return a.startsWith('--' + nome + '='); });
  if (!arg) return null;
  return arg.split('=')[1];
}

function safeObjectId(s) {
  if (!s) return null;
  try { return new mongoose.Types.ObjectId(s); } catch (_e) { return null; }
}

function linha(char) {
  return new Array(72).join(char);
}

function cabecalho(titulo) {
  console.log('');
  console.log(linha('='));
  console.log('  ' + titulo);
  console.log(linha('='));
}

function cabecalhoSimples(titulo) {
  console.log('');
  console.log('-- ' + titulo + ' ' + linha('-').slice(0, 60));
}

function promptCredenciaisPluggy() {
  return new Promise(function(resolve) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = function(q) {
      return new Promise(function(r) { rl.question(q, r); });
    };
    (async function() {
      console.log('');
      console.log(linha('='));
      console.log('  PROBE PLUGGY API — Credenciais necessarias');
      console.log('  (somente leitura — nada sera salvo)');
      console.log(linha('='));
      const clientId = (await ask('  clientId: ')).trim();
      const clientSecret = (await ask('  clientSecret: ')).trim();
      rl.close();
      if (!clientId || !clientSecret) {
        console.log('  Credenciais incompletas. Probe da API sera pulado.');
        resolve(null);
        return;
      }
      resolve({ clientId, clientSecret });
    })();
  });
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

  const usuarioIdFiltro = parseArg('usuarioId');
  const importacaoIdFiltro = parseArg('importacaoId');

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    console.log(linha('='));
    console.log('  DIAGNOSTICO SALDO PLUGGY — MODO READ-ONLY');
    console.log('  (nenhuma alteracao sera feita no banco)');
    console.log(linha('='));
    console.log('Arquivo .env:', envFile || envPath);
    console.log('Banco:', dbName);
    console.log('URI:', uriExibicao);
    console.log('Ambiente detectado:', ambiente.tipo.toUpperCase(), '-', ambiente.descricao);
    console.log('Data execucao:', formatarData(new Date()));
    if (usuarioIdFiltro) console.log('Filtro usuarioId:', usuarioIdFiltro);
    if (importacaoIdFiltro) console.log('Filtro importacaoId:', importacaoIdFiltro);
    console.log(linha('='));

    const colecoes = await db.listCollections().toArray();
    const nomes = colecoes.map(function(c) { return c.name; });
    const temPluggy = nomes.includes('pluggyconfigs');
    const temImportacao = nomes.includes('importacaopluggies');
    const temTransacao = nomes.includes('transacaopluggies');
    const temSubconta = nomes.includes('subcontas');
    const temLedger = nomes.includes('ledgerpatrimonials');

    if (!temPluggy) {
      console.log('');
      console.log('Colecao pluggyconfigs nao existe. Nada a diagnosticar.');
      await mongoose.disconnect();
      process.exit(0);
    }

    const configQuery = { ativo: true };
    if (usuarioIdFiltro) {
      const oid = safeObjectId(usuarioIdFiltro);
      if (oid) configQuery.usuario = oid;
    }
    const configs = await PluggyConfig.find(configQuery).lean();

    cabecalho('[1] USUARIOS COM PLUGGY CONFIGURADO');
    console.log('Total:', configs.length);
    if (configs.length === 0) {
      console.log('Nenhum usuario com Pluggy configurado para o filtro aplicado.');
      await mongoose.disconnect();
      process.exit(0);
    }

    const mapaUsuario = {};
    for (const c of configs) {
      const uid = c.usuario && c.usuario.toString ? c.usuario.toString() : String(c.usuario);
      const itemsAtivos = (c.items || []).filter(function(i) { return i.ativo; });
      console.log('- ' + uid);
      console.log('    items ativos: ' + itemsAtivos.length + ' / ' + (c.items || []).length);
      for (const it of itemsAtivos) {
        console.log(
          '      - ' + (it.accountName || it.connectorName || '(sem nome)') +
          ' (' + (it.accountType || 'BANK') + ')' +
          ' itemId=' + it.itemId +
          ' accountId=' + it.accountId +
          ' subconta=' + (it.subconta || '-') +
          ' lastSyncAt=' + formatarData(it.lastSyncAt) +
          (it.lastSyncError ? ' lastSyncError=' + it.lastSyncError : '')
        );
      }
      mapaUsuario[uid] = c;
    }

    const subcontaIdsSet = new Set();
    for (const c of configs) {
      for (const it of (c.items || [])) {
        if (it.subconta) subcontaIdsSet.add(it.subconta.toString());
      }
    }
    const subcontaIds = Array.from(subcontaIdsSet)
      .map(function(s) { return safeObjectId(s); })
      .filter(Boolean);

    if (temSubconta && subcontaIds.length > 0) {
      cabecalho('[2] SUBCONTAS VINCULADAS AO PLUGGY');
      const subs = await Subconta.find({ _id: { $in: subcontaIds } }).lean();
      const instIds = Array.from(new Set(subs.map(function(s) {
        return s.instituicao ? s.instituicao.toString() : null;
      }).filter(Boolean))).map(function(s) { return safeObjectId(s); }).filter(Boolean);
      let mapaInst = {};
      if (instIds.length > 0 && nomes.includes('instituicaes')) {
        const insts = await db.collection('instituicaes')
          .find({ _id: { $in: instIds } })
          .project({ nome: 1 })
          .toArray();
        for (const it of insts) mapaInst[it._id.toString()] = it.nome;
      }
      console.log('nome              | tipo              | saldoAtual | dataUltimaConfirmacao');
      console.log(linha('-'));
      for (const s of subs) {
        const instKey = s.instituicao ? s.instituicao.toString() : null;
        const inst = mapaInst[instKey] || '-';
        const nome = (s.nome + ' (' + inst + ')').padEnd(20).slice(0, 20);
        const tipo = String(s.tipo || '-').padEnd(18).slice(0, 18);
        console.log(nome + ' | ' + tipo + ' | ' + formatarValor(s.saldoAtual) + ' | ' + formatarData(s.dataUltimaConfirmacao));
      }
      if (subs.length === 0) {
        console.log('(nenhuma subconta encontrada para os IDs referenciados)');
      }
    }

    if (temLedger) {
      cabecalho('[3] SALDO RECONSTITUIDO PELO LEDGER (origem: importacao_pluggy)');
      const matchStage = { origemSistema: 'importacao_pluggy' };
      if (usuarioIdFiltro) {
        const oid = safeObjectId(usuarioIdFiltro);
        if (oid) matchStage.usuario = oid;
      }
      const agg = await LedgerPatrimonial.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$subconta',
            total: { $sum: '$valor' },
            n_eventos: { $sum: 1 },
            primeiro: { $min: '$dataEvento' },
            ultimo: { $max: '$dataEvento' },
            tipos: { $addToSet: '$tipoEvento' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      if (agg.length === 0) {
        console.log('(nenhum evento do ledger com origem importacao_pluggy)');
      } else {
        console.log('subcontaId  | n_eventos | primeiro        | ultimo           | total      | tipos');
        console.log(linha('-'));
        for (const a of agg) {
          console.log(
            String(a._id).slice(-12).padStart(12) +
            ' | ' + String(a.n_eventos).padStart(9) +
            ' | ' + formatarData(a.primeiro).padEnd(16) +
            ' | ' + formatarData(a.ultimo).padEnd(16) +
            ' | ' + formatarValor(a.total) +
            ' | ' + (a.tipos || []).join(',')
          );
        }
      }
    }

    cabecalho('[4] ULTIMAS IMPORTACOES PLUGGY (max 5)');
    let importacoes = [];
    if (temImportacao) {
      const impQuery = {};
      if (usuarioIdFiltro) {
        const oid = safeObjectId(usuarioIdFiltro);
        if (oid) impQuery.usuario = oid;
      }
      if (importacaoIdFiltro) {
        const oid = safeObjectId(importacaoIdFiltro);
        if (oid) impQuery._id = oid;
      }
      importacoes = await ImportacaoPluggy.find(impQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      if (importacoes.length === 0) {
        console.log('(nenhuma importacao encontrada)');
      } else {
        for (const imp of importacoes) {
          console.log('');
          console.log('  _id:        ' + imp._id);
          console.log('  usuario:    ' + imp.usuario);
          console.log('  status:     ' + imp.status);
          console.log('  createdAt:  ' + formatarData(imp.createdAt));
          console.log('  dataInicio: ' + formatarData(imp.dataInicioSync));
          console.log('  dataFim:    ' + formatarData(imp.dataFimSync));
          console.log('  finalized:  ' + formatarData(imp.finalizedAt));
          console.log('  totais:     tx=' + (imp.totalTransacoes || 0) +
                      ' cred=' + formatarValor(imp.totalCreditos) +
                      ' deb=' + formatarValor(imp.totalDebitos) +
                      ' ignoradas=' + (imp.totalIgnoradas || 0) +
                      ' jaImportadas=' + (imp.totalJaImportadas || 0));
          if (imp.itens && imp.itens.length > 0) {
            console.log('  itens:');
            for (const it of imp.itens) {
              console.log('    - ' + (it.accountName || '(sem nome)') +
                ' (' + (it.accountType || 'BANK') + ')' +
                ' saldoPluggy=' + formatarValor(it.saldoPluggy) +
                ' saldoPluggyInicial=' + formatarValor(it.saldoPluggyInicial) +
                ' tx=' + (it.totalTransacoes || 0) +
                ' cred=' + formatarValor(it.totalCreditos) +
                ' deb=' + formatarValor(it.totalDebitos) +
                ' ignoradas=' + (it.totalIgnoradas || 0) +
                ' jaImportadas=' + (it.totalJaImportadas || 0) +
                (it.erro ? ' erro=' + it.erro : ''));
            }
          }
        }
      }
    }

    if (temImportacao && importacoes.length > 0 && temTransacao) {
      cabecalho('[5] DETALHE: TRANSACOES DA ULTIMA IMPORTACAO');
      const ultima = importacoes[0];
      const txs = await TransacaoPluggy.find({ importacaoPluggy: ultima._id })
        .sort({ data: 1 })
        .lean();
      console.log('Importacao:', ultima._id, '| total TransacaoPluggy:', txs.length);

      const porSubconta = {};
      for (const t of txs) {
        const k = t.subconta ? t.subconta.toString() : '?';
        if (!porSubconta[k]) porSubconta[k] = [];
        porSubconta[k].push(t);
      }

      for (const k of Object.keys(porSubconta)) {
        const lista = porSubconta[k];
        lista.sort(function(a, b) { return new Date(a.data) - new Date(b.data); });
        const primeira = lista[0];
        const ultimaTx = lista[lista.length - 1];
        const totalCred = lista.filter(function(t) { return t.tipo === 'credito'; })
          .reduce(function(s, t) { return s + (t.valor || 0); }, 0);
        const totalDeb = lista.filter(function(t) { return t.tipo === 'debito'; })
          .reduce(function(s, t) { return s + (t.valor || 0); }, 0);

        console.log('');
        console.log('  Subconta: ' + k + ' | n=' + lista.length +
          ' | cred=' + formatarValor(totalCred) +
          ' | deb=' + formatarValor(totalDeb));
        console.log('    Primeira:', primeira.descricao,
          '| data=' + formatarData(primeira.data),
          '| valor=' + formatarValor(primeira.valor),
          '| tipo=' + primeira.tipo,
          '| pluggyStatus=' + primeira.pluggyStatus,
          '| status=' + primeira.status);
        console.log('    Ultima: ', ultimaTx.descricao,
          '| data=' + formatarData(ultimaTx.data),
          '| valor=' + formatarValor(ultimaTx.valor),
          '| tipo=' + ultimaTx.tipo,
          '| pluggyStatus=' + ultimaTx.pluggyStatus,
          '| status=' + ultimaTx.status);
      }
    }

    cabecalho('[6] CORRELACAO FINAL POR SUBCONTA');
    if (!temSubconta || !temLedger || !temImportacao) {
      console.log('(colecoes necessarias ausentes — correlacao nao disponivel)');
    } else {
      const subPorId = {};
      if (subcontaIds.length > 0) {
        const subs = await Subconta.find({ _id: { $in: subcontaIds } }).lean();
        for (const s of subs) {
          subPorId[s._id.toString()] = {
            nome: s.nome,
            saldoAtual: s.saldoAtual,
            dataUltimaConfirmacao: s.dataUltimaConfirmacao
          };
        }
      }

      const matchStage = { origemSistema: 'importacao_pluggy' };
      if (usuarioIdFiltro) {
        const oid = safeObjectId(usuarioIdFiltro);
        if (oid) matchStage.usuario = oid;
      }
      const agg = await LedgerPatrimonial.aggregate([
        { $match: matchStage },
        { $group: { _id: '$subconta', total: { $sum: '$valor' } } }
      ]);
      const mapaLedger = {};
      for (const a of agg) mapaLedger[a._id.toString()] = a.total;

      const impQuery2 = {};
      if (usuarioIdFiltro) {
        const oid = safeObjectId(usuarioIdFiltro);
        if (oid) impQuery2.usuario = oid;
      }
      const ultImp = await ImportacaoPluggy.find(impQuery2)
        .sort({ createdAt: -1 })
        .limit(1)
        .lean();
      const mapaSaldoPluggy = {};
      if (ultImp.length > 0 && ultImp[0].itens) {
        for (const it of ultImp[0].itens) {
          if (it.subconta) {
            mapaSaldoPluggy[it.subconta.toString()] = {
              saldoPluggy: it.saldoPluggy,
              saldoPluggyInicial: it.saldoPluggyInicial,
              finalizedAt: ultImp[0].finalizedAt,
              status: ultImp[0].status
            };
          }
        }
      }

      console.log('subconta | saldoAtual | Σ ledger | saldoPluggy | divergencia | D');
      console.log(linha('-'));
      const chaves = new Set([].concat(
        Object.keys(subPorId),
        Object.keys(mapaLedger),
        Object.keys(mapaSaldoPluggy)
      ));
      const divergencias = [];
      for (const k of chaves) {
        const s = subPorId[k];
        const l = mapaLedger[k];
        const p = mapaSaldoPluggy[k];
        const saldoAtual = s ? s.saldoAtual : null;
        const ledgerTotal = l != null ? l : null;
        const saldoPluggy = p ? p.saldoPluggy : null;
        const div = (saldoAtual != null && ledgerTotal != null)
          ? (Number(saldoAtual) - Number(ledgerTotal))
          : null;
        const flag = (div != null && Math.abs(div) > 0.01) ? '⚠' : ' ';
        divergencias.push({ k: k, div: div, saldoAtual: saldoAtual, ledgerTotal: ledgerTotal, saldoPluggy: saldoPluggy });
        console.log(
          (s ? s.nome : k).padEnd(20).slice(0, 20) +
          ' | ' + formatarValor(saldoAtual) +
          ' | ' + formatarValor(ledgerTotal) +
          ' | ' + formatarValor(saldoPluggy) +
          ' | ' + formatarValor(div) +
          ' | ' + flag
        );
      }

      cabecalho('[7] VEREDITO');
      const temDivInterna = divergencias.some(function(d) {
        return d.div != null && Math.abs(d.div) > 0.01;
      });
      const temDivPluggy = divergencias.some(function(d) {
        return d.saldoAtual != null && d.saldoPluggy != null &&
          Math.abs(Number(d.saldoAtual) - Number(d.saldoPluggy)) > 0.01;
      });
      const temDataDesatualizada = divergencias.some(function(d) {
        if (!subPorId[d.k]) return false;
        const conf = subPorId[d.k].dataUltimaConfirmacao;
        if (!conf) return true;
        if (mapaSaldoPluggy[d.k] && mapaSaldoPluggy[d.k].finalizedAt) {
          return new Date(conf).getTime() < new Date(mapaSaldoPluggy[d.k].finalizedAt).getTime();
        }
        return false;
      });

      console.log('  Divergencia interna (saldoAtual vs Σ ledger): ' + (temDivInterna ? 'SIM' : 'NAO'));
      console.log('  Divergencia Pluggy (saldoAtual vs saldoPluggy): ' + (temDivPluggy ? 'SIM' : 'NAO'));
      console.log('  dataUltimaConfirmacao < finalizedAt da ultima importacao: ' + (temDataDesatualizada ? 'SIM' : 'NAO'));
      console.log('');
      if (!temDivInterna && !temDivPluggy && !temDataDesatualizada) {
        console.log('  >>> NENHUMA DIVERGENCIA DETECTADA. Saldo parece consistente.');
      } else {
        console.log('  >>> DIVERGENCIA(S) DETECTADA(S).');
        if (temDivInterna) {
          console.log('      - saldoAtual difere do Σ ledger — estado interno inconsistente.');
        }
        if (temDivPluggy) {
          console.log('      - saldoAtual difere do saldoPluggy (Cenario D: saldo mudou por mecanismo nao-transacional).');
        }
        if (temDataDesatualizada) {
          console.log('      - dataUltimaConfirmacao da subconta ANTERIOR ao finalizedAt da ultima importacao.');
          console.log('        Isso confirma que finalizarSincronizacao pulou a subconta (curto-circuito do cron).');
        }
      }
    }

    cabecalho('[8] PROBE: STATUS REAL DOS ITEMS NA PLUGGY');
    let probeCreds = {
      clientId: process.env.PLUGGY_CLIENT_ID || null,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET || null
    };
    if (!probeCreds.clientId || !probeCreds.clientSecret) {
      probeCreds = await promptCredenciaisPluggy();
    } else {
      console.log('  Credenciais Pluggy obtidas via env (PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET).');
    }

    const mapaStatusProbe = {};

    if (!probeCreds) {
      console.log('  Probe da API pulado (sem credenciais).');
    } else {
      const { PluggyClient } = require('pluggy-sdk');
      const pluggyClient = new PluggyClient({
        clientId: probeCreds.clientId,
        clientSecret: probeCreds.clientSecret
      });

      const itemsUnicos = new Set();
      for (const c of configs) {
        for (const it of (c.items || [])) {
          if (it.ativo && it.itemId) itemsUnicos.add(it.itemId);
        }
      }

      console.log('  Items unicos a sondar: ' + itemsUnicos.size);
      console.log('');
      console.log('  itemId  | status API | exec | lastUpdatedAt       | connector');
      console.log('  ' + linha('-').slice(0, 80));

      for (const itemId of itemsUnicos) {
        try {
          const item = await pluggyClient.fetchItem(itemId);
          const lastUpd = item.lastUpdatedAt || item.updatedAt || null;
          mapaStatusProbe[itemId] = {
            status: item.status,
            executionStatus: item.executionStatus,
            executionStatusError: item.executionStatusError,
            lastUpdatedAt: lastUpd,
            connectorId: item.connector && item.connector.id,
            connectorName: item.connector && item.connector.name
          };
          console.log(
            '  ' + itemId.slice(0, 8) + '..' +
            ' | ' + String(item.status || '-').padEnd(10) +
            ' | ' + String(item.executionStatus || '-').padEnd(20) +
            ' | ' + formatarData(lastUpd).padEnd(19) +
            ' | ' + (item.connector && item.connector.name ? item.connector.name : '-')
          );
          if (item.executionStatusError) {
            console.log('       ERRO: ' + item.executionStatusError);
          }
        } catch (errItem) {
          console.log('  ' + itemId.slice(0, 8) + '.. | ERRO AO CONSULTAR: ' + errItem.message);
          mapaStatusProbe[itemId] = { erro: errItem.message };
        }
      }

      cabecalho('[9] PROBE: ACCOUNTS REAIS NA PLUGGY vs MAPEAMENTO LOCAL');
      for (const itemId of itemsUnicos) {
        const accounts = [];
        try {
          const resp = await pluggyClient.fetchAccounts(itemId);
          const list = Array.isArray(resp && resp.results) ? resp.results : (Array.isArray(resp) ? resp : []);
          accounts.push(...list);
        } catch (errAcc) {
          console.log('');
          console.log('  Item ' + itemId + ': ERRO ao listar accounts: ' + errAcc.message);
          continue;
        }

        const mapeados = [];
        for (const c of configs) {
          for (const it of (c.items || [])) {
            if (it.ativo && it.itemId === itemId) mapeados.push(it);
          }
        }
        const idsMapeados = new Set(mapeados.map(function(m) { return m.accountId; }));

        console.log('');
        console.log('  Item: ' + itemId + ' | total accounts retornadas: ' + accounts.length);
        console.log('  ' + (mapeados[0] && mapeados[0].connectorName ? mapeados[0].connectorName : ''));
        console.log('  id (mapeada?) | type | subtype    | name            | balance   | currency');
        console.log('  ' + linha('-').slice(0, 90));
        for (const a of accounts) {
          const ehMapeada = idsMapeados.has(a.id);
          console.log(
            '  ' + (a.id || '-').slice(0, 8) + '..' + (ehMapeada ? ' ★' : '  ') +
            '   | ' + String(a.type || '-').padEnd(4) +
            ' | ' + String(a.subtype || '-').padEnd(10) +
            ' | ' + String(a.name || a.marketingName || '-').slice(0, 15).padEnd(15) +
            ' | ' + formatarValor(a.balance) +
            ' | ' + String(a.currencyCode || '-')
          );
        }
        for (const m of mapeados) {
          if (!accounts.find(function(a) { return a.id === m.accountId; })) {
            console.log('  *** ATENCAO: accountId mapeado ' + m.accountId + ' NAO existe nas accounts deste item ***');
            console.log('      mapeado: ' + (m.accountName || m.connectorName) +
              ' (' + (m.accountType || 'BANK') + ') subconta=' + m.subconta);
          }
        }
      }

      cabecalho('[10] PROBE: ULTIMAS 50 TRANSACOES POR ACCOUNT MAPEADA');
      const LIMITE_TX = 50;
      for (const c of configs) {
        for (const it of (c.items || [])) {
          if (!it.ativo) continue;
          const acc = {
            itemId: it.itemId,
            accountId: it.accountId,
            accountName: it.accountName || it.connectorName || '(sem nome)',
            accountType: it.accountType || 'BANK',
            subconta: it.subconta
          };
          let txs = [];
          let erro = null;
          try {
            const fetched = await pluggyClient.fetchAllTransactions(acc.accountId, {});
            txs = Array.isArray(fetched) ? fetched : (Array.isArray(fetched && fetched.results) ? fetched.results : []);
          } catch (errTx) {
            erro = errTx.message;
          }

          console.log('');
          console.log('  Item: ' + acc.itemId + ' | accountId: ' + acc.accountId);
          console.log('  Nome: ' + acc.accountName + ' | tipo: ' + acc.accountType + ' | subconta: ' + (acc.subconta || '-'));
          if (erro) {
            console.log('  ERRO: ' + erro);
            continue;
          }
          console.log('  Total retornado pela API Pluggy: ' + txs.length + (txs.length >= LIMITE_TX ? ' (limitado a ' + LIMITE_TX + ' para exibicao)' : ''));

          const lista = txs.slice(0, LIMITE_TX);
          const ordenadas = lista.slice().sort(function(a, b) {
            const da = a.date ? new Date(a.date).getTime() : 0;
            const db2 = b.date ? new Date(b.date).getTime() : 0;
            return da - db2;
          });
          const primeira = ordenadas[0];
          const ultimaTx = ordenadas[ordenadas.length - 1];

          if (ordenadas.length > 0) {
            console.log('  Primeira (por data): ' +
              (primeira.description || primeira.descriptionRaw || '-') +
              ' | data=' + formatarData(primeira.date) +
              ' | valor=' + formatarValor(primeira.amount) +
              ' | type=' + (primeira.type || '-') +
              ' | status=' + (primeira.status || '-'));
            console.log('  Ultima  (por data): ' +
              (ultimaTx.description || ultimaTx.descriptionRaw || '-') +
              ' | data=' + formatarData(ultimaTx.date) +
              ' | valor=' + formatarValor(ultimaTx.amount) +
              ' | type=' + (ultimaTx.type || '-') +
              ' | status=' + (ultimaTx.status || '-'));
          } else {
            console.log('  (Nenhuma transacao retornada pela API para esta account)');
          }

          const statusItem = mapaStatusProbe[acc.itemId];
          const statusApi = statusItem ? statusItem.status : 'DESCONHECIDO';
          console.log('  Diagnostico:');
          if (ordenadas.length === 0 && statusApi !== 'UPDATED') {
            console.log('    - Item nao esta UPDATED (status=' + statusApi + ') — provavelmente precisa REAUTORIZAR no banco.');
          } else if (ordenadas.length === 0 && statusApi === 'UPDATED') {
            console.log('    - Item esta UPDATED, mas API retornou 0 transacoes.');
            console.log('      Possiveis causas: conta realmente sem movimentacao, ou filtro/conector com problema.');
          } else if (ordenadas.length > 0 && (!importacoes[0] || !importacoes[0].itens)) {
            console.log('    - API retornou transacoes mas nao ha run recente para comparar.');
          } else {
            const itemRun = (importacoes[0] && importacoes[0].itens || []).find(function(x) {
              return x.accountId === acc.accountId;
            });
            const txRun = itemRun ? (itemRun.totalTransacoes || 0) : 0;
            if (txRun === 0 && ordenadas.length > 0) {
              console.log('    - API retornou ' + ordenadas.length + ' transacoes mas a run recente gravou 0. BUG SILENCIOSO.');
            } else if (txRun > 0) {
              console.log('    - Run recente gravou ' + txRun + ' transacoes; API retornou ' + ordenadas.length + '.');
            }
          }
        }
      }
    }

    cabecalho('[11] RECONCILIACAO: CONTAGENS POR STATUS (ULTIMA IMPORTACAO)');
    if (temTransacao && importacoes.length > 0) {
      const ult = importacoes[0];
      const counts = await TransacaoPluggy.aggregate([
        { $match: { importacaoPluggy: ult._id } },
        { $group: { _id: '$status', n: { $sum: 1 } } }
      ]);
      const mapaStatus = {};
      for (const c of counts) mapaStatus[c._id || '(null)'] = c.n;
      console.log('  Importacao: ' + ult._id + ' | createdAt: ' + formatarData(ult.createdAt));
      console.log('  ' + linha('-'));
      console.log('  status        | count');
      console.log('  ' + linha('-'));
      for (const s of Object.keys(mapaStatus).sort()) {
        console.log('  ' + s.padEnd(13) + ' | ' + mapaStatus[s]);
      }
      const soma = Object.values(mapaStatus).reduce(function(a, b) { return a + b; }, 0);
      const totReport = (ult.totalTransacoes || 0)
        + (ult.totalIgnoradas || 0)
        + (ult.totalJaImportadas || 0);
      console.log('  ' + linha('-'));
      console.log('  SOMA(counts)  = ' + soma);
      console.log('  total+ignor+jaImp (doc) = ' + totReport);
      console.log('  totalTransacoes (doc)   = ' + (ult.totalTransacoes || 0));
      if (soma !== totReport) {
        console.log('  >>> DISCREPANCIA: soma dos counts difere do reportado em itens.totalTransacoes/totalIgnoradas/totalJaImportadas.');
      } else {
        console.log('  Contagens consistentes.');
      }
    } else {
      console.log('  (sem importacao para reconciliar)');
    }

    cabecalho('[12] TRANSACOES PLUGGY NO BANCO PARA CADA SUBCONTA');
    if (temTransacao) {
      for (const c of configs) {
        for (const it of (c.items || [])) {
          if (!it.ativo || !it.subconta) continue;
          const total = await TransacaoPluggy.countDocuments({ subconta: it.subconta });
          const porStatus = await TransacaoPluggy.aggregate([
            { $match: { subconta: it.subconta } },
            { $group: { _id: '$status', n: { $sum: 1 } } }
          ]);
          const porPluggyStatus = await TransacaoPluggy.aggregate([
            { $match: { subconta: it.subconta } },
            { $group: { _id: '$pluggyStatus', n: { $sum: 1 } } }
          ]);
          const maisRecente = await TransacaoPluggy.findOne({ subconta: it.subconta })
            .sort({ createdAt: -1 })
            .lean();
          const maisAntiga = await TransacaoPluggy.findOne({ subconta: it.subconta })
            .sort({ data: 1 })
            .lean();
          console.log('');
          console.log('  Subconta: ' + (it.accountName || it.connectorName) + ' | ' + it.subconta);
          console.log('  Total TransacaoPluggy: ' + total);
          console.log('    Por status interno: ' + porStatus.map(function(p) { return p._id + '=' + p.n; }).join(', '));
          console.log('    Por pluggyStatus:   ' + porPluggyStatus.map(function(p) { return (p._id || '(null)') + '=' + p.n; }).join(', '));
          if (maisAntiga) {
            console.log('    Mais antiga: data=' + formatarData(maisAntiga.data) +
              ' | valor=' + formatarValor(maisAntiga.valor) +
              ' | desc=' + (maisAntiga.descricao || '-').slice(0, 40));
          }
          if (maisRecente) {
            console.log('    Mais recente: data=' + formatarData(maisRecente.data) +
              ' | valor=' + formatarValor(maisRecente.valor) +
              ' | desc=' + (maisRecente.descricao || '-').slice(0, 40));
          }
          if (total === 0) {
            console.log('    >>> ZERO TransacaoPluggy para esta subconta. Provavelmente finalizarSincronizacao nunca foi chamada para ela.');
          }
        }
      }
    } else {
      console.log('  (colecao transacaopluggies nao existe)');
    }

    cabecalho('FIM');
    console.log('Diagnostico concluido. Nenhuma alteracao feita no banco.');
    console.log('');

  } catch (err) {
    console.error('Erro no diagnostico:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
