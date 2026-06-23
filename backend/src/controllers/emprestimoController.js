// src/controllers/emprestimoController.js
const mongoose = require('mongoose');
const Emprestimo = require('../models/emprestimo');
const Pessoa = require('../models/pessoa');
const Transacao = require('../models/transacao');
const service = require('../services/emprestimoService');

function toObjectId(id) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

exports.listar = async (req, res) => {
  try {
    const { status, pessoaId, prazoAte, prazoApartirDe } = req.query;
    const filtro = { usuario: req.userId };

    if (status) {
      const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length) filtro.status = { $in: statuses };
    }
    if (pessoaId) {
      const oid = toObjectId(pessoaId);
      if (!oid) return res.status(400).json({ erro: 'pessoaId inválido.' });
      filtro.pessoaId = oid;
    }
    if (prazoAte || prazoApartirDe) {
      filtro.prazoFinal = {};
      if (prazoAte) filtro.prazoFinal.$lte = new Date(prazoAte);
      if (prazoApartirDe) filtro.prazoFinal.$gte = new Date(prazoApartirDe);
    }

    const emprestimos = await Emprestimo.find(filtro)
      .sort({ status: 1, prazoFinal: 1, createdAt: -1 })
      .lean();

    const resultado = await Promise.all(
      emprestimos.map(async (e) => {
        const totais = await service.calcularTotais(e._id, e.usuario);
        return {
          ...e,
          totalDisbursed: totais.totalDisbursed,
          totalReceived: totais.totalReceived,
          saldoAReceber: Math.max(0, (e.valorEsperadoRetorno || 0) - totais.totalReceived),
          lucro: totais.totalReceived - totais.totalDisbursed,
          isQuitadoCalculado: totais.totalReceived >= (e.valorEsperadoRetorno || 0) && (e.valorEsperadoRetorno || 0) > 0
        };
      })
    );

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao listar empréstimos:', error);
    res.status(500).json({ erro: 'Erro ao listar empréstimos.' });
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });
    const emprestimo = await Emprestimo.findOne({ _id: oid, usuario: req.userId });
    if (!emprestimo) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });

    const pessoa = await Pessoa.findOne({
      _id: emprestimo.pessoaId,
      usuario: req.userId
    });

    const transacoes = await Transacao.find({
      emprestimoId: emprestimo._id,
      usuario: req.userId
    })
      .sort({ data: 1, createdAt: 1 })
      .lean();

    const detalhado = await service.obterEmprestimoComTotais(emprestimo);

    res.json({
      ...detalhado,
      pessoa: pessoa || null,
      transacoes
    });
  } catch (error) {
    console.error('Erro ao obter empréstimo:', error);
    res.status(500).json({ erro: 'Erro ao obter empréstimo.' });
  }
};

