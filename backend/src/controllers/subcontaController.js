// src/controllers/subcontaController.js
const mongoose = require('mongoose');
const Subconta = require('../models/subconta');
const Instituicao = require('../models/instituicao');
const HistoricoSaldo = require('../models/historicoSaldo');
const taxaCDIService = require('../services/taxaCDIService');
const ledgerService = require('../services/ledgerService');
const LedgerPatrimonial = require('../models/ledgerPatrimonial');
const { startTransactionSession } = require('../utils/transactionHelper');

exports.listar = async (req, res) => {
  try {
    const subcontas = await Subconta.find({ usuario: req.userId, ativo: true })
      .populate('instituicao')
      .sort({ 'instituicao.nome': 1, nome: 1 })
      .lean();
    res.json(subcontas);
  } catch (error) {
    console.error('Erro ao listar subcontas:', error);
    res.status(500).json({ erro: 'Erro ao listar subcontas.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId })
      .populate('instituicao');
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    res.json(subconta);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter subconta.' });
  }
};

exports.criar = async (req, res) => {
  const { instituicao, nome, tipo, proposito, percentualCDI, saldoAtual, meta } = req.body;
  if (!instituicao || !nome || !tipo || !proposito) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: instituicao, nome, tipo e proposito.' });
  }
  const tiposValidos = ['corrente', 'rendimento_automatico', 'caixinha', 'investimento_fixo'];
  const propositosValidos = ['disponivel', 'reserva_emergencia', 'objetivo', 'guardado'];
  if (!tiposValidos.includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido.' });
  if (!propositosValidos.includes(proposito)) return res.status(400).json({ erro: 'Propósito inválido.' });
  try {
    const inst = await Instituicao.findOne({ _id: instituicao, usuario: req.userId });
    if (!inst) return res.status(400).json({ erro: 'Instituição não encontrada.' });
    const saldoInicial = saldoAtual != null ? parseFloat(saldoAtual) : 0;
    const nova = new Subconta({
      usuario: req.userId,
      instituicao,
      nome,
      tipo,
      proposito,
      percentualCDI: percentualCDI != null ? parseFloat(percentualCDI) : null,
      saldoAtual: saldoInicial,
      dataUltimaConfirmacao: saldoInicial !== 0 ? new Date() : null,
      meta: meta != null ? parseFloat(meta) : null,
      ativo: true
    });

    let session;
    try {
      session = await startTransactionSession();
    } catch (txErr) {
      session = null;
    }

    const opts = session ? { session } : {};
    try {
      await nova.save(opts);
      if (saldoInicial !== 0) {
        await HistoricoSaldo.create([{
          usuario: req.userId,
          subconta: nova._id,
          saldo: saldoInicial,
          data: new Date(),
          origem: 'manual',
          tipo: 'ajuste',
          observacao: 'Saldo inicial'
        }], opts);
        await ledgerService.registrarEvento({
          usuarioId: req.userId,
          subcontaId: nova._id,
          valor: saldoInicial,
          tipoEvento: 'snapshot_inicial',
          origemSistema: 'subconta_criacao',
          referenciaTipo: 'subconta',
          referenciaId: nova._id,
          descricao: 'Saldo inicial',
          dataEvento: new Date()
        }, session);
      }
      if (session) {
        await session.commitTransaction();
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction().catch(() => {});
      }
      throw err;
    } finally {
      if (session) session.endSession();
    }

    const doc = await Subconta.findById(nova._id).populate('instituicao');
    res.status(201).json(doc);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe uma subconta com este nome nesta instituição.' });
    }
    res.status(500).json({ erro: 'Erro ao criar subconta.', detalhe: error.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId });
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    if (req.body.nome !== undefined) subconta.nome = req.body.nome;
    if (req.body.tipo !== undefined) {
      const tiposValidos = ['corrente', 'rendimento_automatico', 'caixinha', 'investimento_fixo'];
      if (!tiposValidos.includes(req.body.tipo)) return res.status(400).json({ erro: 'Tipo inválido.' });
      subconta.tipo = req.body.tipo;
    }
    if (req.body.proposito !== undefined) {
      const propositosValidos = ['disponivel', 'reserva_emergencia', 'objetivo', 'guardado'];
      if (!propositosValidos.includes(req.body.proposito)) return res.status(400).json({ erro: 'Propósito inválido.' });
      subconta.proposito = req.body.proposito;
    }
    if (req.body.percentualCDI !== undefined) subconta.percentualCDI = req.body.percentualCDI;
    if (req.body.meta !== undefined) subconta.meta = req.body.meta;
    if (req.body.ativo !== undefined) subconta.ativo = req.body.ativo;
    await subconta.save();
    const doc = await Subconta.findById(subconta._id).populate('instituicao');
    res.json(doc);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar subconta.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId });
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    subconta.ativo = false;
    await subconta.save();
    res.json({ mensagem: 'Subconta removida com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir subconta.' });
  }
};

