// src/controllers/controladorTag.js
const Tag = require('../models/tag');

exports.obterTodasTags = async (req, res) => {
  try {
    // Filtra tags ativas do usuário autenticado
    const tags = await Tag.find({ 
      usuario: req.userId,
      ativo: true
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter tags.' });
  }
};

exports.obterTagPorId = async (req, res) => {
  try {
    const tag = await Tag.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });
    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter tag.' });
  }
};

exports.criarTag = async (req, res) => {
  const { nome, descricao, categoria, cor, icone } = req.body;
  if (!nome || !categoria) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: nome e categoria.' });
  }
  try {
    const novaTag = new Tag({ 
      nome, 
      descricao, 
      categoria,
      cor,
      icone,
      usuario: req.userId 
    });
    await novaTag.save();
    res.status(201).json(novaTag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar tag.', detalhe: error.message });
  }
};

exports.atualizarTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });

    // Atualiza apenas os campos fornecidos
    if (req.body.nome) tag.nome = req.body.nome;
    if (req.body.descricao !== undefined) tag.descricao = req.body.descricao;
    if (req.body.categoria) tag.categoria = req.body.categoria;
    if (req.body.cor) tag.cor = req.body.cor;
    if (req.body.icone) tag.icone = req.body.icone;

    await tag.save();
    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar tag.', detalhe: error.message });
  }
};

exports.excluirTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });
    
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });
    
    tag.ativo = false;
    await tag.save();
    
    res.json({ mensagem: 'Tag removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir tag.', detalhe: error.message });
  }
};
