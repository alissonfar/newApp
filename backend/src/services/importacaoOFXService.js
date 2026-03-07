// src/services/importacaoOFXService.js
const fs = require('fs').promises;
const crypto = require('crypto');
const { parseStringPromise } = require('xml2js');
const chardet = require('chardet');
const iconv = require('iconv-lite');

const ImportacaoOFX = require('../models/importacaoOFX');
const TransacaoOFX = require('../models/transacaoOFX');
const Subconta = require('../models/subconta');
const HistoricoSaldo = require('../models/historicoSaldo');
const Transacao = require('../models/transacao');
const Usuario = require('../models/usuarios');
const { detectarMovimentacaoInterna } = require('./movimentacaoInternaService');
const ledgerService = require('./ledgerService');
const { startTransactionSession } = require('../utils/transactionHelper');

/**
 * Gera chave de deduplicação para OFX: SHA256(usuarioId|subcontaId|fitid)
 */
function gerarDeduplicationKeyOFX(usuarioId, subcontaId, fitid) {
  const composicao = `${usuarioId}|${subcontaId}|${fitid}`;
  return crypto.createHash('sha256').update(composicao).digest('hex');
}

/**
 * Parse data OFX: YYYYMMDDHHMMSS[±H:tz] -> Date
 * Ex: 20260202000000[-3:BRT] -> Date em UTC para preservar data civil em qualquer fuso.
 * Datas OFX bancárias são "data civil"; armazenar em UTC evita deslocamento na exibição.
 */
function parsearDataOFX(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) return null;
  const [, ano, mes, dia, h = '0', m = '0', s = '0'] = match;
  return new Date(Date.UTC(
    parseInt(ano, 10),
    parseInt(mes, 10) - 1,
    parseInt(dia, 10),
    parseInt(h, 10),
    parseInt(m, 10),
    parseInt(s, 10)
  ));
}

/**
 * Pré-processa arquivo OFX: detecta encoding, remove header, extrai corpo XML.
 */
async function preprocessarOFX(buffer) {
  const encoding = chardet.detect(buffer);
  const conteudo = encoding && encoding.toLowerCase() !== 'utf-8'
    ? iconv.decode(buffer, encoding)
    : buffer.toString('utf-8');

  if (!conteudo.includes('<OFX>') || !conteudo.includes('</OFX>')) {
    throw new Error('Arquivo não é OFX válido. Conteúdo deve conter tags <OFX> e </OFX>.');
  }

  const ofxStart = conteudo.indexOf('<OFX>');
  const ofxEnd = conteudo.indexOf('</OFX>') + '</OFX>'.length;
  const xmlBody = conteudo.substring(ofxStart, ofxEnd);

  return xmlBody;
}

/**
 * Extrai transações e dados do extrato do resultado do xml2js.
 */
