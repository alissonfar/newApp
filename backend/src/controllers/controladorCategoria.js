// src/controllers/controladorCategoria.js
const Categoria = require('../models/categoria');

exports.obterTodasCategorias = async (req, res) => {
  try {
    // Retorna somente as categorias ativas do usuário autenticado
    const categorias = await Categoria.find({ 
      usuario: req.userId,
      ativo: true 
    });
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter categorias.' });
  }
};

exports.obterCategoriaPorId = async (req, res) => {
  try {
    // Busca a categoria pertencente ao usuário autenticado
    const categoria = await Categoria.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    res.json(categoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter categoria.', detalhe: error.message });
  }
};

exports.criarCategoria = async (req, res) => {
  const { nome, descricao, cor, icone } = req.body;
  if (!nome) {
    return res.status(400).json({ erro: 'O campo nome é obrigatório para categoria.' });
  }
  try {
    // Associa a categoria ao usuário logado
    const novaCategoria = new Categoria({
      nome,
      descricao,
      cor,
      icone,
      usuario: req.userId
    });
    await novaCategoria.save();
    res.status(201).json(novaCategoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar categoria.', detalhe: error.message });
  }
};

exports.atualizarCategoria = async (req, res) => {
  try {
    // Busca a categoria pertencente ao usuário autenticado
    const categoria = await Categoria.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });

    // Atualiza apenas os campos fornecidos
    if (req.body.nome) categoria.nome = req.body.nome;
    if (req.body.descricao !== undefined) categoria.descricao = req.body.descricao;
    if (req.body.cor) categoria.cor = req.body.cor;
    if (req.body.icone) categoria.icone = req.body.icone;

    await categoria.save();
    res.json(categoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar categoria.', detalhe: error.message });
  }
};

exports.excluirCategoria = async (req, res) => {
  try {
    // Realiza soft delete da categoria
    const categoria = await Categoria.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });
    
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    
    categoria.ativo = false;
    await categoria.save();
    
    res.json({ mensagem: 'Categoria removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir categoria.', detalhe: error.message });
  }
};
