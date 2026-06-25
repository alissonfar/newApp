// src/utils/emprestimoAjuste.js
const mongoose = require('mongoose');

/**
 * Ajusta transações vinculadas a empréstimos para fins de relatórios e listas.
 *
 * Dois caminhos coexistem (design 2026-06-24):
 *  - Caminho A — TX-level legado (`t.emprestimoId` setado): zera TUDO, marca
 *    `_emprestimoEsconderNaLista: true` (frontend oculta da lista).
 *  - Caminho B — Pagamento-level novo (`pagamentos[].emprestimoId` setado,
 *    `t.emprestimoId: null`): a TX continua visível na lista, mas APENAS os
 *    pagamentos emprestados são zerados. Pagamentos não emprestados contam
 *    normalmente como gasto/recebível do usuário. Marca
 *    `_emprestimoParcial: true`.
 *
 * Outros comportamentos (mantidos):
 *  - Recebíveis com `emprestimoEhJurosAuto: true` permanecem inalterados.
 *  - Em ambos os caminhos, popula `_emprestimoInfo` no nível da TX (legado)
 *    ou no nível do pagamento (novo) com `tipo`, `pessoaNome`, `valor`.
 *
 * Mutações são feitas em cópias rasas dos objetos — o documento do banco
 * não é alterado. Esta função é usada apenas no pipeline do motor de
 * relatórios e nos endpoints que listam transações.
 *
 * @param {Array} transacoes - Transações já hidratadas (lean ou toObject)
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} mesmo array, mutado
 */
async function ajustarRecebiveisDeEmprestimo(transacoes, userId) {
  if (!Array.isArray(transacoes) || transacoes.length === 0) return transacoes;

  // Coleta todos os empréstimos envolvidos: TX-level + pagamento-level.
  const empIds = new Set();
  for (const t of transacoes) {
    if (!t) continue;
    if (t.emprestimoId) empIds.add(String(t.emprestimoId));
    if (Array.isArray(t.pagamentos)) {
      for (const p of t.pagamentos) {
        if (p && p.emprestimoId) empIds.add(String(p.emprestimoId));
      }
    }
  }
  if (empIds.size === 0) return transacoes;

  const Emprestimo = require('../models/emprestimo');
  const emprestimos = await Emprestimo.find({
    _id: { $in: [...empIds] },
    usuario: new mongoose.Types.ObjectId(userId)
  }).lean();

  const empById = new Map();
  for (const e of emprestimos) {
    empById.set(String(e._id), e);
  }

  // ====================================================================
  // CAMINHO A — TX-level legado (t.emprestimoId = X)
  // ====================================================================
  for (const t of transacoes) {
    if (!t || !t.emprestimoId) continue;
    const emp = empById.get(String(t.emprestimoId));
    if (!emp) continue;

    // Popula _emprestimoInfo mínimo (para EmprestimoBadge)
    t._emprestimoInfo = {
      tipo: t.tipo === 'gasto' ? 'desembolso' : 'recebimento',
      pessoaNome: emp.pessoaNomeSnapshot || 'pessoa',
      valor: t.valor || 0
    };

    if (t.tipo === 'gasto') {
      t.valor = 0;
      if (Array.isArray(t.pagamentos)) {
        for (const p of t.pagamentos) {
          if (p) p.valor = 0;
        }
      }
      t._emprestimoEsconderNaLista = true;
    } else if (t.tipo === 'recebivel') {
      // Transação de juros auto (criada na quitação) NÃO deve ser tocada:
      // ela já é a "receita real" do empréstimo e deve permanecer visível.
      if (t.emprestimoEhJurosAuto === true) {
        // Mas queremos que o badge apareça também na TX de juros auto
        // (ela é parte do empréstimo, mesmo que com semântica diferente)
        continue;
      }

      t.valor = 0;
      if (Array.isArray(t.pagamentos)) {
        for (const p of t.pagamentos) {
          if (p) p.valor = 0;
        }
      }
      t._emprestimoEsconderNaLista = true;
    }
  }

  // ====================================================================
  // CAMINHO B — Pagamento-level novo (pagamentos[].emprestimoId = X,
  //            t.emprestimoId = null)
  // ====================================================================
  for (const t of transacoes) {
    if (!t || t.emprestimoId) continue;            // não é caminho A
    if (!Array.isArray(t.pagamentos)) continue;
    if (!t.pagamentos.some(p => p && p.emprestimoId)) continue;

    t._emprestimoParcial = true;
    // NÃO seta _emprestimoEsconderNaLista — a TX inteira continua visível.

    let valorDescontar = 0;
    for (const p of t.pagamentos) {
      if (!p || !p.emprestimoId) continue;
      const emp = empById.get(String(p.emprestimoId));
      valorDescontar += Number(p.valor) || 0;
      p._emprestimoEsconder = true;
      p._emprestimoInfo = {
        tipo: t.tipo === 'gasto' ? 'desembolso' : 'recebimento',
        pessoaNome: emp ? (emp.pessoaNomeSnapshot || 'pessoa') : 'pessoa',
        valor: p.valor || 0
      };
      p.valor = 0;
    }

    if (t.tipo === 'gasto' || t.tipo === 'recebivel') {
      t.valor = (Number(t.valor) || 0) - valorDescontar;
    }
  }

  return transacoes;
}

module.exports = { ajustarRecebiveisDeEmprestimo };
