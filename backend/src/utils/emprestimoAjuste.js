// src/utils/emprestimoAjuste.js
const mongoose = require('mongoose');

/**
 * Ajusta transações vinculadas a empréstimos para fins de relatórios e listas.
 *
 * Comportamento simplificado (FASE 4 do design doc):
 *  - Gastos com emprestimoId: zerados (não contam como gasto) e marcados com
 *    `t._emprestimoEsconderNaLista = true` (frontend oculta das listas gerais).
 *  - Recebíveis com emprestimoId (NÃO juros auto): valor e pagamentos ZERADOS,
 *    marcados com `t._emprestimoEsconderNaLista = true`. Sem split FIFO,
 *    sem cálculo de `principal`/`juros` no nível da transação.
 *  - TX com `emprestimoEhJurosAuto: true` permanece inalterada: ela é a
 *    "receita real" do empréstimo e deve entrar como recebível normal no
 *    summary de relatórios.
 *  - Em qualquer caso, popula `t._emprestimoInfo` com dados mínimos
 *    (tipo, pessoaNome, valor) para o `EmprestimoBadge` exibir tooltip.
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

  const empIds = new Set();
  for (const t of transacoes) {
    if (t && t.emprestimoId) {
      empIds.add(String(t.emprestimoId));
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

  return transacoes;
}

module.exports = { ajustarRecebiveisDeEmprestimo };
