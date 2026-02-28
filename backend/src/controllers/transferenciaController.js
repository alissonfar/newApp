// src/controllers/transferenciaController.js
const Transferencia = require('../models/transferencia');
const Subconta = require('../models/subconta');

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
