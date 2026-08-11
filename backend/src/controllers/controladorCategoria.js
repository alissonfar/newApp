// src/controllers/controladorCategoria.js
const Categoria = require('../models/categoria');
const Tag = require('../models/tag');
const { categoriaEstaVinculada } = require('../services/vinculoTagCategoriaService');

exports.obterTodasCategorias = async (req, res) => {
  try {
    // Opções de paginação: buscar todos os resultados por enquanto (limite alto)
    const options = {
      page: 1,
      limit: 10000, // Limite alto para buscar todos
      sort: { nome: 1 } // Opcional: ordenar por nome
    };
    
    // Filtro: categorias do usuário autenticado
    // Inclui inativas apenas quando incluirInativas=true (ex: TagManagement, exibição histórico)
    const incluirInativas = req.query.incluirInativas === 'true';
    const query = {
      usuario: req.userId,
      ...(incluirInativas ? {} : { ativo: true })
    };

    // Usa paginate em vez de find
    const resultadoPaginado = await Categoria.paginate(query, options);
    
    // Retorna apenas o array de documentos para manter compatibilidade com frontend
    res.json(resultadoPaginado.docs);
    
  } catch (error) {
    console.error("Erro ao obter categorias com paginação:", error); // Melhor log de erro
    res.status(500).json({ erro: 'Erro ao obter categorias.', detalhe: error.message });
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
  const { nome, descricao, cor, icone, mostrarNoLancamento } = req.body;
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
      mostrarNoLancamento: mostrarNoLancamento !== false,
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
    // Busca a categoria (ativa ou inativa) pertencente ao usuário autenticado
    const categoria = await Categoria.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId
    });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });

    // Atualiza apenas os campos fornecidos
    if (req.body.nome) categoria.nome = req.body.nome;
    if (req.body.descricao !== undefined) categoria.descricao = req.body.descricao;
    if (req.body.cor) categoria.cor = req.body.cor;
    if (req.body.icone) categoria.icone = req.body.icone;
    if (req.body.mostrarNoLancamento !== undefined) categoria.mostrarNoLancamento = req.body.mostrarNoLancamento === true;

    await categoria.save();
    res.json(categoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar categoria.', detalhe: error.message });
  }
};

exports.excluirCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findOne({
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });

    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });

    const vinculada = await categoriaEstaVinculada(categoria._id, req.userId);

    if (vinculada) {
      categoria.ativo = false;
      await categoria.save();
      await Tag.updateMany(
        { categoria: String(categoria._id), usuario: req.userId, ativo: true },
        { ativo: false }
      );
      return res.json({ mensagem: 'Categoria possui tags ou transações vinculadas — foi inativada em vez de excluída.', inativada: true });
    }

    await Categoria.deleteOne({ _id: categoria._id });
    res.json({ mensagem: 'Categoria excluída com sucesso.', inativada: false });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir categoria.', detalhe: error.message });
  }
};

exports.ativarCategoria = async (req, res) => {
  try {
    // Busca categoria (ativa ou inativa) pertencente ao usuário
    const categoria = await Categoria.findOne({ 
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId
    });
    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });

    categoria.ativo = true;
    await categoria.save();

    // Cascata simétrica: reativa as tags desta categoria que estavam inativas
    // (inclui as que foram inativadas junto da categoria e quaisquer outras).
    const { modifiedCount } = await Tag.updateMany(
      { categoria: String(categoria._id), usuario: req.userId, ativo: false },
      { ativo: true }
    );

    res.json({ ...categoria.toObject({ virtuals: true }), tagsAtivadas: modifiedCount });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao ativar categoria.', detalhe: error.message });
  }
};

exports.inativarCategoria = async (req, res) => {
  try {
    // Busca categoria ativa pertencente ao usuário
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

    // Cascata: inativa todas as tags ativas desta categoria (evita tag
    // "ativa" presa embaixo de categoria inativa).
    const { modifiedCount } = await Tag.updateMany(
      { categoria: String(categoria._id), usuario: req.userId, ativo: true },
      { ativo: false }
    );

    res.json({ ...categoria.toObject({ virtuals: true }), tagsInativadas: modifiedCount });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao inativar categoria.', detalhe: error.message });
  }
};
