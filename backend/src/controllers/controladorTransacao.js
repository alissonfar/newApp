// src/controllers/controladorTransacao.js
const Transacao = require('../models/transacao');
const Subconta = require('../models/subconta');
const Emprestimo = require('../models/emprestimo');
const mongoose = require('mongoose');
const { addContabilizavelCondition } = require('../utils/transacaoContabilizavel');
const { buildPagamentosTagFilterStage } = require('../utils/pagamentosTagFilter');
const transacaoService = require('../services/transacaoService');
const emprestimoService = require('../services/emprestimoService');

function getTagsFilterFromReq(req) {
  if (!req.query.tagsFilter) return null;
  try {
    const tagsFilter = typeof req.query.tagsFilter === 'string'
      ? JSON.parse(req.query.tagsFilter) : req.query.tagsFilter;
    return tagsFilter && typeof tagsFilter === 'object' ? tagsFilter : null;
  } catch (e) {
    return null;
  }
}

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

  const tagsFilter = getTagsFilterFromReq(req);
  if (tagsFilter) {
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
  }

  if (req.query.search && req.query.search.trim()) {
    const search = req.query.search.trim();
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [
      { descricao: regex },
      { 'pagamentos.pessoa': regex }
    ];
  }

  if (req.query.subconta && mongoose.Types.ObjectId.isValid(req.query.subconta)) {
    match.subconta = new mongoose.Types.ObjectId(req.query.subconta);
  }

  addContabilizavelCondition(match);
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
      const filtros = { status: 'ativo', usuario: new mongoose.Types.ObjectId(req.userId) };
      if (req.query.proprietario) {
        filtros['pagamentos.pessoa'] = new RegExp('^' + req.query.proprietario + '$', 'i');
      }
      if (req.query.subconta && mongoose.Types.ObjectId.isValid(req.query.subconta)) {
        filtros.subconta = new mongoose.Types.ObjectId(req.query.subconta);
      }
      if (req.query.tipo && ['gasto', 'recebivel'].includes(req.query.tipo.toLowerCase())) {
        filtros.tipo = req.query.tipo.toLowerCase();
      }
      addContabilizavelCondition(filtros);
      const transacoes = await Transacao.find(filtros);
      // Marca transações de Empréstimo (gasto + recebível não-juros-auto) com
      // `_emprestimoEsconderNaLista` e zera valor/pagamentos. O frontend usa o
      // flag para escondê-las; a compensação de summary não é necessária aqui
      // pois este endpoint não retorna summary.
      const { ajustarRecebiveisDeEmprestimo } = require('../utils/emprestimoAjuste');
      await ajustarRecebiveisDeEmprestimo(transacoes, req.userId);
      return res.json({ transacoes });
    }

    const matchStage = buildMatchStage(req);
    const sortStage = buildSortStage(req);
    const skip = (page - 1) * limit;

    // Quando filtro por pessoas está ativo: projetar apenas pagamentos que batem com o filtro
    const pessoasFilter = !req.query.excludePessoas && req.query.pessoas
      ? (Array.isArray(req.query.pessoas) ? req.query.pessoas : [req.query.pessoas]).filter(Boolean)
      : null;

    const pipeline = [{ $match: matchStage }];

    // Filtro granular por tags: manter apenas pagamentos que possuem as tags selecionadas (antes do filtro de pessoas)
    const tagsFilterStage = buildPagamentosTagFilterStage(getTagsFilterFromReq(req));
    if (tagsFilterStage) {
      pipeline.push(tagsFilterStage);
      pipeline.push({ $match: { $expr: { $gt: [{ $size: '$pagamentos' }, 0] } } });
    }

    if (pessoasFilter && pessoasFilter.length > 0) {
      pipeline.push({
        $addFields: {
          pagamentos: {
            $filter: {
              input: { $ifNull: ['$pagamentos', []] },
              as: 'p',
              cond: { $in: ['$$p.pessoa', pessoasFilter] }
            }
          }
        }
      });
      pipeline.push({ $match: { $expr: { $gt: [{ $size: '$pagamentos' }, 0] } } });
    }

    const dataBranch = [{ $sort: sortStage }, { $skip: skip }, { $limit: limit }];
    const summaryStages = [
      { $unwind: { path: '$pagamentos', preserveNullAndEmptyArrays: true } }
    ];
    if (pessoasFilter && pessoasFilter.length > 0) {
      summaryStages.push({ $match: { 'pagamentos.pessoa': { $in: pessoasFilter } } });
    }
    summaryStages.push(
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
    );

    pipeline.push({
      $facet: {
        data: [...dataBranch],
        count: [{ $count: 'total' }],
        summary: summaryStages
      }
    });

    const result = await Transacao.aggregate(pipeline);

    const dataPage = result[0].data;

    // ====================================================================
    // Compensação do summary para Empréstimos (FASE 4 — modelo simplificado)
    // --------------------------------------------------------------------
    // Sem o FIFO, o `ajustarRecebiveisDeEmprestimo` apenas marca
    // `_emprestimoEsconderNaLista: true` e zera valor/pagamentos de TXs de
    // Empréstimo. Mas essas TXs JÁ foram somadas no aggregate do summary.
    // Para evitar dupla contagem, calculamos aqui quanto subtrair.
    //
    // - TXs de gasto de Empréstimo: subtrair de `totalGastos`
    // - TXs de recebível de Empréstimo (NÃO juros auto): subtrair de `totalRecebiveis`
    // - TX de juros auto: permanece (entra como receita normal)
    // ====================================================================
    const emprestimoIds = [];
    for (const t of dataPage) {
      if (t && t.emprestimoId) {
        const id = String(t.emprestimoId);
        if (!emprestimoIds.includes(id)) emprestimoIds.push(id);
      }
    }

    if (emprestimoIds.length > 0) {
      const { ajustarRecebiveisDeEmprestimo } = require('../utils/emprestimoAjuste');

      // Carrega TODAS as TXs vinculadas a esses Empréstimos (não só a página
      // atual) porque o summary é calculado sobre o universo completo de TXs
      // que batem com o match, e a compensação precisa ser sobre o mesmo
      // universo. A página é só a janela visível.
      const todasTransacoesEmprestimo = await Transacao.find({
        emprestimoId: { $in: emprestimoIds.map(id => new mongoose.Types.ObjectId(id)) },
        usuario: req.userId,
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true }
      }).lean();

      // Calcula totais por tipo para compensar o summary
      let totalGastosSubtrair = 0;
      let totalRecebiveisSubtrair = 0;
      for (const t of todasTransacoesEmprestimo) {
        const valor = t.valor || 0;
        if (t.tipo === 'gasto') {
          totalGastosSubtrair += valor;
        } else if (t.tipo === 'recebivel') {
          totalRecebiveisSubtrair += valor;
        }
      }

      // Aplica também o ajuste de lista (zera valor na página visível)
      const dataPageFiltrada = dataPage.filter(t => emprestimoIds.includes(String(t.emprestimoId)));
      await ajustarRecebiveisDeEmprestimo(dataPageFiltrada, req.userId);

      const summaryDocRaw = result[0].summary[0];
      if (summaryDocRaw) {
        summaryDocRaw.totalGastos = (summaryDocRaw.totalGastos || 0) - totalGastosSubtrair;
        summaryDocRaw.totalRecebiveis = (summaryDocRaw.totalRecebiveis || 0) - totalRecebiveisSubtrair;
        summaryDocRaw.netValue = (summaryDocRaw.totalRecebiveis || 0) - (summaryDocRaw.totalGastos || 0);
        summaryDocRaw.totalValue = (summaryDocRaw.totalGastos || 0) + (summaryDocRaw.totalRecebiveis || 0);
      }
    }

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

    const pessoasFilter = !req.query.excludePessoas && req.query.pessoas
      ? (Array.isArray(req.query.pessoas) ? req.query.pessoas : [req.query.pessoas]).filter(Boolean)
      : null;

    const exportPipeline = [{ $match: matchStage }];

    // Filtro granular por tags: manter apenas pagamentos que possuem as tags selecionadas (antes do filtro de pessoas)
    const tagsFilterStage = buildPagamentosTagFilterStage(getTagsFilterFromReq(req));
    if (tagsFilterStage) {
      exportPipeline.push(tagsFilterStage);
      exportPipeline.push({ $match: { $expr: { $gt: [{ $size: '$pagamentos' }, 0] } } });
    }

    if (pessoasFilter && pessoasFilter.length > 0) {
      exportPipeline.push({
        $addFields: {
          pagamentos: {
            $filter: {
              input: { $ifNull: ['$pagamentos', []] },
              as: 'p',
              cond: { $in: ['$$p.pessoa', pessoasFilter] }
            }
          }
        }
      });
      exportPipeline.push({ $match: { $expr: { $gt: [{ $size: '$pagamentos' }, 0] } } });
    }
    exportPipeline.push({ $sort: sortStage }, { $limit: MAX_EXPORT });

    const transacoes = await Transacao.aggregate(exportPipeline);
    // Marca TXs de Empréstimo (gasto + recebível não-juros-auto) com
    // `_emprestimoEsconderNaLista` e zera valor/pagamentos. O frontend usa o
    // flag para escondê-las.
    const { ajustarRecebiveisDeEmprestimo } = require('../utils/emprestimoAjuste');
    await ajustarRecebiveisDeEmprestimo(transacoes, req.userId);
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

