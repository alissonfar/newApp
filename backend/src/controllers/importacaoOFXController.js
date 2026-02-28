// src/controllers/importacaoOFXController.js
const fs = require('fs').promises;
const ImportacaoOFX = require('../models/importacaoOFX');
const TransacaoOFX = require('../models/transacaoOFX');
const Transferencia = require('../models/transferencia');
const importacaoOFXService = require('../services/importacaoOFXService');
const { sugerirTransferencias } = require('../services/movimentacaoInternaService');

exports.upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo foi enviado' });
    }

    const { subcontaId } = req.body;
    if (!subcontaId) {
      return res.status(400).json({ erro: 'subcontaId é obrigatório' });
    }

    const importacao = await importacaoOFXService.processarArquivoOFX(
      req.file.path,
      req.file.originalname,
      subcontaId,
      req.userId
    );

    try {
      await fs.unlink(req.file.path);
    } catch (unlinkErr) {
      console.warn('[ImportacaoOFX] Erro ao remover arquivo após processamento:', unlinkErr);
    }

    const populated = await ImportacaoOFX.findById(importacao._id)
      .populate({ path: 'subconta', select: 'nome instituicao', populate: { path: 'instituicao' } });
    return res.status(201).json(populated);
  } catch (erro) {
    if (req.file?.path) {
      fs.unlink(req.file.path).catch(() => {});
    }
    console.error('[ImportacaoOFX] Erro no upload:', erro);
    const status = erro.message?.includes('não encontrada') || erro.message?.includes('não pertence')
      ? 404
      : erro.message?.includes('corrente') || erro.message?.includes('rendimento')
        ? 400
        : 500;
    return res.status(status).json({ erro: erro.message || 'Erro ao processar arquivo OFX' });
  }
};

exports.listar = async (req, res) => {
  try {
    const importacoes = await ImportacaoOFX.find({ usuario: req.userId })
      .populate({ path: 'subconta', select: 'nome instituicao', populate: { path: 'instituicao' } })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(importacoes);
  } catch (erro) {
    console.error('[ImportacaoOFX] Erro ao listar:', erro);
    return res.status(500).json({ erro: 'Erro ao listar importações OFX' });
  }
};

exports.obterDetalhes = async (req, res) => {
  try {
    const importacao = await ImportacaoOFX.findOne({
      _id: req.params.id,
      usuario: req.userId
    })
      .populate({ path: 'subconta', select: 'nome instituicao tipo', populate: { path: 'instituicao' } })
      .lean();

    if (!importacao) {
      return res.status(404).json({ erro: 'Importação OFX não encontrada' });
    }

    const transacoes = await TransacaoOFX.find({
      importacaoOFX: req.params.id,
      usuario: req.userId
    })
      .populate('transferencia', 'valor data subcontaOrigem subcontaDestino')
      .populate('transacaoCriada', 'descricao valor data tipo')
      .sort({ data: -1 })
      .lean();

    return res.json({
      ...importacao,
      transacoes
    });
  } catch (erro) {
    console.error('[ImportacaoOFX] Erro ao obter detalhes:', erro);
    return res.status(500).json({ erro: 'Erro ao obter detalhes da importação OFX' });
  }
};

exports.sugerirTransferencias = async (req, res) => {
  try {
    const transacao = await TransacaoOFX.findOne({
      _id: req.params.transacaoOFXId,
      importacaoOFX: req.params.id,
      usuario: req.userId
    }).lean();

    if (!transacao) {
      return res.status(404).json({ erro: 'Transação OFX não encontrada' });
    }

    const sugestoes = await sugerirTransferencias(
      transacao.subconta.toString(),
      transacao.valor,
      transacao.data,
      { toleranciaValor: 0.01, toleranciaDias: 3 }
    );

    return res.json(sugestoes);
  } catch (erro) {
    console.error('[ImportacaoOFX] Erro ao sugerir transferências:', erro);
    return res.status(500).json({ erro: 'Erro ao buscar sugestões' });
  }
};

