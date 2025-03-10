// src/controllers/controladorTransacao.js
const Transacao = require('../models/transacao');
const Usuario = require('../models/usuarios');

exports.obterTodasTransacoes = async (req, res) => {
  try {
    // Filtros básicos
    const filtros = { status: 'ativo', usuario: req.userId };
    
    // Verifica se há um proprietário na query
    if (req.query.proprietario) {
      // Adiciona o filtro de proprietário nos pagamentos usando expressão regular para ignorar case
      filtros['pagamentos.pessoa'] = new RegExp('^' + req.query.proprietario + '$', 'i');
    }
    
    // Retorna apenas transações ativas do usuário autenticado com os filtros aplicados
    const transacoes = await Transacao.find(filtros);
    res.json({ transacoes });
  } catch (error) {
    console.error('Erro ao obter transações:', error);
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
  const { tipo, descricao, valor, data, pagamentos, observacao } = req.body;
  if (!tipo || !descricao || !valor || !data || !pagamentos) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: tipo, descricao, valor, data e pagamentos.' });
  }
  try {
    // Cria transação vinculada ao usuário autenticado
    const novaTransacao = new Transacao({
      tipo,
      descricao,
      valor,
      data,
      pagamentos,
      observacao,
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
    // Atualiza os campos conforme enviados
    transacao.tipo = req.body.tipo || transacao.tipo;
    transacao.descricao = req.body.descricao || transacao.descricao;
    transacao.valor = req.body.valor || transacao.valor;
    transacao.data = req.body.data || transacao.data;
    transacao.pagamentos = req.body.pagamentos || transacao.pagamentos;
    transacao.observacao = req.body.observacao !== undefined ? req.body.observacao : transacao.observacao;
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