function extrairDadosOFX(parsed) {
  const ofx = parsed?.OFX;
  if (!ofx) throw new Error('Estrutura OFX inválida.');

  const bankMsgs = Array.isArray(ofx.BANKMSGSRSV1) ? ofx.BANKMSGSRSV1[0] : ofx.BANKMSGSRSV1;
  if (!bankMsgs) throw new Error('OFX não contém BANKMSGSRSV1.');

  const stmtTrnRs = Array.isArray(bankMsgs.STMTTRNRS) ? bankMsgs.STMTTRNRS[0] : bankMsgs.STMTTRNRS;
  if (!stmtTrnRs) throw new Error('OFX não contém STMTTRNRS.');

  const stmtRs = Array.isArray(stmtTrnRs.STMTRS) ? stmtTrnRs.STMTRS[0] : stmtTrnRs.STMTRS;
  if (!stmtRs) throw new Error('OFX não contém STMTRS.');

  const bankTranList = Array.isArray(stmtRs.BANKTRANLIST) ? stmtRs.BANKTRANLIST[0] : stmtRs.BANKTRANLIST;
  if (!bankTranList) throw new Error('OFX não contém BANKTRANLIST.');

  let stmtTrn = bankTranList.STMTTRN;
  if (!stmtTrn) stmtTrn = [];
  const transacoes = Array.isArray(stmtTrn) ? stmtTrn : [stmtTrn];

  const dtStart = Array.isArray(bankTranList.DTSTART) ? bankTranList.DTSTART[0] : bankTranList.DTSTART;
  const dtEnd = Array.isArray(bankTranList.DTEND) ? bankTranList.DTEND[0] : bankTranList.DTEND;

  const ledgerBal = Array.isArray(stmtRs.LEDGERBAL) ? stmtRs.LEDGERBAL[0] : stmtRs.LEDGERBAL;
  let balAmt = null;
  let dtAsOf = null;
  if (ledgerBal) {
    balAmt = Array.isArray(ledgerBal.BALAMT) ? ledgerBal.BALAMT[0] : ledgerBal.BALAMT;
    dtAsOf = Array.isArray(ledgerBal.DTASOF) ? ledgerBal.DTASOF[0] : ledgerBal.DTASOF;
  }

  return {
    transacoes,
    dtStart,
    dtEnd,
    saldoFinal: balAmt != null ? parseFloat(String(balAmt)) : null,
    dataSaldo: dtAsOf
  };
}

/**
 * Processa arquivo OFX e cria ImportacaoOFX com TransacaoOFX.
 * @param {string} caminhoArquivo - Caminho do arquivo no disco
 * @param {string} nomeArquivo - Nome original do arquivo (ex: req.file.originalname)
 * @param {string} subcontaId - ID da subconta
 * @param {string} usuarioId - ID do usuário
 */
async function processarArquivoOFX(caminhoArquivo, nomeArquivo, subcontaId, usuarioId) {
  const subconta = await Subconta.findOne({ _id: subcontaId, usuario: usuarioId });
  if (!subconta) {
    throw new Error('Subconta não encontrada ou não pertence ao usuário.');
  }
  if (!['corrente', 'rendimento_automatico'].includes(subconta.tipo)) {
    throw new Error('Subconta deve ser do tipo corrente ou rendimento_automatico.');
  }

  const buffer = await fs.readFile(caminhoArquivo);
  const xmlBody = await preprocessarOFX(buffer);

  let parsed;
  try {
    parsed = await parseStringPromise(xmlBody, {
      explicitArray: false,
      trim: true
    });
  } catch (parseErr) {
    throw new Error(`Erro ao processar OFX: ${parseErr.message}`);
  }

  const { transacoes, dtStart, dtEnd, saldoFinal, dataSaldo } = extrairDadosOFX(parsed);

  const importacao = new ImportacaoOFX({
    usuario: usuarioId,
    subconta: subcontaId,
    nomeArquivo: nomeArquivo || caminhoArquivo.split(/[/\\]/).pop() || 'extrato.ofx',
    status: 'processando',
    dtStart: parsearDataOFX(dtStart),
    dtEnd: parsearDataOFX(dtEnd),
    saldoFinalExtrato: saldoFinal,
    dataSaldoExtrato: parsearDataOFX(dataSaldo),
    totalTransacoes: 0,
    totalCreditos: 0,
    totalDebitos: 0,
    totalIgnoradas: 0
  });
  await importacao.save();

  try {
    const usuarioStr = usuarioId.toString();
    const subcontaStr = subcontaId.toString();
    let totalCreditos = 0;
    let totalDebitos = 0;
    let totalIgnoradas = 0;
    const fitidsVistos = new Set();

    for (const trn of transacoes) {
      const fitid = Array.isArray(trn.FITID) ? trn.FITID[0] : trn.FITID;
      const trnType = (Array.isArray(trn.TRNTYPE) ? trn.TRNTYPE[0] : trn.TRNTYPE || '').toUpperCase();
      const trnAmtVal = Array.isArray(trn.TRNAMT) ? trn.TRNAMT[0] : trn.TRNAMT;
      const trnAmt = parseFloat(String(trnAmtVal != null ? trnAmtVal : 0));
      const dtPosted = Array.isArray(trn.DTPOSTED) ? trn.DTPOSTED[0] : trn.DTPOSTED;
      const memoVal = Array.isArray(trn.MEMO) ? trn.MEMO[0] : trn.MEMO;
      const memo = (memoVal != null ? String(memoVal) : '').trim();

      if (!fitid) {
        totalIgnoradas++;
        continue;
      }

      if (fitidsVistos.has(fitid)) {
        totalIgnoradas++;
        continue;
      }
      fitidsVistos.add(fitid);

      const valor = Math.abs(trnAmt);
      const tipo = trnType === 'CREDIT' ? 'credito' : 'debito';
      const data = parsearDataOFX(dtPosted);

      if (!data || isNaN(data.getTime())) {
        totalIgnoradas++;
        continue;
      }

      const dedupKey = gerarDeduplicationKeyOFX(usuarioStr, subcontaStr, fitid);
      const jaExiste = await TransacaoOFX.findOne({
        usuario: usuarioId,
        deduplicationKey: dedupKey
      }).lean();

      const status = jaExiste ? 'ja_importada' : 'pendente';
      if (jaExiste) totalIgnoradas++;

      const movimentacaoInterna = detectarMovimentacaoInterna(memo);

      const transacaoOFX = new TransacaoOFX({
        importacaoOFX: importacao._id,
        subconta: subcontaId,
        usuario: usuarioId,
        fitid,
        tipo,
        valor,
        data,
        memo,
        descricao: memo,
        status,
        movimentacaoInterna,
        deduplicationKey: dedupKey
      });
      await transacaoOFX.save();

      if (tipo === 'credito') totalCreditos += valor;
      else totalDebitos += valor;
    }

    importacao.totalTransacoes = transacoes.length;
    importacao.totalCreditos = totalCreditos;
    importacao.totalDebitos = totalDebitos;
    importacao.totalIgnoradas = totalIgnoradas;
    importacao.status = 'revisao';
    await importacao.save();

    return importacao;
  } catch (err) {
    await TransacaoOFX.deleteMany({ importacaoOFX: importacao._id }).catch(() => {});
    await ImportacaoOFX.deleteOne({ _id: importacao._id }).catch(() => {});
    throw err;
  }
}