const TIPOS_HISTORICO = ['rendimento', 'aporte', 'transferencia_entrada', 'transferencia_saida', 'ajuste'];

const TIPO_HISTORICO_TO_TIPO_EVENTO = {
  rendimento: 'rendimento',
  aporte: 'aporte',
  transferencia_entrada: 'transferencia_entrada',
  transferencia_saida: 'transferencia_saida',
  ajuste: 'ajuste_manual'
};

exports.confirmarSaldo = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ erro: 'ID da subconta inválido.' });
    }
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId });
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    const { saldo, observacao, origem, tipo } = req.body;
    const saldoNum = parseFloat(saldo);
    if (saldo == null || isNaN(saldoNum)) {
      return res.status(400).json({ erro: 'O campo saldo é obrigatório e deve ser um número.' });
    }
    const origemValida = ['manual', 'importacao_ofx', 'importacao_csv'].includes(origem) ? origem : 'manual';
    let tipoValido = 'ajuste';
    if (origemValida === 'importacao_ofx' || origemValida === 'importacao_csv') {
      tipoValido = 'ajuste';
    } else if (tipo && TIPOS_HISTORICO.includes(tipo)) {
      tipoValido = tipo;
    } else if (origemValida === 'manual') {
      return res.status(400).json({ erro: 'O campo tipo é obrigatório para confirmação manual de saldo.' });
    }

    const saldoAntes = subconta.saldoAtual ?? 0;
    const delta = saldoNum - saldoAntes;

    let session;
    try {
      session = await startTransactionSession();
    } catch (txErr) {
      session = null;
    }

    const opts = session ? { session } : {};
    try {
      subconta.saldoAtual = saldoNum;
      subconta.dataUltimaConfirmacao = new Date();
      await subconta.save(opts);

      const historico = new HistoricoSaldo({
        usuario: req.userId,
        subconta: subconta._id,
        saldo: saldoNum,
        data: new Date(),
        origem: origemValida,
        tipo: tipoValido,
        observacao: observacao || ''
      });
      await historico.save(opts);

      if (delta !== 0) {
        const tipoEvento = TIPO_HISTORICO_TO_TIPO_EVENTO[tipoValido] || 'ajuste_manual';
        await ledgerService.registrarEvento({
          usuarioId: req.userId,
          subcontaId: subconta._id,
          valor: delta,
          tipoEvento,
          origemSistema: 'confirmacao_manual',
          referenciaTipo: 'confirmacao_manual',
          referenciaId: historico._id,
          descricao: observacao || `Confirmação de saldo: ${tipoValido}`,
          dataEvento: new Date()
        }, session);
      }

      if (session) {
        await session.commitTransaction();
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction().catch(() => {});
      }
      throw err;
    } finally {
      if (session) session.endSession();
    }

    const doc = await Subconta.findById(subconta._id).populate('instituicao');
    res.json(doc);
  } catch (error) {
    console.error('Erro ao confirmar saldo:', error.name, error.message, process.env.NODE_ENV === 'development' ? error.stack : '');
    if (error.name === 'ValidationError') {
      const msg = error.message || 'Dados inválidos.';
      return res.status(400).json({ erro: msg });
    }
    if (error.code === 11000) {
      return res.status(409).json({ erro: 'Registro duplicado. Tente novamente.' });
    }
    res.status(500).json({ erro: 'Erro ao confirmar saldo.' });
  }
};