exports.atualizarTransacao = async (req, res) => {
  try {
    const { descricao, status, transferenciaId } = req.body;
    const { id: importacaoId, transacaoOFXId } = req.params;

    const importacao = await ImportacaoOFX.findOne({
      _id: importacaoId,
      usuario: req.userId
    });
    if (!importacao) {
      return res.status(404).json({ erro: 'Importação OFX não encontrada' });
    }
    if (importacao.status !== 'revisao') {
      return res.status(400).json({ erro: 'Só é possível editar transações em importações com status revisao' });
    }

    const update = {};
    if (descricao !== undefined) update.descricao = descricao;
    if (status !== undefined) {
      if (!['pendente', 'aprovada', 'ignorada'].includes(status)) {
        return res.status(400).json({ erro: 'Status inválido' });
      }
      update.status = status;
    }
    if (transferenciaId !== undefined) {
      update.transferencia = transferenciaId || null;
      if (transferenciaId) {
        await Transferencia.updateOne(
          { _id: transferenciaId, usuario: req.userId },
          { $set: { status: 'concluida', transacaoOFX: transacaoOFXId } }
        );
      }
    }

    const transacao = await TransacaoOFX.findOneAndUpdate(
      {
        _id: transacaoOFXId,
        importacaoOFX: importacaoId,
        usuario: req.userId,
        status: { $ne: 'ja_importada' }
      },
      { $set: update },
      { new: true }
    )
      .populate('transferencia', 'valor data subcontaOrigem subcontaDestino')
      .lean();

    if (!transacao) {
      return res.status(404).json({ erro: 'Transação OFX não encontrada ou não pode ser editada' });
    }

    return res.json(transacao);
  } catch (erro) {
    console.error('[ImportacaoOFX] Erro ao atualizar transação:', erro);
    return res.status(500).json({ erro: 'Erro ao atualizar transação OFX' });
  }
};

exports.criarTransacao = async (req, res) => {
  try {
    const { id: importacaoId, transacaoOFXId } = req.params;

    const importacao = await ImportacaoOFX.findOne({
      _id: importacaoId,
      usuario: req.userId
    });
    if (!importacao) {
      return res.status(404).json({ erro: 'Importação OFX não encontrada' });
    }

    const transacao = await importacaoOFXService.criarTransacaoDeTransacaoOFX(
      transacaoOFXId,
      req.userId
    );

    return res.status(201).json(transacao);
  } catch (erro) {
    console.error('[ImportacaoOFX] Erro ao criar transação:', erro);
    const status = erro.message?.includes('não encontrada') ? 404 : 400;
    return res.status(status).json({ erro: erro.message || 'Erro ao criar transação' });
  }
};

exports.finalizar = async (req, res) => {
  try {
    const importacao = await importacaoOFXService.finalizarImportacaoOFX(
      req.params.id,
      req.userId
    );

    return res.json({
      mensagem: 'Importação OFX finalizada com sucesso',
      importacao
    });
  } catch (erro) {
    console.error('[ImportacaoOFX] Erro ao finalizar:', erro);
    const status = erro.message?.includes('não encontrada') ? 404 : 400;
    return res.status(status).json({ erro: erro.message || 'Erro ao finalizar importação OFX' });
  }
};

exports.cancelar = async (req, res) => {
  try {
    const importacao = await ImportacaoOFX.findOne({
      _id: req.params.id,
      usuario: req.userId
    });

    if (!importacao) {
      return res.status(404).json({ erro: 'Importação OFX não encontrada' });
    }
    if (importacao.status === 'finalizada') {
      return res.status(400).json({ erro: 'Não é possível cancelar importação já finalizada' });
    }

    await TransacaoOFX.deleteMany({
      importacaoOFX: req.params.id,
      usuario: req.userId
    });
    await ImportacaoOFX.deleteOne({ _id: req.params.id, usuario: req.userId });

    return res.status(204).send();
  } catch (erro) {
    console.error('[ImportacaoOFX] Erro ao cancelar:', erro);
    return res.status(500).json({ erro: 'Erro ao cancelar importação OFX' });
  }
};
