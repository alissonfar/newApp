// src/controllers/controladorCategoria.js
const Categoria = require('../models/categoria');

exports.obterTodasCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.find();
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
    const novaCategoria = new Categoria({ nome, descricao });
    await novaCategoria.save();
    res.status(201).json(novaCategoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar categoria.', detalhe: error.message });
  }
};

exports.atualizarCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findById(req.params.id);
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
    const categoria = await Categoria.findByIdAndDelete(req.params.id);
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    res.json({ mensagem: 'Categoria removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir categoria.', detalhe: error.message });
  }
};
