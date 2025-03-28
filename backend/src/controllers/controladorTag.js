// src/controllers/controladorTag.js
const Tag = require('../models/tag');
const Categoria = require('../models/categoria');

// Função de migração para converter nomes de categoria para IDs
async function migrarTagsParaIds(req) {
  try {
    const tags = await Tag.find({ usuario: req.userId });
    for (const tag of tags) {
      if (typeof tag.categoria === 'string') {
        // Procura a categoria pelo nome
        const categoria = await Categoria.findOne({ 
          nome: tag.categoria,
          usuario: req.userId
        });
        if (categoria) {
          tag.categoria = categoria._id;
          await tag.save();
        }
      }
    }
    console.log('Migração de tags concluída com sucesso');
  } catch (error) {
    console.error('Erro na migração de tags:', error);
  }
}

exports.obterTodasTags = async (req, res) => {
  try {
    // Executa a migração antes de retornar as tags
    await migrarTagsParaIds(req);

    // Filtra tags ativas do usuário autenticado e popula a categoria
    const tags = await Tag.find({ 
      usuario: req.userId,
      ativo: true
    }).populate('categoria', 'nome cor icone');
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
    }).populate('categoria', 'nome cor icone');
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
    // Verifica se a categoria existe e pertence ao usuário
    const categoriaExistente = await Categoria.findOne({
      $or: [
        { _id: categoria },
        { codigo: categoria }
      ],
      usuario: req.userId,
      ativo: true
    });

    if (!categoriaExistente) {
      return res.status(404).json({ erro: 'Categoria não encontrada.' });
    }

    const novaTag = new Tag({ 
      nome, 
      descricao, 
      categoria: categoriaExistente._id, // Usa o ID da categoria
      cor,
      icone,
      usuario: req.userId 
    });
    await novaTag.save();
    
    // Popula a categoria antes de retornar
    await novaTag.populate('categoria', 'nome cor icone');
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

    // Se estiver atualizando a categoria, verifica se ela existe
    if (req.body.categoria) {
      const categoriaExistente = await Categoria.findOne({
        $or: [
          { _id: req.body.categoria },
          { codigo: req.body.categoria }
        ],
        usuario: req.userId,
        ativo: true
      });

      if (!categoriaExistente) {
        return res.status(404).json({ erro: 'Categoria não encontrada.' });
      }
      tag.categoria = categoriaExistente._id; // Usa o ID da categoria
    }

    // Atualiza os outros campos
    if (req.body.nome) tag.nome = req.body.nome;
    if (req.body.descricao !== undefined) tag.descricao = req.body.descricao;
    if (req.body.cor) tag.cor = req.body.cor;
    if (req.body.icone) tag.icone = req.body.icone;

    await tag.save();
    
    // Popula a categoria antes de retornar
    await tag.populate('categoria', 'nome cor icone');
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
