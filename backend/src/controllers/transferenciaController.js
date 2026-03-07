// src/controllers/transferenciaController.js
const Transferencia = require('../models/transferencia');
const Subconta = require('../models/subconta');
const HistoricoSaldo = require('../models/historicoSaldo');
const ledgerService = require('../services/ledgerService');
const { startTransactionSession } = require('../utils/transactionHelper');

exports.listar = async (req, res) => {
  try {
    const { status } = req.query;
    const filtro = { usuario: req.userId };
    if (status) filtro.status = status;

    const transferencias = await Transferencia.find(filtro)
      .populate('subcontaOrigem subcontaDestino', 'nome instituicao')
      .sort({ data: -1 })
      .lean();

    return res.json(transferencias);
  } catch (erro) {
    console.error('[Transferencia] Erro ao listar:', erro);
    return res.status(500).json({ erro: 'Erro ao listar transferências' });
  }
};

exports.criar = async (req, res) => {
  try {
    const { subcontaOrigemId, subcontaDestinoId, valor, data } = req.body;

    if (!subcontaOrigemId || !subcontaDestinoId || valor == null) {
      return res.status(400).json({ erro: 'subcontaOrigemId, subcontaDestinoId e valor são obrigatórios' });
    }
    if (subcontaOrigemId === subcontaDestinoId) {
      return res.status(400).json({ erro: 'Subconta origem e destino devem ser diferentes' });
    }

    const [origem, destino] = await Promise.all([
      Subconta.findOne({ _id: subcontaOrigemId, usuario: req.userId }),
      Subconta.findOne({ _id: subcontaDestinoId, usuario: req.userId })
    ]);

    if (!origem || !destino) {
      return res.status(404).json({ erro: 'Subconta(s) não encontrada(s)' });
    }

    const valorNum = parseFloat(valor);
    if (isNaN(valorNum) || valorNum <= 0) {
      return res.status(400).json({ erro: 'Valor deve ser um número positivo' });
    }

    const transferencia = await Transferencia.create({
      usuario: req.userId,
      subcontaOrigem: subcontaOrigemId,
      subcontaDestino: subcontaDestinoId,
      valor: valorNum,
      data: data ? new Date(data) : new Date(),
      status: 'pendente'
    });

    const populated = await Transferencia.findById(transferencia._id)
      .populate('subcontaOrigem subcontaDestino', 'nome instituicao');
    return res.status(201).json(populated);
  } catch (erro) {
    console.error('[Transferencia] Erro ao criar:', erro);
    return res.status(500).json({ erro: 'Erro ao criar transferência' });
  }
};

exports.confirmar = async (req, res) => {
  try {
    const transferencia = await Transferencia.findOne({
      _id: req.params.id,
      usuario: req.userId
    });

    if (!transferencia) {
      return res.status(404).json({ erro: 'Transferência não encontrada' });
    }
    if (transferencia.status !== 'pendente') {
      return res.status(400).json({ erro: 'Só é possível confirmar transferências pendentes' });
    }

    const valor = transferencia.valor;
    const origemId = transferencia.subcontaOrigem?._id || transferencia.subcontaOrigem;
    const destinoId = transferencia.subcontaDestino?._id || transferencia.subcontaDestino;

    const [origem, destino] = await Promise.all([
      Subconta.findOne({ _id: origemId, usuario: req.userId }),
      Subconta.findOne({ _id: destinoId, usuario: req.userId })
    ]);

    if (!origem || !destino) {
      return res.status(404).json({ erro: 'Subconta(s) não encontrada(s)' });
    }

    const saldoOrigemAntes = origem.saldoAtual ?? 0;
    const saldoDestinoAntes = destino.saldoAtual ?? 0;
    const novoSaldoOrigem = saldoOrigemAntes - valor;
    const novoSaldoDestino = saldoDestinoAntes + valor;

    let session;
    try {
      session = await startTransactionSession();
    } catch (txErr) {
      session = null;
    }

    const opts = session ? { session } : {};
    try {
      origem.saldoAtual = novoSaldoOrigem;
      origem.dataUltimaConfirmacao = transferencia.data;
      await origem.save(opts);

      destino.saldoAtual = novoSaldoDestino;
      destino.dataUltimaConfirmacao = transferencia.data;
      await destino.save(opts);

      await HistoricoSaldo.create([
        {
          usuario: req.userId,
          subconta: origemId,
          saldo: novoSaldoOrigem,
          data: transferencia.data,
          origem: 'manual',
          tipo: 'transferencia_saida',
          observacao: `Transferência confirmada manualmente → ${destino.nome}`
        },
        {
          usuario: req.userId,
          subconta: destinoId,
          saldo: novoSaldoDestino,
          data: transferencia.data,
          origem: 'manual',
          tipo: 'transferencia_entrada',
          observacao: `Transferência confirmada manualmente ← ${origem.nome}`
        }
      ], opts);

      await ledgerService.registrarEvento({
        usuarioId: req.userId,
        subcontaId: origemId,
        valor: -valor,
        tipoEvento: 'transferencia_saida',
        origemSistema: 'transferencia',
        referenciaTipo: 'transferencia',
        referenciaId: transferencia._id,
        descricao: `Transferência → ${destino.nome}`,
        dataEvento: transferencia.data
      }, session);

      await ledgerService.registrarEvento({
        usuarioId: req.userId,
        subcontaId: destinoId,
        valor,
        tipoEvento: 'transferencia_entrada',
        origemSistema: 'transferencia',
        referenciaTipo: 'transferencia',
        referenciaId: transferencia._id,
        descricao: `Transferência ← ${origem.nome}`,
        dataEvento: transferencia.data
      }, session);

      transferencia.status = 'concluida';
      await transferencia.save(opts);

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

    const populated = await Transferencia.findById(transferencia._id)
      .populate('subcontaOrigem subcontaDestino', 'nome instituicao')
      .lean();

    return res.json(populated);
  } catch (erro) {
    console.error('[Transferencia] Erro ao confirmar:', erro);
    return res.status(500).json({ erro: 'Erro ao confirmar transferência' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const transferencia = await Transferencia.findOne({
      _id: req.params.id,
      usuario: req.userId
    })
      .populate('subcontaOrigem subcontaDestino', 'nome instituicao')
      .populate('transacaoOFX', 'descricao valor data tipo')
      .lean();

    if (!transferencia) {
      return res.status(404).json({ erro: 'Transferência não encontrada' });
    }

    return res.json(transferencia);
  } catch (erro) {
    console.error('[Transferencia] Erro ao obter:', erro);
    return res.status(500).json({ erro: 'Erro ao obter transferência' });
  }
};