exports.obterTransacoesPorGrupo = async (req, res) => {
  try {
    const { parentTransactionId } = req.params;
    const transacoes = await Transacao.find({
      usuario: req.userId,
      parentTransactionId,
      status: 'ativo'
    })
      .sort({ data: 1 })
      .select('descricao data valor pagamentos isInstallment');
    res.json({ transacoes });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter transações do grupo.', detalhe: error.message });
  }
};

const installmentUtils = require('../utils/installmentUtils');

exports.previewParcelas = async (req, res) => {
  try {
    const { totalAmount, totalInstallments, intervalInDays, startDate, pagamentos } = req.query;

    const parsedPagamentos = (() => {
      if (!pagamentos) return null;
      try {
        return typeof pagamentos === 'string' ? JSON.parse(pagamentos) : pagamentos;
      } catch {
        return null;
      }
    })();

    if (parsedPagamentos && Array.isArray(parsedPagamentos) && parsedPagamentos.some(p => p.parcelamento?.ativo)) {
      const resultado = installmentUtils.previewParcelamento({
        pagamentos: parsedPagamentos,
        startDate: startDate || new Date().toISOString().split('T')[0]
      });
      if (resultado.erro) {
        return res.status(400).json({ erro: resultado.erro });
      }
      return res.json(resultado);
    }

    const resultado = installmentUtils.generateInstallments({
      totalAmount: parseFloat(totalAmount) || 0,
      totalInstallments: parseInt(totalInstallments, 10) || 2,
      intervalInDays: parseInt(intervalInDays, 10) || 30,
      startDate: startDate || new Date().toISOString().split('T')[0]
    });
    if (resultado.erro) {
      return res.status(400).json({ erro: resultado.erro });
    }
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao gerar preview.', detalhe: error.message });
  }
};

