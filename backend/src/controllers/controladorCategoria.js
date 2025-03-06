// src/controllers/controladorCategoria.js
const Categoria = require('../models/categoria');

exports.obterTodasCategorias = async (req, res) => {
  try {
    // Retorna somente as categorias do usuário autenticado
    const categorias = await Categoria.find({ usuario: req.userId });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter categorias.' });
  }
};

exports.criarCategoria = async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) {
    return res.status(400).json({ erro: 'O campo nome é obrigatório para categoria.' });
  }
  try {
    // Associa a categoria ao usuário logado
    const novaCategoria = new Categoria({ nome, descricao, usuario: req.userId });
    await novaCategoria.save();
    res.status(201).json(novaCategoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar categoria.', detalhe: error.message });
  }
};

exports.atualizarCategoria = async (req, res) => {
  try {
    // Busca a categoria pertencente ao usuário autenticado
    const categoria = await Categoria.findOne({ _id: req.params.id, usuario: req.userId });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    categoria.nome = req.body.nome || categoria.nome;
    categoria.descricao = req.body.descricao || categoria.descricao;
    await categoria.save();
    res.json(categoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar categoria.', detalhe: error.message });
  }
};

exports.excluirCategoria = async (req, res) => {
  try {
    // Exclui somente se pertencer ao usuário
    const categoria = await Categoria.findOneAndDelete({ _id: req.params.id, usuario: req.userId });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    res.json({ mensagem: 'Categoria removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir categoria.', detalhe: error.message });
  }
};


exports.obterCategoriaPorId = async (req, res) => {
  try {
    // Busca a categoria pertencente ao usuário autenticado
    const categoria = await Categoria.findOne({ _id: req.params.id, usuario: req.userId });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    res.json(categoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter categoria.', detalhe: error.message });
  }
};