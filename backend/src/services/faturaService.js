const Subconta = require('../models/subconta');
const LedgerPatrimonial = require('../models/ledgerPatrimonial');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function ultimoDiaDoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

function calcularPeriodoFatura(fechamentoFatura, anoMes) {
  const partes = String(anoMes).split('-');
  const ano = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);

  let dataInicio, dataFim, label;

  if (fechamentoFatura == null) {
    dataInicio = ano + '-' + pad2(mes) + '-01';
    dataFim = ano + '-' + pad2(mes) + '-' + pad2(ultimoDiaDoMes(ano, mes));
    label = '01/' + pad2(mes) + ' a ' + pad2(ultimoDiaDoMes(ano, mes)) + '/' + ano;
    return { dataInicio, dataFim, label };
  }

  let diaFim;
  if (fechamentoFatura === 0) {
    diaFim = ultimoDiaDoMes(ano, mes);
  } else {
    diaFim = Math.min(fechamentoFatura, ultimoDiaDoMes(ano, mes));
  }

  dataFim = ano + '-' + pad2(mes) + '-' + pad2(diaFim);

  // Inicio = dia seguinte ao fechamento no mês anterior
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;

  let diaInicio;
  if (fechamentoFatura === 0) {
    diaInicio = 1;
  } else {
    diaInicio = Math.min(fechamentoFatura, ultimoDiaDoMes(anoAnterior, mesAnterior)) + 1;
    if (diaInicio > ultimoDiaDoMes(anoAnterior, mesAnterior)) {
      diaInicio = 1;
    }
  }

  dataInicio = anoAnterior + '-' + pad2(mesAnterior) + '-' + pad2(diaInicio);
  label = pad2(diaInicio) + '/' + pad2(mesAnterior) + ' a ' + pad2(diaFim) + '/' + pad2(mes);

  return { dataInicio, dataFim, label };
}

async function obterFaturas(usuarioId, anoMes) {
  if (!anoMes) {
    const hoje = new Date();
    anoMes = hoje.getFullYear() + '-' + pad2(hoje.getMonth() + 1);
  }

  const cartoes = await Subconta.find({
    usuario: usuarioId,
    ativo: true,
    tipo: 'cartao_credito'
  }).populate('instituicao').lean();

  const resultados = [];

  for (const cartao of cartoes) {
    const { dataInicio, dataFim, label: periodoLabel } = calcularPeriodoFatura(cartao.fechamentoFatura, anoMes);

    const eventos = await LedgerPatrimonial.find({
      usuario: usuarioId,
      subconta: cartao._id,
      dataEvento: { $gte: new Date(dataInicio + 'T12:00:00.000Z'), $lte: new Date(dataFim + 'T12:00:00.000Z') },
      tipoEvento: { $in: ['compra_credito', 'pagamento_fatura'] }
    }).sort({ dataEvento: 1 }).lean();

    let totalCompras = 0;
    let totalPagamentos = 0;

    for (const ev of eventos) {
      if (ev.tipoEvento === 'compra_credito') {
        totalCompras += Math.abs(ev.valor);
      } else if (ev.tipoEvento === 'pagamento_fatura') {
        totalPagamentos += ev.valor;
      }
    }

    resultados.push({
      subcontaId: cartao._id,
      nome: cartao.nome,
      instituicao: cartao.instituicao ? { _id: cartao.instituicao._id, nome: cartao.instituicao.nome } : null,
      saldoAtual: cartao.saldoAtual || 0,
      totalComprasMes: totalCompras,
      totalPagamentosMes: totalPagamentos,
      faturaMes: totalCompras,
      faturaMesLabel: cartao.fechamentoFatura == null ? null : periodoLabel,
      dataUltimaConfirmacao: cartao.dataUltimaConfirmacao,
      fechamentoFatura: cartao.fechamentoFatura
    });
  }

  return resultados;
}

module.exports = { obterFaturas, calcularPeriodoFatura };
