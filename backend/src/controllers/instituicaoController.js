// src/controllers/instituicaoController.js
const Instituicao = require('../models/instituicao');

exports.listar = async (req, res) => {
  try {
    const instituicoes = await Instituicao.find({ usuario: req.userId, ativo: true })
      .sort({ nome: 1 })
      .lean();
    res.json(instituicoes);
  } catch (error) {
    console.error('Erro ao listar instituições:', error);
    res.status(500).json({ erro: 'Erro ao listar instituições.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const instituicao = await Instituicao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!instituicao) return res.status(404).json({ erro: 'Instituição não encontrada.' });
    res.json(instituicao);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter instituição.' });
  }
};

exports.criar = async (req, res) => {
  const { nome, tipo, cor, icone } = req.body;
  if (!nome || !tipo) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: nome e tipo.' });
  }
  const tiposValidos = ['banco_digital', 'banco_tradicional', 'carteira_digital', 'corretora'];
  if (!tiposValidos.includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo inválido.' });
  }
  try {
    const nova = new Instituicao({
      usuario: req.userId,
      nome,
      tipo,
      cor: cor || '#000000',
      icone: icone || 'default-icon',
      ativo: true
    });
    await nova.save();
    res.status(201).json(nova);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe uma instituição com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao criar instituição.', detalhe: error.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const instituicao = await Instituicao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!instituicao) return res.status(404).json({ erro: 'Instituição não encontrada.' });
    if (req.body.nome !== undefined) instituicao.nome = req.body.nome;
    if (req.body.tipo !== undefined) {
      const tiposValidos = ['banco_digital', 'banco_tradicional', 'carteira_digital', 'corretora'];
      if (!tiposValidos.includes(req.body.tipo)) {
        return res.status(400).json({ erro: 'Tipo inválido.' });
      }
      instituicao.tipo = req.body.tipo;
    }
    if (req.body.cor !== undefined) instituicao.cor = req.body.cor;
    if (req.body.icone !== undefined) instituicao.icone = req.body.icone;
    if (req.body.ativo !== undefined) instituicao.ativo = req.body.ativo;
    await instituicao.save();
    res.json(instituicao);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe uma instituição com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar instituição.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const instituicao = await Instituicao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!instituicao) return res.status(404).json({ erro: 'Instituição não encontrada.' });
    instituicao.ativo = false;
    await instituicao.save();
    res.json({ mensagem: 'Instituição removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir instituição.' });
  }
};
