// src/controllers/controladorModeloRelatorio.js
const ModeloRelatorio = require('../models/modeloRelatorio');

exports.listar = async (req, res) => {
  try {
    const modelos = await ModeloRelatorio.find({ usuario: req.userId, ativo: true })
      .sort({ nome: 1 })
      .populate('regras.tag', 'nome codigo categoria cor');
    res.json(modelos);
  } catch (error) {
    console.error('Erro ao listar modelos de relatório:', error);
    res.status(500).json({ erro: 'Erro ao listar modelos de relatório.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const modelo = await ModeloRelatorio.findOne({
      _id: req.params.id,
      usuario: req.userId
    }).populate('regras.tag', 'nome codigo categoria cor');
    if (!modelo) {
      return res.status(404).json({ erro: 'Modelo de relatório não encontrado.' });
    }
    res.json(modelo);
  } catch (error) {
    console.error('Erro ao obter modelo:', error);
    res.status(500).json({ erro: 'Erro ao obter modelo de relatório.' });
  }
};

exports.criar = async (req, res) => {
  try {
    const { nome, descricao, aggregation, regras } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'Nome é obrigatório.' });
    }
    const modelo = new ModeloRelatorio({
      nome: nome.trim(),
      descricao: (descricao || '').trim(),
      aggregation: ['default', 'devedor'].includes(aggregation) ? aggregation : 'default',
      regras: Array.isArray(regras) ? regras.filter(r => r.tag && r.effect) : [],
      usuario: req.userId
    });
    await modelo.save();
    const populated = await ModeloRelatorio.findOne({ _id: modelo._id, usuario: req.userId })
      .populate('regras.tag', 'nome codigo categoria cor');
    res.status(201).json(populated);
  } catch (error) {
    console.error('Erro ao criar modelo:', error);
    res.status(500).json({ erro: 'Erro ao criar modelo de relatório.', detalhe: error.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const modelo = await ModeloRelatorio.findOne({
      _id: req.params.id,
      usuario: req.userId
    });
    if (!modelo) {
      return res.status(404).json({ erro: 'Modelo de relatório não encontrado.' });
    }
    const { nome, descricao, aggregation, regras } = req.body;
    if (nome !== undefined) modelo.nome = nome.trim();
    if (descricao !== undefined) modelo.descricao = descricao.trim();
    if (aggregation && ['default', 'devedor'].includes(aggregation)) modelo.aggregation = aggregation;
    if (Array.isArray(regras)) modelo.regras = regras.filter(r => r.tag && r.effect);
    await modelo.save();
    const populated = await ModeloRelatorio.findOne({ _id: modelo._id, usuario: req.userId })
      .populate('regras.tag', 'nome codigo categoria cor');
    res.json(populated);
  } catch (error) {
    console.error('Erro ao atualizar modelo:', error);
    res.status(500).json({ erro: 'Erro ao atualizar modelo de relatório.', detalhe: error.message });
  }
};

exports.excluir = async (req, res) => {
  try {
    const modelo = await ModeloRelatorio.findOne({
      _id: req.params.id,
      usuario: req.userId
    });
    if (!modelo) {
      return res.status(404).json({ erro: 'Modelo de relatório não encontrado.' });
    }
    modelo.ativo = false;
    await modelo.save();
    res.json({ mensagem: 'Modelo excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir modelo:', error);
    res.status(500).json({ erro: 'Erro ao excluir modelo de relatório.' });
  }
};