exports.previewParcelasPost = async (req, res) => {
  try {
    const { totalAmount, totalInstallments, intervalInDays, startDate, pagamentos } = req.body;

    if (pagamentos && Array.isArray(pagamentos) && pagamentos.some(p => p.parcelamento?.ativo)) {
      const resultado = installmentUtils.previewParcelamento({
        pagamentos,
        startDate: startDate || new Date().toISOString().split('T')[0]
      });
      if (resultado.erro) {
        return res.status(400).json({ erro: resultado.erro });
      }
      return res.json(resultado);
    }

    const resultado = installmentUtils.generateInstallments({
      totalAmount: parseFloat(totalAmount) || 0,
      totalInstallments: parseInt(totalInstallments, 10) || 2,
      intervalInDays: parseInt(intervalInDays, 10) || 30,
      startDate: startDate || new Date().toISOString().split('T')[0]
    });
    if (resultado.erro) {
      return res.status(400).json({ erro: resultado.erro });
    }
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao gerar preview.', detalhe: error.message });
  }
};

exports.criarTransacao = async (req, res) => {
  const { tipo, descricao, valor, data, pagamentos, observacao, isInstallment, totalInstallments, installmentIntervalDays, installmentIntervalMonths, subconta } = req.body;
  if (!tipo || !descricao || !valor || !data || !pagamentos) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: tipo, descricao, valor, data e pagamentos.' });
  }
  let subcontaId = subconta || null;
  if (subcontaId && mongoose.Types.ObjectId.isValid(subcontaId)) {
    const sub = await Subconta.findOne({ _id: subcontaId, usuario: req.userId, ativo: true });
    if (!sub) subcontaId = null;
  } else {
    subcontaId = null;
  }

  // Detecta parcelamento: NOVO modelo (por pagamento) ou LEGADO (top-level isInstallment)
  const temParcelamentoPorPagamento = Array.isArray(pagamentos) && pagamentos.some(p => p.parcelamento?.ativo);
  const numParcelas = parseInt(totalInstallments, 10) || 1;
  const ehParceladoLegado = isInstallment === true && numParcelas > 1;
  const intervalDays = req.body.installmentIntervalDays != null
    ? parseInt(req.body.installmentIntervalDays, 10)
    : (parseInt(installmentIntervalMonths, 10) || 1) * 30;

  try {
    if (!temParcelamentoPorPagamento && !ehParceladoLegado) {
      // Fluxo transação única (sem parcelamento)
      let valorFinal = parseFloat(valor) || 0;
      let contaConjuntaParaSalvar = undefined;
      if (req.body.contaConjunta?.ativo) {
        await transacaoService.validarContaConjunta({
          contaConjunta: req.body.contaConjunta,
          usuarioId: req.userId
        });
        const preparado = transacaoService.prepararValorEContaConjunta(req.body);
        valorFinal = preparado.valor;
        contaConjuntaParaSalvar = preparado.contaConjunta;
      }
      transacaoService.validarSomaPagamentos(
        { valor: valorFinal, contaConjunta: req.body.contaConjunta },
        pagamentos
      );
      const novaTransacao = new Transacao({
        tipo,
        descricao,
        valor: valorFinal,
        data,
        pagamentos,
        observacao,
        usuario: req.userId,
        subconta: subcontaId,
        contaConjunta: contaConjuntaParaSalvar
      });
      if (req.body.emprestimoId) {
        await emprestimoService.validarEmprestimoParaTransacao(req.body.emprestimoId, req.userId);
        novaTransacao.emprestimoId = req.body.emprestimoId;
      }
      // valorEsperadoRetorno é persistido na Transação (não no Empréstimo).
      // Apenas faz sentido para gastos com emprestimoId vinculado; o service
      // de Empréstimos ignora o campo para outros tipos.
      if (req.body.valorEsperadoRetorno !== undefined && req.body.valorEsperadoRetorno !== null) {
        const ver = Number(req.body.valorEsperadoRetorno);
        if (!isNaN(ver) && ver >= 0) {
          novaTransacao.valorEsperadoRetorno = ver;
        }
      }
      await novaTransacao.save();
      if (novaTransacao.emprestimoId) {
        await emprestimoService.recalcularStatus(novaTransacao.emprestimoId, req.userId);
      }
      return res.status(201).json(novaTransacao);
    }

    // Fluxo parcelado: suporta NOVO modelo (por pagamento) e LEGADO (top-level)
    let valorFinal = parseFloat(valor) || 0;
    let contaConjuntaParaSalvar = undefined;
    if (req.body.contaConjunta?.ativo) {
      await transacaoService.validarContaConjunta({
        contaConjunta: req.body.contaConjunta,
        usuarioId: req.userId
      });
      const preparado = transacaoService.prepararValorEContaConjunta(req.body);
      valorFinal = preparado.valor;
      contaConjuntaParaSalvar = preparado.contaConjunta;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let transacoesParaInserir;
      let parentTransactionId;

      if (temParcelamentoPorPagamento) {
        // NOVO modelo: parcelamento por pagamento/participante
        const resultado = installmentUtils.gerarTransacoesComParcelamento({
          pagamentos,
          startDate: data,
          baseTransacao: {
            tipo,
            descricao,
            observacao: observacao || '',
            usuario: req.userId,
            subconta: subcontaId,
            contaConjunta: contaConjuntaParaSalvar
          }
        });

        if (resultado.erro) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ erro: resultado.erro });
        }

        transacoesParaInserir = resultado.transacoes;
        parentTransactionId = resultado.parentTransactionId;
      } else {
        // LEGADO: parcelamento top-level (compatibilidade retroativa)
        if (intervalDays < 1) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ erro: 'Intervalo em dias deve ser >= 1.' });
        }

        const valorTotal = Math.abs(valorFinal);
        const resultado = installmentUtils.generateInstallments({
          totalAmount: valorTotal,
          totalInstallments: numParcelas,
          intervalInDays: intervalDays,
          startDate: data
        });

        if (resultado.erro) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ erro: resultado.erro });
        }

        parentTransactionId = new mongoose.Types.ObjectId();
        const installmentGroupId = new mongoose.Types.ObjectId();

        const pagamentoBase = Array.isArray(pagamentos) && pagamentos.length > 0
          ? pagamentos[0]
          : { pessoa: 'Titular', valor: 0, tags: {} };
        const pessoaBase = pagamentoBase.pessoa || 'Titular';
        const tagsBase = pagamentoBase.tags || {};

        transacoesParaInserir = resultado.parcelas.map((p) => {
          const dataParcela = new Date(p.date + 'T12:00:00.000Z');
          return {
            tipo,
            descricao,
            valor: p.value,
            data: dataParcela,
            pagamentos: [{
              pessoa: pessoaBase,
              valor: p.value,
              tags: tagsBase,
              installmentNumber: p.installmentNumber,
              installmentTotal: numParcelas,
              installmentGroupId
            }],
            observacao: observacao || '',
            usuario: req.userId,
            subconta: subcontaId,
            contaConjunta: contaConjuntaParaSalvar,
            parentTransactionId,
            isInstallment: true,
            installmentGroupId,
            installmentNumber: p.installmentNumber,
            installmentTotal: numParcelas,
            installmentIntervalDays: intervalDays
          };
        });
      }

      if (req.body.emprestimoId) {
        await emprestimoService.validarEmprestimoParaTransacao(req.body.emprestimoId, req.userId);
        transacoesParaInserir.forEach((t) => { t.emprestimoId = req.body.emprestimoId; });
      }
      // valorEsperadoRetorno na Transação: replica em todas as parcelas para
      // que cada uma carregue sua própria expectativa. (No modelo atual, todas
      // as parcelas de um mesmo parcelamento normalmente têm o mesmo valor
      // esperado — manter consistência.)
      if (req.body.valorEsperadoRetorno !== undefined && req.body.valorEsperadoRetorno !== null) {
        const ver = Number(req.body.valorEsperadoRetorno);
        if (!isNaN(ver) && ver >= 0) {
          transacoesParaInserir.forEach((t) => { t.valorEsperadoRetorno = ver; });
        }
      }

      const transacoesCriadas = await Transacao.insertMany(transacoesParaInserir, { session });
      await session.commitTransaction();
      if (req.body.emprestimoId) {
        await emprestimoService.recalcularStatus(req.body.emprestimoId, req.userId);
      }

      res.status(201).json({
        transacoes: transacoesCriadas,
        totalParcelas: transacoesCriadas.length,
        parentTransactionId
      });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar transação.', detalhe: error.message });
  }
};

