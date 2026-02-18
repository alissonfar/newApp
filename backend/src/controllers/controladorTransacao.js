// src/controllers/controladorTransacao.js
const Transacao = require('../models/transacao');
const mongoose = require('mongoose');

function buildMatchStage(req) {
  const match = { status: 'ativo', usuario: new mongoose.Types.ObjectId(req.userId) };

  if (req.query.excludePessoas) {
    const exclude = Array.isArray(req.query.excludePessoas) ? req.query.excludePessoas : [req.query.excludePessoas];
    if (exclude.length > 0) {
      match['pagamentos.pessoa'] = { $nin: exclude };
    }
  } else if (req.query.pessoas) {
    const pessoas = Array.isArray(req.query.pessoas) ? req.query.pessoas : [req.query.pessoas];
    if (pessoas.length > 0) {
      match['pagamentos.pessoa'] = { $in: pessoas };
    }
  } else if (req.query.proprietario) {
    match['pagamentos.pessoa'] = new RegExp('^' + req.query.proprietario + '$', 'i');
  }

  if (req.query.dataInicio || req.query.dataFim) {
    match.data = {};
    if (req.query.dataInicio) {
      match.data.$gte = new Date(req.query.dataInicio + 'T00:00:00.000Z');
    }
    if (req.query.dataFim) {
      match.data.$lte = new Date(req.query.dataFim + 'T23:59:59.999Z');
    }
  }

  if (req.query.tipo && ['gasto', 'recebivel'].includes(req.query.tipo.toLowerCase())) {
    match.tipo = req.query.tipo.toLowerCase();
  }

  if (req.query.tagsFilter) {
    try {
      const tagsFilter = typeof req.query.tagsFilter === 'string'
        ? JSON.parse(req.query.tagsFilter) : req.query.tagsFilter;
      const tagConditions = [];
      for (const [categoriaId, tagIds] of Object.entries(tagsFilter)) {
        if (Array.isArray(tagIds) && tagIds.length > 0) {
          tagConditions.push({ ['pagamentos.tags.' + categoriaId]: { $in: tagIds } });
        }
      }
      if (tagConditions.length > 0) {
        match.$and = match.$and || [];
        match.$and.push(...tagConditions);
      }
    } catch (e) {
      console.warn('tagsFilter inválido:', e.message);
    }
  }

  if (req.query.search && req.query.search.trim()) {
    const search = req.query.search.trim();
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [
      { descricao: regex },
      { 'pagamentos.pessoa': regex }
    ];
  }

  return match;
}

function buildSortStage(req) {
  const sortBy = req.query.sortBy || 'data';
  const sortDir = (req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const sortField = { data: 'data', descricao: 'descricao', pessoa: 'pagamentos.pessoa', valorPagamento: 'valor' }[sortBy] || 'data';
  return { [sortField]: sortDir };
}

exports.obterTodasTransacoes = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const usePagination = !isNaN(page) && !isNaN(limit) && page >= 1 && limit >= 1;

    if (!usePagination) {
      const filtros = { status: 'ativo', usuario: req.userId };
      if (req.query.proprietario) {
        filtros['pagamentos.pessoa'] = new RegExp('^' + req.query.proprietario + '$', 'i');
      }
      const transacoes = await Transacao.find(filtros);
      return res.json({ transacoes });
    }

    const matchStage = buildMatchStage(req);
    const sortStage = buildSortStage(req);
    const skip = (page - 1) * limit;

    const result = await Transacao.aggregate([
      { $match: matchStage },
      {
        $facet: {
          data: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit }
          ],
          count: [{ $count: 'total' }],
          summary: [
            { $unwind: { path: '$pagamentos', preserveNullAndEmptyArrays: true } },
            {
              $group: {
                _id: null,
                totalRows: { $sum: 1 },
                totalValue: { $sum: { $ifNull: ['$pagamentos.valor', 0] } },
                totalGastos: {
                  $sum: { $cond: [{ $eq: ['$tipo', 'gasto'] }, { $ifNull: ['$pagamentos.valor', 0] }, 0] }
                },
                totalRecebiveis: {
                  $sum: { $cond: [{ $eq: ['$tipo', 'recebivel'] }, { $ifNull: ['$pagamentos.valor', 0] }, 0] }
                },
                peopleSet: {
                  $addToSet: {
                    $cond: [
                      { $and: [{ $ne: ['$pagamentos.pessoa', null] }, { $ne: ['$pagamentos.pessoa', ''] }] },
                      '$pagamentos.pessoa',
                      '$$REMOVE'
                    ]
                  }
                }
              }
            },
            {
              $project: {
                _id: 0,
                totalRows: 1,
                totalValue: 1,
                totalGastos: 1,
                totalRecebiveis: 1,
                netValue: { $subtract: ['$totalRecebiveis', '$totalGastos'] },
                totalPeople: { $size: { $ifNull: ['$peopleSet', []] } }
              }
            }
          ]
        }
      }
    ]);

    const countDoc = result[0].count[0];
    const total = countDoc ? countDoc.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;
    const summaryDoc = result[0].summary[0] || {
      totalRows: 0, totalValue: 0, totalGastos: 0, totalRecebiveis: 0, netValue: 0, totalPeople: 0
    };

    res.json({
      data: result[0].data,
      total,
      page,
      totalPages,
      summary: {
        totalRows: summaryDoc.totalRows,
        totalValue: summaryDoc.totalValue?.toFixed(2) || '0.00',
        totalGastos: summaryDoc.totalGastos?.toFixed(2) || '0.00',
        totalRecebiveis: summaryDoc.totalRecebiveis?.toFixed(2) || '0.00',
        netValue: summaryDoc.netValue?.toFixed(2) || '0.00',
        totalPeople: summaryDoc.totalPeople ?? 0
      }
    });
  } catch (error) {
    console.error('Erro ao obter transações:', error);
    res.status(500).json({ erro: 'Erro ao obter transações.' });
  }
};

