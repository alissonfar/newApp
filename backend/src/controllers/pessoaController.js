// src/controllers/pessoaController.js
const Pessoa = require('../models/pessoa');
const Emprestimo = require('../models/emprestimo');

exports.listar = async (req, res) => {
  try {
    const incluirInativos = req.query.incluirInativos === 'true';
    const filtro = { usuario: req.userId };
    if (!incluirInativos) filtro.ativo = true;
    const pessoas = await Pessoa.find(filtro).sort({ nome: 1 }).lean();
    res.json(pessoas);
  } catch (error) {
    console.error('Erro ao listar pessoas:', error);
    res.status(500).json({ erro: 'Erro ao listar pessoas.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const pessoa = await Pessoa.findOne({ _id: req.params.id, usuario: req.userId });
    if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada.' });
    res.json(pessoa);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter pessoa.' });
  }
};

exports.criar = async (req, res) => {
  const { nome, contato, observacoes } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome é obrigatório.' });
  }
  try {
    const nova = new Pessoa({
      usuario: req.userId,
      nome: nome.trim(),
      contato: contato || null,
      observacoes: observacoes || null,
      ativo: true
    });
    await nova.save();
    res.status(201).json(nova);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe uma pessoa com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao criar pessoa.', detalhe: error.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const pessoa = await Pessoa.findOne({ _id: req.params.id, usuario: req.userId });
    if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada.' });
    if (req.body.nome !== undefined) {
      if (!req.body.nome || !req.body.nome.trim()) {
        return res.status(400).json({ erro: 'O nome não pode ser vazio.' });
      }
      pessoa.nome = req.body.nome.trim();
    }
    if (req.body.contato !== undefined) pessoa.contato = req.body.contato || null;
    if (req.body.observacoes !== undefined) pessoa.observacoes = req.body.observacoes || null;
    if (req.body.ativo !== undefined) pessoa.ativo = !!req.body.ativo;
    await pessoa.save();
    res.json(pessoa);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe uma pessoa com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar pessoa.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const pessoa = await Pessoa.findOne({ _id: req.params.id, usuario: req.userId });
    if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada.' });

    const emprestimosVinculados = await Emprestimo.countDocuments({
      pessoaId: pessoa._id,
      usuario: req.userId,
      status: { $in: ['ativo'] }
    });
    if (emprestimosVinculados > 0) {
      return res.status(400).json({
        erro: 'Pessoa possui empréstimos ativos. Cancele-os antes de excluir.'
      });
    }

    pessoa.ativo = false;
    await pessoa.save();
    res.json({ mensagem: 'Pessoa removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir pessoa.' });
  }
};
