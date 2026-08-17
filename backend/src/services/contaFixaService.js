// backend/src/services/contaFixaService.js
const ContaFixa = require('../models/contaFixa');
const Transacao = require('../models/transacao');
const { validarSomaPagamentos } = require('./transacaoService');

function ultimoDiaDoMes(ano, mesIndexZeroBased) {
  return new Date(ano, mesIndexZeroBased + 1, 0).getDate();
}

function calcularDataDoDia(ano, mesIndexZeroBased, dia) {
  const ultimoDia = ultimoDiaDoMes(ano, mesIndexZeroBased);
  const diaAjustado = Math.min(dia, ultimoDia);
  return new Date(ano, mesIndexZeroBased, diaAjustado);
}

function calcularCiclo(contaFixa, dataReferencia = new Date()) {
  const anoLancamento = dataReferencia.getFullYear();
  const mesLancamento = dataReferencia.getMonth();

  const dataLancamento = calcularDataDoDia(anoLancamento, mesLancamento, contaFixa.diaLancamento);

  let anoVencimento = anoLancamento;
  let mesVencimento = mesLancamento;
  if (contaFixa.vencimentoMesSeguinte) {
    mesVencimento += 1;
    if (mesVencimento > 11) {
      mesVencimento = 0;
      anoVencimento += 1;
    }
  }
  const dataVencimento = calcularDataDoDia(anoVencimento, mesVencimento, contaFixa.diaVencimento);

  return { mesLancamento, anoLancamento, dataLancamento, dataVencimento };
}

function cicloJaProcessado(contaFixa, ciclo) {
  const ultimo = contaFixa.ultimoCicloProcessado;
  if (!ultimo || ultimo.mes == null || ultimo.ano == null) return false;
  return ultimo.mes === ciclo.mesLancamento && ultimo.ano === ciclo.anoLancamento;
}

function verificarEEncerrar(contaFixa, dataReferencia = new Date()) {
  if (contaFixa.status !== 'ativa') return false;

  const passouDataFim = contaFixa.dataFim && dataReferencia > contaFixa.dataFim;
  const atingiuRepeticoes = contaFixa.totalRepeticoes != null && contaFixa.totalGerados >= contaFixa.totalRepeticoes;

  if (passouDataFim || atingiuRepeticoes) {
    contaFixa.status = 'encerrada';
    return true;
  }
  return false;
}

function copiarPagamentos(pagamentosTemplate) {
  return pagamentosTemplate.map((p) => ({
    pessoa: p.pessoa,
    valor: p.valor,
    tags: p.tags || {}
  }));
}

async function gerarTransacaoParaCiclo(contaFixa, ciclo) {
  const pagamentos = copiarPagamentos(contaFixa.pagamentosTemplate);

  const transacao = new Transacao({
    tipo: contaFixa.tipo,
    descricao: contaFixa.nome,
    valor: contaFixa.valorEsperado,
    data: ciclo.dataVencimento,
    usuario: contaFixa.usuario,
    pagamentos,
    contaFixaId: contaFixa._id
  });
  await transacao.save();

  contaFixa.ultimoCicloProcessado = { mes: ciclo.mesLancamento, ano: ciclo.anoLancamento };
  contaFixa.totalGerados += 1;
  verificarEEncerrar(contaFixa);
  await contaFixa.save();

  return transacao;
}

async function processarContasFixasAutomaticas() {
  const contasFixas = await ContaFixa.find({ status: 'ativa', modo: 'automatico' });
  const hoje = new Date();
  let processadas = 0;
  const erros = [];

  for (const contaFixa of contasFixas) {
    try {
      const ciclo = calcularCiclo(contaFixa, hoje);
      if (hoje >= ciclo.dataLancamento && !cicloJaProcessado(contaFixa, ciclo)) {
        await gerarTransacaoParaCiclo(contaFixa, ciclo);
        processadas += 1;
      }
    } catch (err) {
      erros.push({ contaFixaId: contaFixa._id, mensagem: err.message });
    }
  }

  return { processadas, erros };
}

async function listarPendencias(usuarioId, dataReferencia = new Date()) {
  const contasFixas = await ContaFixa.find({ usuario: usuarioId, status: 'ativa', modo: 'confirmacao' });
  const pendencias = [];

  for (const contaFixa of contasFixas) {
    const ciclo = calcularCiclo(contaFixa, dataReferencia);
    if (dataReferencia >= ciclo.dataLancamento && !cicloJaProcessado(contaFixa, ciclo)) {
      pendencias.push({ contaFixa, ciclo });
    }
  }

  return pendencias;
}

async function confirmarPendencia(contaFixaId, usuarioId, dadosConfirmados = {}) {
  if (!dadosConfirmados.pagamentos || dadosConfirmados.pagamentos.length === 0) {
    throw new Error('Pagamentos são obrigatórios para confirmar o lançamento.');
  }

  const contaFixa = await ContaFixa.findOne({ _id: contaFixaId, usuario: usuarioId });
  if (!contaFixa) throw new Error('Conta fixa não encontrada.');

  const ciclo = calcularCiclo(contaFixa);
  if (cicloJaProcessado(contaFixa, ciclo)) {
    throw new Error('Este ciclo já foi processado.');
  }

  const valorFinal = dadosConfirmados.valor != null ? dadosConfirmados.valor : contaFixa.valorEsperado;
  const dataFinal = dadosConfirmados.data ? new Date(dadosConfirmados.data) : ciclo.dataVencimento;

  validarSomaPagamentos({ valor: valorFinal }, dadosConfirmados.pagamentos);

  const transacao = new Transacao({
    tipo: contaFixa.tipo,
    descricao: contaFixa.nome,
    valor: valorFinal,
    data: dataFinal,
    usuario: contaFixa.usuario,
    pagamentos: dadosConfirmados.pagamentos,
    contaFixaId: contaFixa._id
  });
  await transacao.save();

  contaFixa.ultimoCicloProcessado = { mes: ciclo.mesLancamento, ano: ciclo.anoLancamento };
  contaFixa.totalGerados += 1;
  verificarEEncerrar(contaFixa);
  await contaFixa.save();

  return transacao;
}

async function pularCiclo(contaFixaId, usuarioId, dataReferencia = new Date()) {
  const contaFixa = await ContaFixa.findOne({ _id: contaFixaId, usuario: usuarioId });
  if (!contaFixa) throw new Error('Conta fixa não encontrada.');

  const ciclo = calcularCiclo(contaFixa, dataReferencia);
  if (cicloJaProcessado(contaFixa, ciclo)) {
    throw new Error('Este ciclo já foi processado.');
  }

  contaFixa.ciclosPulados.push({ mes: ciclo.mesLancamento, ano: ciclo.anoLancamento });
  contaFixa.ultimoCicloProcessado = { mes: ciclo.mesLancamento, ano: ciclo.anoLancamento };
  await contaFixa.save();

  return contaFixa;
}

module.exports = {
  calcularCiclo,
  cicloJaProcessado,
  verificarEEncerrar,
  gerarTransacaoParaCiclo,
  processarContasFixasAutomaticas,
  listarPendencias,
  confirmarPendencia,
  pularCiclo
};