exports.criar = async (req, res) => {
  const erros = service.validarDadosEmprestimo(req.body, { parcial: false });
  if (erros.length) return res.status(400).json({ erro: erros.join(' ') });

  try {
    const pessoaOid = toObjectId(req.body.pessoaId);
    if (!pessoaOid) return res.status(400).json({ erro: 'pessoaId inválido.' });

    const pessoa = await Pessoa.findOne({ _id: pessoaOid, usuario: req.userId, ativo: true });
    if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada ou inativa.' });

    const novo = new Emprestimo({
      usuario: req.userId,
      pessoaId: pessoa._id,
      pessoaNomeSnapshot: pessoa.nome,
      pessoaContatoSnapshot: pessoa.contato || null,
      valorEsperadoRetorno: req.body.valorEsperadoRetorno,
      tipoRetorno: req.body.tipoRetorno || 'valor_fixo',
      prazoFinal: req.body.prazoFinal,
      observacao: req.body.observacao || null,
      status: 'ativo'
    });
    await novo.save();
    const detalhado = await service.obterEmprestimoComTotais(novo);
    res.status(201).json(detalhado);
  } catch (error) {
    console.error('Erro ao criar empréstimo:', error);
    res.status(500).json({ erro: 'Erro ao criar empréstimo.', detalhe: error.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });
    const emprestimo = await Emprestimo.findOne({ _id: oid, usuario: req.userId });
    if (!emprestimo) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
    if (emprestimo.status === 'cancelado') {
      return res.status(400).json({ erro: 'Empréstimo cancelado não pode ser editado.' });
    }

    const transacoesVinculadas = await Transacao.countDocuments({
      emprestimoId: emprestimo._id,
      usuario: req.userId,
      status: 'ativo'
    });

    if (req.body.pessoaId !== undefined && transacoesVinculadas > 0) {
      return res.status(400).json({
        erro: 'Não é possível alterar a pessoa de um empréstimo com transações vinculadas.'
      });
    }

    if (req.body.pessoaId !== undefined) {
      const pessoaOid = toObjectId(req.body.pessoaId);
      if (!pessoaOid) return res.status(400).json({ erro: 'pessoaId inválido.' });
      const pessoa = await Pessoa.findOne({ _id: pessoaOid, usuario: req.userId, ativo: true });
      if (!pessoa) return res.status(404).json({ erro: 'Pessoa não encontrada ou inativa.' });
      emprestimo.pessoaId = pessoa._id;
      emprestimo.pessoaNomeSnapshot = pessoa.nome;
      emprestimo.pessoaContatoSnapshot = pessoa.contato || null;
    }
    if (req.body.valorEsperadoRetorno !== undefined) {
      if (req.body.valorEsperadoRetorno < 0) {
        return res.status(400).json({ erro: 'valorEsperadoRetorno não pode ser negativo.' });
      }
      emprestimo.valorEsperadoRetorno = req.body.valorEsperadoRetorno;
    }
    if (req.body.tipoRetorno !== undefined) {
      if (!service.TIPOS_RETORNO.includes(req.body.tipoRetorno)) {
        return res.status(400).json({ erro: 'tipoRetorno inválido.' });
      }
      emprestimo.tipoRetorno = req.body.tipoRetorno;
    }
    if (req.body.prazoFinal !== undefined) {
      emprestimo.prazoFinal = req.body.prazoFinal;
    }
    if (req.body.observacao !== undefined) {
      emprestimo.observacao = req.body.observacao || null;
    }

    const erros = service.validarDadosEmprestimo({
      pessoaId: emprestimo.pessoaId,
      valorEsperadoRetorno: emprestimo.valorEsperadoRetorno,
      tipoRetorno: emprestimo.tipoRetorno,
      prazoFinal: emprestimo.prazoFinal
    }, { parcial: false });
    if (erros.length) return res.status(400).json({ erro: erros.join(' ') });

    await emprestimo.save();
    await service.recalcularStatus(emprestimo._id, req.userId);
    const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: req.userId });
    const detalhado = await service.obterEmprestimoComTotais(atualizado);
    res.json(detalhado);
  } catch (error) {
    console.error('Erro ao atualizar empréstimo:', error);
    res.status(500).json({ erro: 'Erro ao atualizar empréstimo.', detalhe: error.message });
  }
};

exports.cancelar = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });
    const emprestimo = await Emprestimo.findOne({ _id: oid, usuario: req.userId });
    if (!emprestimo) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
    if (emprestimo.status === 'cancelado') {
      return res.status(400).json({ erro: 'Empréstimo já está cancelado.' });
    }
    emprestimo.status = 'cancelado';
    await emprestimo.save();
    res.json({ mensagem: 'Empréstimo cancelado.', emprestimo: await service.obterEmprestimoComTotais(emprestimo) });
  } catch (error) {
    console.error('Erro ao cancelar empréstimo:', error);
    res.status(500).json({ erro: 'Erro ao cancelar empréstimo.' });
  }
};

exports.listarTransacoes = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });
    const emprestimo = await Emprestimo.findOne({ _id: oid, usuario: req.userId });
    if (!emprestimo) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });

    const transacoes = await Transacao.find({
      emprestimoId: emprestimo._id,
      usuario: req.userId
    })
      .sort({ data: 1, createdAt: 1 })
      .lean();

    const detalhado = transacoes.map((t) => ({
      id: t._id,
      data: t.data,
      tipo: t.tipo,
      descricao: t.descricao,
      valor: t.valor,
      status: t.status,
      emprestimoEhJurosAuto: !!t.emprestimoEhJurosAuto
    }));

    res.json({
      emprestimo: await service.obterEmprestimoComTotais(emprestimo),
      transacoes: detalhado
    });
  } catch (error) {
    console.error('Erro ao listar transações do empréstimo:', error);
    res.status(500).json({ erro: 'Erro ao listar transações.' });
  }
};