exports.obterEventosLedger = async (req, res) => {
  try {
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId });
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    const { tipoEvento, dataInicio, dataFim, limit } = req.query;
    const match = { subconta: req.params.id, usuario: req.userId };
    if (tipoEvento) match.tipoEvento = tipoEvento;
    if (dataInicio || dataFim) {
      match.dataEvento = {};
      if (dataInicio) match.dataEvento.$gte = new Date(dataInicio);
      if (dataFim) match.dataEvento.$lte = new Date(dataFim);
    }
    const limite = limit ? Math.min(parseInt(limit, 10) || 100, 500) : 100;
    const eventos = await LedgerPatrimonial.find(match)
      .sort({ dataEvento: -1, createdAt: -1 })
      .limit(limite)
      .lean();
    res.json(eventos);
  } catch (error) {
    console.error('Erro ao obter eventos do ledger:', error);
    res.status(500).json({ erro: 'Erro ao obter eventos do ledger.' });
  }
};

exports.obterSaldoPorLedger = async (req, res) => {
  try {
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId });
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    const { ateData } = req.query;
    const ateDataDate = ateData ? new Date(ateData) : null;
    const saldo = await ledgerService.calcularSaldoPorLedger(req.params.id, ateDataDate);
    res.json({
      saldo,
      subcontaId: req.params.id,
      ...(ateDataDate && { ateData: ateDataDate })
    });
  } catch (error) {
    console.error('Erro ao obter saldo por ledger:', error);
    res.status(500).json({ erro: 'Erro ao obter saldo por ledger.' });
  }
};

exports.obterHistorico = async (req, res) => {
  try {
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId });
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    const { tipo } = req.query;
    const match = { subconta: req.params.id, usuario: req.userId };
    if (tipo && TIPOS_HISTORICO.includes(tipo)) match.tipo = tipo;
    const historico = await HistoricoSaldo.find(match)
      .sort({ data: -1, createdAt: -1 })
      .limit(100)
      .lean();
    res.json(historico);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao obter histórico.' });
  }
};

exports.obterRendimentoEstimado = async (req, res) => {
  try {
    const subconta = await Subconta.findOne({ _id: req.params.id, usuario: req.userId });
    if (!subconta) return res.status(404).json({ erro: 'Subconta não encontrada.' });
    const percentual = subconta.percentualCDI || (subconta.rendimento && subconta.rendimento.percentualCDI) || 0;
    if (!percentual || !subconta.saldoAtual) {
      return res.json({
        rendimentoDiario: 0,
        rendimentoMensal: 0,
        taxaCDI: null,
        dataUltimaTaxa: null,
        estimativa: true
      });
    }
    const taxa = await taxaCDIService.obterOuAtualizarTaxaAtual();
    if (!taxa) {
      return res.json({
        rendimentoDiario: 0,
        rendimentoMensal: 0,
        taxaCDI: null,
        dataUltimaTaxa: null,
        estimativa: true,
        mensagem: 'Taxa CDI não disponível.'
      });
    }
    const rendimentoDiario = taxaCDIService.calcularRendimentoDiario(
      subconta.saldoAtual,
      taxa.taxaDiaria,
      percentual
    );
    const rendimentoMensal = rendimentoDiario * 30;
    res.json({
      rendimentoDiario,
      rendimentoMensal,
      taxaCDI: taxa.taxaAnual,
      dataUltimaTaxa: taxa.data,
      percentualCDI: percentual,
      saldoAtual: subconta.saldoAtual,
      estimativa: true
    });
  } catch (error) {
    console.error('Erro ao obter rendimento estimado:', error);
    res.json({
      rendimentoDiario: 0,
      rendimentoMensal: 0,
      taxaCDI: null,
      dataUltimaTaxa: null,
      estimativa: true,
      mensagem: 'Erro ao calcular rendimento.'
    });
  }
};
