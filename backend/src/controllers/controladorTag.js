// src/controllers/controladorTag.js
const Tag = require('../models/tag');

exports.obterTodasTags = async (req, res) => {
  try {
    const tags = await Tag.find();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter tags.' });
  }
};

exports.obterTagPorId = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });
    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter tag.' });
  }
};

exports.criarTag = async (req, res) => {
  const { nome, descricao, categoria } = req.body;
  if (!nome || !categoria) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: nome e categoria.' });
  }
  try {
    const novaTag = new Tag({ nome, descricao, categoria });
    await novaTag.save();
    res.status(201).json(novaTag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar tag.', detalhe: error.message });
  }
};

exports.atualizarTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });
    tag.nome = req.body.nome || tag.nome;
    tag.descricao = req.body.descricao || tag.descricao;
    tag.categoria = req.body.categoria || tag.categoria;
    await tag.save();
    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar tag.', detalhe: error.message });
  }
};

exports.excluirTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });
    res.json({ mensagem: 'Tag removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir tag.', detalhe: error.message });
  }
};