/**
 * Finaliza importação OFX: cria HistoricoSaldo, atualiza Subconta, registra um evento
 * no ledger para CADA TransacaoOFX (pendente ou aprovada, exceto vinculadas a transferência).
 * Se a soma dos eventos não bater com o delta, cria evento de correção.
 */
async function finalizarImportacaoOFX(importacaoId, usuarioId) {
  const importacao = await ImportacaoOFX.findOne({
    _id: importacaoId,
    usuario: usuarioId
  });

  if (!importacao) {
    throw new Error('Importação OFX não encontrada.');
  }
  if (importacao.status !== 'revisao') {
    throw new Error('Só é possível finalizar importações com status revisao.');
  }

  const subconta = await Subconta.findOne({ _id: importacao.subconta, usuario: usuarioId });
  if (!subconta) {
    throw new Error('Subconta não encontrada.');
  }

  const saldoAntes = subconta.saldoAtual ?? 0;
  const saldoNovo = importacao.saldoFinalExtrato;
  const delta = saldoNovo - saldoAntes;

  const transacoesOFX = await TransacaoOFX.find({
    importacaoOFX: importacaoId,
    status: { $in: ['pendente', 'aprovada'] },
    transferencia: null
  })
    .sort({ data: 1, createdAt: 1 })
    .lean();

  let session;
  try {
    session = await startTransactionSession();
  } catch (txErr) {
    session = null;
  }

  const opts = session ? { session } : {};
  try {
    await HistoricoSaldo.create([{
      usuario: usuarioId,
      subconta: importacao.subconta,
      saldo: importacao.saldoFinalExtrato,
      data: importacao.dataSaldoExtrato,
      origem: 'importacao_ofx',
      tipo: 'ajuste',
      observacao: `Importação OFX #${importacao._id} - ${importacao.nomeArquivo}`
    }], opts);

    subconta.saldoAtual = importacao.saldoFinalExtrato;
    subconta.dataUltimaConfirmacao = importacao.dataSaldoExtrato;
    await subconta.save(opts);

    let somaEventos = 0;
    for (const tofx of transacoesOFX) {
      const valorDelta = tofx.tipo === 'credito' ? tofx.valor : -tofx.valor;
      await ledgerService.registrarEvento({
        usuarioId,
        subcontaId: importacao.subconta,
        valor: valorDelta,
        tipoEvento: tofx.tipo === 'credito' ? 'deposito' : 'saque',
        origemSistema: 'importacao_ofx',
        referenciaTipo: 'transacao_ofx',
        referenciaId: tofx._id,
        descricao: (tofx.descricao || tofx.memo || '').trim() || `OFX ${tofx.tipo} - FITID ${tofx.fitid}`,
        dataEvento: tofx.data
      }, session);
      somaEventos += valorDelta;
    }

    const diferenca = delta - somaEventos;
    if (Math.abs(diferenca) > 0.01) {
      await ledgerService.registrarEvento({
        usuarioId,
        subcontaId: importacao.subconta,
        valor: diferenca,
        tipoEvento: 'correcao',
        origemSistema: 'importacao_ofx',
        referenciaTipo: 'importacao_ofx',
        referenciaId: importacao._id,
        descricao: `Ajuste de reconciliação OFX - ${importacao.nomeArquivo}`,
        dataEvento: importacao.dataSaldoExtrato,
        metadata: { somaTransacoes: somaEventos, deltaEsperado: delta }
      }, session);
    }

    importacao.status = 'finalizada';
    await importacao.save(opts);

    if (session) {
      await session.commitTransaction();
    }
  } catch (err) {
    if (session) {
      await session.abortTransaction().catch(() => {});
    }
    throw err;
  } finally {
    if (session) session.endSession();
  }

  return importacao;
}

