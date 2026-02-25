// src/controllers/settlementController.js
const settlementService = require('../services/settlementService');

exports.criar = async (req, res) => {
  try {
    const { receivingTransactionId, appliedTransactionIds, tagId } = req.body;
    const resultado = await settlementService.criar(
      { receivingTransactionId, appliedTransactionIds, tagId },
      req.userId
    );
    res.status(201).json(resultado);
  } catch (error) {
    console.error('[Settlement] Erro ao criar:', error);
    res.status(400).json({ erro: error.message || 'Erro ao criar conciliação.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const resultado = await settlementService.excluir(req.params.id, req.userId);
    res.json(resultado);
  } catch (error) {
    console.error('[Settlement] Erro ao excluir:', error);
    res.status(400).json({ erro: error.message || 'Erro ao excluir conciliação.' });
  }
};

exports.listar = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const resultado = await settlementService.listar(req.userId, { page, limit });
    res.json(resultado);
  } catch (error) {
    console.error('[Settlement] Erro ao listar:', error);
    res.status(500).json({ erro: 'Erro ao listar conciliações.' });
  }
};

exports.listarRecebimentosDisponiveis = async (req, res) => {
  try {
    const filtros = {};
    if (req.query.dataInicio) filtros.dataInicio = req.query.dataInicio;
    if (req.query.dataFim) filtros.dataFim = req.query.dataFim;
    const transacoes = await settlementService.listarRecebimentosDisponiveis(req.userId, filtros);
    res.json({ transacoes });
  } catch (error) {
    console.error('[Settlement] Erro ao listar recebimentos disponíveis:', error);
    res.status(500).json({ erro: 'Erro ao listar recebimentos disponíveis.' });
  }
};

exports.listarPendentes = async (req, res) => {
  try {
    const filtros = {};
    if (req.query.pessoa) filtros.pessoa = req.query.pessoa;
    if (req.query.pessoas) {
      filtros.pessoas = Array.isArray(req.query.pessoas) ? req.query.pessoas : [req.query.pessoas];
    }
    if (req.query.dataInicio) filtros.dataInicio = req.query.dataInicio;
    if (req.query.dataFim) filtros.dataFim = req.query.dataFim;
    if (req.query.excludeTransactionId) filtros.excludeTransactionId = req.query.excludeTransactionId;
    const transacoes = await settlementService.listarPendentes(req.userId, filtros);
    res.json({ transacoes });
  } catch (error) {
    console.error('[Settlement] Erro ao listar pendentes:', error);
    res.status(500).json({ erro: 'Erro ao listar transações pendentes.' });
  }
};
