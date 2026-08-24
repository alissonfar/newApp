// backend/src/controllers/contaFixaController.js
const ContaFixa = require('../models/contaFixa');
const contaFixaService = require('../services/contaFixaService');
const { validarSomaPagamentos } = require('../services/transacaoService');

exports.criar = async (req, res) => {
  const {
    nome, tipo, valorEsperado, diaLancamento, diaVencimento, vencimentoMesSeguinte,
    modo, pagamentosTemplate, dataInicio, dataFim, totalRepeticoes
  } = req.body;

  if (!nome || !tipo || !valorEsperado || !diaLancamento || !diaVencimento || !modo || !pagamentosTemplate || pagamentosTemplate.length === 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios: nome, tipo, valorEsperado, diaLancamento, diaVencimento, modo, pagamentosTemplate.' });
  }

  try {
    validarSomaPagamentos({ valor: valorEsperado }, pagamentosTemplate);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }

  try {
    const contaFixa = new ContaFixa({
      usuario: req.userId,
      nome,
      tipo,
      valorEsperado,
      diaLancamento,
      diaVencimento,
      vencimentoMesSeguinte: !!vencimentoMesSeguinte,
      modo,
      pagamentosTemplate,
      dataInicio: dataInicio || new Date(),
      dataFim: dataFim || null,
      totalRepeticoes: totalRepeticoes || null
    });
    await contaFixa.save();
    res.status(201).json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar conta fixa.', detalhe: error.message });
  }
};

exports.listar = async (req, res) => {
  try {
    const contasFixas = await ContaFixa.find({ usuario: req.userId }).sort({ nome: 1 });
    res.json(contasFixas);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar contas fixas.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOne({ _id: req.params.id, usuario: req.userId });
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter conta fixa.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOne({ _id: req.params.id, usuario: req.userId });
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });

    const camposPermitidos = [
      'nome', 'tipo', 'valorEsperado', 'diaLancamento', 'diaVencimento',
      'vencimentoMesSeguinte', 'modo', 'pagamentosTemplate',
      'dataInicio', 'dataFim', 'totalRepeticoes'
    ];
    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) contaFixa[campo] = req.body[campo];
    });

    try {
      validarSomaPagamentos({ valor: contaFixa.valorEsperado }, contaFixa.pagamentosTemplate);
    } catch (err) {
      return res.status(400).json({ erro: err.message });
    }

    await contaFixa.save();
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar conta fixa.', detalhe: error.message });
  }
};

exports.pausar = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOneAndUpdate(
      { _id: req.params.id, usuario: req.userId },
      { status: 'pausada' },
      { new: true }
    );
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao pausar conta fixa.' });
  }
};

exports.reativar = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOneAndUpdate(
      { _id: req.params.id, usuario: req.userId, status: 'pausada' },
      { status: 'ativa' },
      { new: true }
    );
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada ou não está pausada.' });
    res.json(contaFixa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao reativar conta fixa.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const contaFixa = await ContaFixa.findOneAndDelete({ _id: req.params.id, usuario: req.userId });
    if (!contaFixa) return res.status(404).json({ erro: 'Conta fixa não encontrada.' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir conta fixa.' });
  }
};

exports.listarPendencias = async (req, res) => {
  try {
    const pendencias = await contaFixaService.listarPendencias(req.userId);
    res.json(pendencias);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao listar pendências.', detalhe: error.message });
  }
};

exports.confirmar = async (req, res) => {
  try {
    const transacao = await contaFixaService.confirmarPendencia(req.params.id, req.userId, req.body);
    res.status(201).json(transacao);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
};

exports.pular = async (req, res) => {
  try {
    const contaFixa = await contaFixaService.pularCiclo(req.params.id, req.userId);
    res.json(contaFixa);
  } catch (error) {
    res.status(400).json({ erro: error.message });
  }
};