exports.atualizarTransacao = async (req, res) => {
  try {
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada.' });
    const pagamentosAtual = req.body.pagamentos || transacao.pagamentos;
    let valorAtual = req.body.valor !== undefined ? parseFloat(req.body.valor) : transacao.valor;
    let contaConjuntaAtual = transacao.contaConjunta && transacao.contaConjunta.toObject ? transacao.contaConjunta.toObject() : transacao.contaConjunta;
    if (req.body.contaConjunta !== undefined) {
      if (req.body.contaConjunta?.ativo) {
        await transacaoService.validarContaConjunta({
          contaConjunta: req.body.contaConjunta,
          usuarioId: req.userId
        });
        const preparado = transacaoService.prepararValorEContaConjunta({
          valor: req.body.valor,
          contaConjunta: req.body.contaConjunta
        });
        valorAtual = preparado.valor;
        contaConjuntaAtual = preparado.contaConjunta;
      } else {
        contaConjuntaAtual = { ativo: false };
      }
    }
    transacaoService.validarSomaPagamentos(
      { valor: valorAtual, contaConjunta: req.body.contaConjunta ?? contaConjuntaAtual },
      pagamentosAtual
    );
    transacao.tipo = req.body.tipo || transacao.tipo;
    transacao.descricao = req.body.descricao || transacao.descricao;
    transacao.valor = valorAtual;
    transacao.data = req.body.data || transacao.data;
    transacao.pagamentos = pagamentosAtual;
    transacao.observacao = req.body.observacao !== undefined ? req.body.observacao : transacao.observacao;
    if (req.body.contaConjunta !== undefined) {
      transacao.contaConjunta = contaConjuntaAtual;
    }
    if (req.body.subconta !== undefined) {
      if (req.body.subconta && mongoose.Types.ObjectId.isValid(req.body.subconta)) {
        const sub = await Subconta.findOne({ _id: req.body.subconta, usuario: req.userId, ativo: true });
        transacao.subconta = sub ? req.body.subconta : transacao.subconta;
      } else {
        transacao.subconta = null;
      }
    }
    if (req.body.emprestimoId !== undefined) {
      const emprestimoIdAntes = transacao.emprestimoId ? transacao.emprestimoId.toString() : null;
      if (req.body.emprestimoId) {
        await emprestimoService.validarEmprestimoParaTransacao(req.body.emprestimoId, req.userId);
      }
      transacao.emprestimoId = req.body.emprestimoId || null;
      if (req.body.valorEsperadoRetorno !== undefined) {
        if (req.body.valorEsperadoRetorno === null) {
          transacao.valorEsperadoRetorno = null;
        } else {
          const ver = Number(req.body.valorEsperadoRetorno);
          if (!isNaN(ver) && ver >= 0) {
            transacao.valorEsperadoRetorno = ver;
          } else if (ver < 0) {
            return res.status(400).json({ erro: 'valorEsperadoRetorno não pode ser negativo.' });
          }
        }
      }
      await transacao.save();
      const novoId = transacao.emprestimoId ? transacao.emprestimoId.toString() : null;
      if (emprestimoIdAntes && emprestimoIdAntes !== novoId) {
        await emprestimoService.recalcularStatus(emprestimoIdAntes, req.userId);
      }
      if (novoId) {
        await emprestimoService.recalcularStatus(novoId, req.userId);
      }
    } else {
      if (req.body.valorEsperadoRetorno !== undefined) {
        if (req.body.valorEsperadoRetorno === null) {
          transacao.valorEsperadoRetorno = null;
        } else {
          const ver = Number(req.body.valorEsperadoRetorno);
          if (!isNaN(ver) && ver >= 0) {
            transacao.valorEsperadoRetorno = ver;
          } else if (ver < 0) {
            return res.status(400).json({ erro: 'valorEsperadoRetorno não pode ser negativo.' });
          }
        }
      }
      await transacao.save();
      // Se a transação tem emprestimoId e o usuário alterou valor/tipo/data/etc,
      // é necessário recalcular pois isso pode mudar o status do empréstimo.
      if (transacao.emprestimoId) {
        await emprestimoService.recalcularStatus(
          String(transacao.emprestimoId),
          req.userId
        );
      }
    }
    res.json(transacao);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar transação.', detalhe: error.message });
  }
};