/**
 * Cria Transacao a partir de TransacaoOFX (reutiliza padrão do sistema).
 */
async function criarTransacaoDeTransacaoOFX(transacaoOFXId, usuarioId) {
  const TransacaoOFXModel = require('../models/transacaoOFX');
  const tofx = await TransacaoOFXModel.findOne({
    _id: transacaoOFXId,
    usuario: usuarioId
  }).populate('subconta');

  if (!tofx) {
    throw new Error('TransacaoOFX não encontrada.');
  }
  if (tofx.transacaoCriada) {
    throw new Error('Transação já foi criada para esta linha OFX.');
  }
  if (tofx.status === 'ja_importada') {
    throw new Error('Não é possível criar transação para linha já importada.');
  }

  const usuario = await Usuario.findById(usuarioId).select('preferencias.proprietario').lean();
  const proprietario = usuario?.preferencias?.proprietario?.trim() || 'Titular';

  const tipo = tofx.tipo === 'credito' ? 'recebivel' : 'gasto';
  const transacao = await Transacao.create({
    tipo,
    descricao: tofx.descricao || tofx.memo || 'Importado OFX',
    valor: tofx.valor,
    data: tofx.data,
    observacao: `Importado OFX - FITID: ${tofx.fitid}`,
    pagamentos: [{ pessoa: proprietario, valor: tofx.valor, tags: {} }],
    usuario: usuarioId,
    subconta: tofx.subconta?._id || null,
    deduplicationKey: tofx.deduplicationKey,
    status: 'ativo'
  });

  tofx.transacaoCriada = transacao._id;
  tofx.status = 'aprovada';
  await tofx.save();

  return transacao;
}

module.exports = {
  gerarDeduplicationKeyOFX,
  parsearDataOFX,
  preprocessarOFX,
  extrairDadosOFX,
  processarArquivoOFX,
  finalizarImportacaoOFX,
  criarTransacaoDeTransacaoOFX
};
