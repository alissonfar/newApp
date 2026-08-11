// src/controllers/controladorTag.js
const Tag = require('../models/tag');
const Categoria = require('../models/categoria');
const { tagEstaVinculada } = require('../services/vinculoTagCategoriaService');

exports.obterTodasTags = async (req, res) => {
  try {
    // Opções de paginação: buscar todos os resultados por enquanto (limite alto)
    const options = {
      page: 1,
      limit: 10000, // Limite alto para buscar todos
      sort: { nome: 1 } // Opcional: ordenar por nome
    };

    // Filtro: usuário autenticado. Inclui inativas apenas quando incluirInativas=true
    // (mesmo padrão de obterTodasCategorias).
    const incluirInativas = req.query.incluirInativas === 'true';
    const query = {
      usuario: req.userId,
      ...(incluirInativas ? {} : { ativo: true })
    };

    // Usa paginate em vez de find
    const resultadoPaginado = await Tag.paginate(query, options);

    // Retorna apenas o array de documentos para manter compatibilidade com frontend
    res.json(resultadoPaginado.docs);

  } catch (error) {
    console.error("Erro ao obter tags com paginação:", error); // Melhor log de erro
    res.status(500).json({ erro: 'Erro ao obter tags.', detalhe: error.message });
  }
};

exports.obterTagPorId = async (req, res) => {
  try {
    const tag = await Tag.findOne({
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });
    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter tag.' });
  }
};

exports.criarTag = async (req, res) => {
  const { nome, descricao, categoria, cor, icone, mostrarNoDashboard } = req.body;
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
      mostrarNoDashboard: mostrarNoDashboard === true,
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
      usuario: req.userId
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });

    // Atualiza apenas os campos fornecidos
    if (req.body.nome) tag.nome = req.body.nome;
    if (req.body.descricao !== undefined) tag.descricao = req.body.descricao;
    if (req.body.categoria) tag.categoria = req.body.categoria;
    if (req.body.cor) tag.cor = req.body.cor;
    if (req.body.icone) tag.icone = req.body.icone;
    if (req.body.mostrarNoDashboard !== undefined) tag.mostrarNoDashboard = req.body.mostrarNoDashboard === true;

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

    const vinculada = await tagEstaVinculada(tag._id, req.userId);

    if (vinculada) {
      tag.ativo = false;
      await tag.save();
      return res.json({ mensagem: 'Tag possui transações vinculadas — foi inativada em vez de excluída.', inativada: true });
    }

    await Tag.deleteOne({ _id: tag._id });
    res.json({ mensagem: 'Tag excluída com sucesso.', inativada: false });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir tag.', detalhe: error.message });
  }
};

exports.ativarTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({
      $or: [{ _id: req.params.id }, { codigo: req.params.id }],
      usuario: req.userId
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });

    // Não permite reativar uma tag cuja categoria está inativa — evita
    // tag "ativa" presa embaixo de categoria inativa.
    const categoria = await Categoria.findOne({
      $or: [{ _id: tag.categoria }, { codigo: tag.categoria }],
      usuario: req.userId
    });
    if (categoria && categoria.ativo === false) {
      return res.status(400).json({ erro: `A categoria "${categoria.nome}" está inativa. Ative a categoria primeiro.` });
    }

    tag.ativo = true;
    await tag.save();

    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao ativar tag.', detalhe: error.message });
  }
};

exports.inativarTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({
      $or: [{ _id: req.params.id }, { codigo: req.params.id }],
      usuario: req.userId,
      ativo: true
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });

    tag.ativo = false;
    await tag.save();

    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao inativar tag.', detalhe: error.message });
  }
};