exports.excluirTransacao = async (req, res) => {
  try {
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId });
    if (!transacao) return res.status(404).json({ erro: 'Transação não encontrada.' });
    const emprestimoIdAntes = transacao.emprestimoId ? transacao.emprestimoId.toString() : null;
    transacao.status = 'estornado';
    await transacao.save();
    if (emprestimoIdAntes) {
      await emprestimoService.recalcularStatus(emprestimoIdAntes, req.userId);
    }
    res.json({ mensagem: 'Transação estornada com sucesso.', transacao });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir transação.', detalhe: error.message });
  }
};

exports.estornarParcelamento = async (req, res) => {
  try {
    const { installmentGroupId } = req.params;

    // Coletar emprestimoId distintos das parcelas ANTES do updateMany
    // (depois não dá pra saber quais tinham empréstimo)
    const txsComEmprestimo = await Transacao.find({
      usuario: req.userId,
      $or: [
        { installmentGroupId, status: 'ativo' },
        { 'pagamentos.installmentGroupId': installmentGroupId, status: 'ativo' }
      ],
      emprestimoId: { $ne: null }
    }).select('_id emprestimoId').lean();
    const emprestimosAfetados = new Set(
      txsComEmprestimo
        .filter((t) => t.emprestimoId)
        .map((t) => String(t.emprestimoId))
    );

    // Busca tanto no nível da transação (legado) quanto no nível do pagamento (novo modelo)
    const [resultTransacao, resultPagamentos] = await Promise.all([
      Transacao.updateMany(
        { usuario: req.userId, installmentGroupId, status: 'ativo' },
        { $set: { status: 'estornado' } }
      ),
      Transacao.updateMany(
        { usuario: req.userId, 'pagamentos.installmentGroupId': installmentGroupId, status: 'ativo' },
        { $set: { status: 'estornado' } }
      )
    ]);

    const totalEstornadas = resultTransacao.modifiedCount + resultPagamentos.modifiedCount;

    if (totalEstornadas === 0) {
      return res.status(404).json({ erro: 'Nenhuma parcela ativa encontrada para este parcelamento.' });
    }

    // Recalcular status dos empréstimos afetados
    for (const empId of emprestimosAfetados) {
      try {
        await emprestimoService.recalcularStatus(empId, req.userId);
      } catch (errEmp) {
        console.error('[controladorTransacao] Erro ao recalcular empréstimo', empId, errEmp.message);
      }
    }

    res.json({
      mensagem: `${totalEstornadas} parcela(s) estornada(s) com sucesso.`,
      totalEstornadas
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao estornar parcelamento.', detalhe: error.message });
  }
};

exports.estornarGrupoPai = async (req, res) => {
  try {
    const { parentTransactionId } = req.params;

    const txsComEmprestimo = await Transacao.find({
      usuario: req.userId,
      parentTransactionId,
      status: 'ativo',
      emprestimoId: { $ne: null }
    }).select('_id emprestimoId').lean();
    const emprestimosAfetados = new Set(
      txsComEmprestimo
        .filter((t) => t.emprestimoId)
        .map((t) => String(t.emprestimoId))
    );

    const resultado = await Transacao.updateMany(
      { usuario: req.userId, parentTransactionId, status: 'ativo' },
      { $set: { status: 'estornado' } }
    );
    if (resultado.modifiedCount === 0) {
      return res.status(404).json({ erro: 'Nenhuma transação ativa encontrada para este grupo.' });
    }

    for (const empId of emprestimosAfetados) {
      try {
        await emprestimoService.recalcularStatus(empId, req.userId);
      } catch (errEmp) {
        console.error('[controladorTransacao] Erro ao recalcular empréstimo', empId, errEmp.message);
      }
    }

    res.json({
      mensagem: `${resultado.modifiedCount} transação(ões) estornada(s) com sucesso.`,
      totalEstornadas: resultado.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao estornar grupo.', detalhe: error.message });
  }
};

exports.reativarTransacao = async (req, res) => {
  try {
    const transacao = await Transacao.findOne({ _id: req.params.id, usuario: req.userId, status: 'estornado' });
    if (!transacao) return res.status(404).json({ erro: 'Transação estornada não encontrada.' });
    transacao.status = 'ativo';
    await transacao.save();
    if (transacao.emprestimoId) {
      try {
        await emprestimoService.recalcularStatus(String(transacao.emprestimoId), req.userId);
      } catch (errEmp) {
        console.error('[controladorTransacao] Erro ao recalcular empréstimo', transacao.emprestimoId, errEmp.message);
      }
    }
    res.json({ mensagem: 'Transação reativada com sucesso.', transacao });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao reativar transação.', detalhe: error.message });
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

    for (let i = 0; i < transacoesComUsuario.length; i++) {
      const t = transacoesComUsuario[i];
      if (!t.tipo || !t.descricao || !t.valor || !t.data || !t.pagamentos) {
        return res.status(400).json({
          erro: 'Campos obrigatórios ausentes na transação ' + (i + 1),
          transacao: t
        });
      }
      if (!['gasto', 'recebivel'].includes(t.tipo)) {
        return res.status(400).json({
          erro: 'Tipo de transação inválido na transação ' + (i + 1) + '. Valores permitidos: gasto, recebivel',
          transacao: t
        });
      }
      if (t.emprestimoId) {
        try {
          await emprestimoService.validarEmprestimoParaTransacao(t.emprestimoId, req.userId);
        } catch (errEmp) {
          return res.status(400).json({
            erro: `emprestimoId inválido na transação ${i + 1}: ${errEmp.message}`,
            transacao: t
          });
        }
      }
    }

    const transacoesSalvas = await Transacao.insertMany(transacoesComUsuario);

    const emprestimosAfetados = new Set();
    for (const t of transacoesSalvas) {
      if (t.emprestimoId) emprestimosAfetados.add(String(t.emprestimoId));
    }
    for (const empId of emprestimosAfetados) {
      try {
        await emprestimoService.recalcularStatus(empId, req.userId);
      } catch (errEmp) {
        console.error('[controladorTransacao] Erro ao recalcular empréstimo', empId, errEmp.message);
      }
    }

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
