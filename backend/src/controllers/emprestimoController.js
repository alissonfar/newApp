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
        const totalEsperado = totais.totalEsperado || 0;
        return {
          ...e,
          totalDisbursed: totais.totalDisbursed,
          totalReceived: totais.totalReceived,
          totalEsperado,
          saldoAReceber: Math.max(0, totalEsperado - totais.totalReceived),
          lucro: totalEsperado - totais.totalDisbursed,
          isQuitadoCalculado: totalEsperado > 0 && totais.totalReceived >= totalEsperado
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
      usuario: req.userId,
      $or: [
        { emprestimoId: emprestimo._id },                    // caminho legado (TX-level)
        { 'pagamentos.emprestimoId': emprestimo._id }        // caminho novo (pagamento-level)
      ]
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
      // valorEsperadoRetorno não é mais campo do Empréstimo — vive na Transação
      // (cada gasto vinculado carrega o seu próprio valorEsperadoRetorno).
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
    // valorEsperadoRetorno removido do Empréstimo (vive agora na Transação).
    // Mantemos um guard pra rejeitar explicitamente o campo no payload — evita
    // que código legado envie e confunda o backend.
    if (req.body.valorEsperadoRetorno !== undefined) {
      return res.status(400).json({
        erro: 'valorEsperadoRetorno não é mais campo do Empréstimo. Use o campo valorEsperadoRetorno da Transação ao criar/vincular uma despesa de Empréstimo.'
      });
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

exports.reverterQuitacao = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });

    const detalhado = await service.reverterQuitacao(oid, req.userId);
    res.json(detalhado);
  } catch (error) {
    console.error('Erro ao reverter quitação:', error);
    let status = 500;
    if (error.message.includes('não encontrado')) status = 404;
    else if (error.message.includes('Apenas empréstimos quitados')) status = 400;
    res.status(status).json({ erro: error.message });
  }
};

exports.listarTransacoes = async (req, res) => {
  try {
    const oid = toObjectId(req.params.id);
    if (!oid) return res.status(400).json({ erro: 'id inválido.' });
    const emprestimo = await Emprestimo.findOne({ _id: oid, usuario: req.userId });
    if (!emprestimo) return res.status(404).json({ erro: 'Empréstimo não encontrado.' });

    // CAMINHO A — TX-level legado (t.emprestimoId = X): 1 linha por TX.
    const txsLegado = await Transacao.find({
      emprestimoId: emprestimo._id,
      usuario: req.userId
    })
      .sort({ data: 1, createdAt: 1 })
      .lean();

    // CAMINHO B — Pagamento-level novo (pagamentos[].emprestimoId = X): 1
    // linha por PAGAMENTO emprestado. Exclui TXs já contadas no caminho A
    // (cobre t.emprestimoId = null e t.emprestimoId apontando pra outro
    // empréstimo) pra não duplicar.
    const txsPagamento = await Transacao.find({
      usuario: req.userId,
      'pagamentos.emprestimoId': emprestimo._id,
      emprestimoId: { $ne: emprestimo._id }
    })
      .sort({ data: 1, createdAt: 1 })
      .lean();

    const movimentacoes = [];

    // Caminho A: 1 linha por TX (comportamento legado preservado)
    for (const t of txsLegado) {
      movimentacoes.push({
        id: t._id,
        transacaoId: t._id,
        pagamentoIndex: null,        // null = caminho legado (TX inteira)
        pagamentoPessoa: null,
        data: t.data,
        tipo: t.tipo,
        descricao: t.descricao,
        valor: t.valor,              // valor da TX (não tem "pagamento individual")
        status: t.status,
        emprestimoEhJurosAuto: !!t.emprestimoEhJurosAuto,
        valorEsperadoRetorno: t.valorEsperadoRetorno != null ? t.valorEsperadoRetorno : null
      });
    }

    // Caminho B: 1 linha POR PAGAMENTO que tem emprestimoId
    for (const t of txsPagamento) {
      if (!Array.isArray(t.pagamentos)) continue;
      for (let i = 0; i < t.pagamentos.length; i++) {
        const p = t.pagamentos[i];
        if (p && p.emprestimoId && String(p.emprestimoId) === String(emprestimo._id)) {
          movimentacoes.push({
            id: `${t._id}-${i}`,       // ID composto: TX_id + index do pagamento
            transacaoId: t._id,
            pagamentoIndex: i,         // número = caminho novo (pagamento individual)
            pagamentoPessoa: p.pessoa || null,
            data: t.data,
            tipo: t.tipo,
            descricao: t.descricao,
            valor: p.valor,            // valor DO PAGAMENTO (não da TX)
            status: t.status,
            emprestimoEhJurosAuto: !!t.emprestimoEhJurosAuto,
            // valorEsperadoRetorno do pagamento (campo novo por-pagamento do
            // design 2026-06-24). Se o pagamento não tiver, cai pro valor da TX.
            valorEsperadoRetorno: p.valorEsperadoRetorno != null
              ? p.valorEsperadoRetorno
              : (t.valorEsperadoRetorno != null ? t.valorEsperadoRetorno : null)
          });
        }
      }
    }

    // Ordenar por data crescente (mantém determinismo entre chamadas)
    movimentacoes.sort((a, b) => new Date(a.data) - new Date(b.data));

    res.json({
      emprestimo: await service.obterEmprestimoComTotais(emprestimo),
      transacoes: movimentacoes
    });
  } catch (error) {
    console.error('Erro ao listar transações do empréstimo:', error);
    res.status(500).json({ erro: 'Erro ao listar transações.' });
  }
};