exports.obterPessoasDistintas = async (req, res) => {
  try {
    const match = { status: 'ativo', usuario: new mongoose.Types.ObjectId(req.userId) };
    const result = await Transacao.aggregate([
      { $match: match },
      { $unwind: '$pagamentos' },
      { $group: { _id: '$pagamentos.pessoa' } },
      { $match: { _id: { $ne: null, $ne: '' } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, pessoa: '$_id' } }
    ]);
    const pessoas = result.map(r => r.pessoa);
    res.json({ pessoas });
  } catch (error) {
    console.error('Erro ao obter pessoas:', error);
    res.status(500).json({ erro: 'Erro ao obter pessoas.' });
  }
};

exports.obterTransacoesExport = async (req, res) => {
  try {
    const matchStage = buildMatchStage(req);
    const sortStage = buildSortStage(req);
    const MAX_EXPORT = 50000;
    const transacoes = await Transacao.aggregate([
      { $match: matchStage },
      { $sort: sortStage },
      { $limit: MAX_EXPORT }
    ]);
    res.json({ transacoes });
  } catch (error) {
    console.error('Erro ao exportar transações:', error);
    res.status(500).json({ erro: 'Erro ao exportar transações.' });
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

exports.registrarTransacoesEmMassa = async (req, res) => {
  const { transacoes } = req.body;
  
  if (!transacoes || !Array.isArray(transacoes) || transacoes.length === 0) {
    return res.status(400).json({ erro: 'O formato do payload está incorreto. É necessário enviar um array de transações.' });
  }

  try {
    const transacoesComUsuario = transacoes.map(transacao => ({
      ...transacao,
      usuario: req.userId,
      dataImportacao: transacao.dataImportacao || new Date()
    }));

    // Validação básica dos dados
    for (let i = 0; i < transacoesComUsuario.length; i++) {
      const t = transacoesComUsuario[i];
      if (!t.tipo || !t.descricao || !t.valor || !t.data || !t.pagamentos) {
        return res.status(400).json({ 
          erro: 'Campos obrigatórios ausentes na transação ' + (i + 1),
          transacao: t
        });
      }
      
      // Verificar se o tipo é válido
      if (!['gasto', 'recebivel'].includes(t.tipo)) {
        return res.status(400).json({ 
          erro: 'Tipo de transação inválido na transação ' + (i + 1) + '. Valores permitidos: gasto, recebivel',
          transacao: t
        });
      }
    }

    // Criar todas as transações
    const transacoesSalvas = await Transacao.insertMany(transacoesComUsuario);
    
    res.status(201).json({ 
      mensagem: `${transacoesSalvas.length} transações registradas com sucesso.`,
      transacoes: transacoesSalvas
    });
  } catch (error) {
    console.error('Erro ao registrar transações em massa:', error);
    res.status(500).json({ 
      erro: 'Erro ao registrar transações em massa.', 
      detalhe: error.message 
    });
  }
};
