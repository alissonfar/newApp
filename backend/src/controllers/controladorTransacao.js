// src/controllers/controladorTransacao.js
const Transacao = require('../models/transacao');

exports.obterTodasTransacoes = async (req, res) => {
  try {
    // Retorna apenas transações ativas do usuário autenticado
    const transacoes = await Transacao.find({ status: 'ativo', usuario: req.userId });
    res.json({ transacoes });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter transações.' });
  }
};

exports.obterTransacaoPorId = async (req, res) => {
  try {
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada.' });
    res.json(transacao);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter transação.' });
  }
};

exports.criarTransacao = async (req, res) => {
  const { tipo, descricao, valor, data, tags, pagamentos } = req.body;
  if (!tipo || !descricao || !valor || !data || !tags || !pagamentos) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: tipo, descricao, valor, data, tags e pagamentos.' });
  }
  try {
    // Cria transação vinculada ao usuário autenticado
    const novaTransacao = new Transacao({
      tipo,
      descricao,
      valor,
      data,
      tags,
      pagamentos,
      usuario: req.userId
    });
    await novaTransacao.save();
    res.status(201).json(novaTransacao);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar transação.', detalhe: error.message });
  }
};

exports.atualizarTransacao = async (req, res) => {
  try {
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada.' });
    // Atualiza os campos
    transacao.tipo = req.body.tipo || transacao.tipo;
    transacao.descricao = req.body.descricao || transacao.descricao;
    transacao.valor = req.body.valor || transacao.valor;
    transacao.data = req.body.data || transacao.data;
    transacao.tags = req.body.tags || transacao.tags;
    transacao.pagamentos = req.body.pagamentos || transacao.pagamentos;
    await transacao.save();
    res.json(transacao);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar transação.', detalhe: error.message });
  }
};

exports.excluirTransacao = async (req, res) => {
  try {
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada.' });
    transacao.status = 'estornado';
    await transacao.save();
    res.json({ mensagem: 'Transação estornada com sucesso.', transacao });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir transação.', detalhe: error.message });
  }
};
