// src/controllers/vinculoConjuntoController.js
const vinculoService = require('../services/vinculoService');

exports.listar = async (req, res) => {
  try {
    const vinculos = await vinculoService.listar(req.userId);
    const comSaldo = await Promise.all(
      vinculos.map(async (v) => {
        const saldo = await vinculoService.calcularSaldo(v._id, req.userId);
        return { ...v, saldo };
      })
    );
    res.json(comSaldo);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao listar:', error);
    res.status(500).json({ erro: 'Erro ao listar vínculos.' });
  }
};

exports.criar = async (req, res) => {
  try {
    const { nome, participante, descricao } = req.body;
    if (!nome || !participante) {
      return res.status(400).json({ erro: 'Nome e participante são obrigatórios.' });
    }
    const resultado = await vinculoService.criar({ nome, participante, descricao }, req.userId);
    res.status(201).json(resultado);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao criar:', error);
    res.status(400).json({ erro: error.message || 'Erro ao criar vínculo.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const resultado = await vinculoService.obterPorId(req.params.id, req.userId);
    if (!resultado) {
      return res.status(404).json({ erro: 'Vínculo não encontrado.' });
    }
    res.json(resultado);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao obter:', error);
    res.status(500).json({ erro: 'Erro ao obter vínculo.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const { nome, participante, descricao } = req.body;
    const resultado = await vinculoService.atualizar(
      req.params.id,
      { nome, participante, descricao },
      req.userId
    );
    if (!resultado) {
      return res.status(404).json({ erro: 'Vínculo não encontrado.' });
    }
    res.json(resultado);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao atualizar:', error);
    res.status(400).json({ erro: error.message || 'Erro ao atualizar vínculo.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const resultado = await vinculoService.softDelete(req.params.id, req.userId);
    if (!resultado) {
      return res.status(404).json({ erro: 'Vínculo não encontrado.' });
    }
    res.json({ mensagem: 'Vínculo excluído com sucesso.', vinculo: resultado });
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao excluir:', error);
    res.status(400).json({ erro: error.message || 'Erro ao excluir vínculo.' });
  }
};

exports.obterSaldo = async (req, res) => {
  try {
    const saldo = await vinculoService.calcularSaldo(req.params.id, req.userId);
    const vinculo = await vinculoService.obterPorId(req.params.id, req.userId);
    if (!vinculo) {
      return res.status(404).json({ erro: 'Vínculo não encontrado.' });
    }
    res.json({ saldo, vinculo: { _id: vinculo._id, nome: vinculo.nome, participante: vinculo.participante } });
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao obter saldo:', error);
    res.status(500).json({ erro: 'Erro ao obter saldo.' });
  }
};

exports.obterResumo = async (req, res) => {
  try {
    const dataInicio = req.query.dataInicio || null;
    const dataFim = req.query.dataFim || null;
    const resultado = await vinculoService.obterResumo(
      req.params.id,
      req.userId,
      dataInicio,
      dataFim
    );
    const vinculo = await vinculoService.obterPorId(req.params.id, req.userId);
    if (!vinculo) {
      return res.status(404).json({ erro: 'Vínculo não encontrado.' });
    }
    res.json({ ...resultado, vinculo: { _id: vinculo._id, nome: vinculo.nome, participante: vinculo.participante } });
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao obter resumo:', error);
    res.status(500).json({ erro: 'Erro ao obter resumo.' });
  }
};

exports.listarTransacoes = async (req, res) => {
  try {
    const filtros = {
      page: req.query.page,
      limit: req.query.limit,
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      pendente: req.query.pendente,
      euDevo: req.query.euDevo === 'true',
      outroDeve: req.query.outroDeve === 'true'
    };
    const resultado = await vinculoService.listarTransacoes(
      req.params.id,
      req.userId,
      filtros
    );
    res.json(resultado);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao listar transações:', error);
    res.status(500).json({ erro: 'Erro ao listar transações.' });
  }
};

exports.listarAcertos = async (req, res) => {
  try {
    const acertos = await vinculoService.listarAcertos(req.params.id, req.userId);
    res.json(acertos);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao listar acertos:', error);
    res.status(500).json({ erro: 'Erro ao listar acertos.' });
  }
};

exports.obterExtrato = async (req, res) => {
  try {
    const filtros = {
      dataInicio: req.query.dataInicio,
      dataFim: req.query.dataFim,
      limit: req.query.limit,
      page: req.query.page
    };
    const resultado = await vinculoService.obterExtrato(req.params.id, req.userId, filtros);
    res.json(resultado);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao obter extrato:', error);
    res.status(500).json({ erro: 'Erro ao obter extrato.' });
  }
};

exports.registrarAcerto = async (req, res) => {
  try {
    const { valor, direcao, data, observacao, tipo, ladoAfetado } = req.body;
    if (!valor || !direcao || !data) {
      return res.status(400).json({ erro: 'Valor, direção e data são obrigatórios.' });
    }
    const resultado = await vinculoService.registrarAcerto(
      req.params.id,
      { valor, direcao, data, observacao, tipo, ladoAfetado },
      req.userId
    );
    res.status(201).json(resultado);
  } catch (error) {
    console.error('[VinculoConjunto] Erro ao registrar acerto:', error);
    res.status(400).json({ erro: error.message || 'Erro ao registrar acerto.' });
  }
};
