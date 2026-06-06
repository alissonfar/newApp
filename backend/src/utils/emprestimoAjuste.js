// src/utils/emprestimoAjuste.js
const mongoose = require('mongoose');

/**
 * Ajusta transações vinculadas a empréstimos concedidos para fins de relatórios.
 *
 * - Gastos com emprestimoId: zerados (não contam como gasto) e marcados com
 *   `t._emprestimoEsconderNaLista = true` (frontend oculta das listas gerais).
 * - Recebíveis com emprestimoId: valor e pagamentos ZERADOS, marcados com
 *   `t._emprestimoEsconderNaLista = true` (escondidos das listas gerais e dos
 *   cards/sumários de recebíveis). A informação de breakdown (valor original,
 *   principal, juros) é preservada em `t._emprestimoInfo` para o frontend
 *   exibir tooltip via `EmprestimoBadge`. A compensação é feita pela
 *   transação de juros auto-criada em `recalcularStatus` (que entra no
 *   aggregate normalmente como receita real).
 *
 * Mutações são feitas em cópias rasas dos objetos — o documento do banco
 * não é alterado. Esta função é usada apenas no pipeline do motor de relatórios.
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
    usuario: new mongoose.Types.ObjectId(userId),
    direcao: 'concedido'
  }).lean();

  const empById = new Map();
  for (const e of emprestimos) {
    empById.set(String(e._id), e);
  }

  const saldos = new Map();
  for (const e of emprestimos) {
    saldos.set(String(e._id), { disbursed: 0, received: 0 });
  }

  const ordenadas = [...transacoes].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  for (const t of ordenadas) {
    if (!t || !t.emprestimoId) continue;
    const empId = String(t.emprestimoId);
    if (!empById.has(empId)) continue;
    const s = saldos.get(empId);
    if (!s) continue;

    if (t.tipo === 'gasto') {
      s.disbursed += t.valor || 0;
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
      if (t.emprestimoEhJurosAuto === true) continue;

      const valorOriginal = t.valor || 0;
      const principalRestante = Math.max(0, s.disbursed - s.received);
      const principalDeste = Math.min(valorOriginal, principalRestante);
      s.received += principalDeste;
      t._emprestimoInfo = {
        tipo: 'recebimento',
        valorOriginal,
        principal: principalDeste,
        juros: valorOriginal - principalDeste
      };
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

/**
 * Calcula o ajuste de totais (gastos e recebíveis) a ser aplicado ao summary
 * após o ajuste FIFO de empréstimos.
 *
 * Estratégia: subtrai o valor INTEIRO das transações com emprestimoId (que entra
 * com valor cheio via `ajustarRecebiveisDeEmprestimo` para fins de lista).
 * A transação de juros auto-criada na quitação (`emprestimoEhJurosAuto: true`)
 * entra no aggregate e NÃO é subtraída — é a única contribuição como receita real.
 *
 * @param {Array} emprestimoIds - IDs de empréstimos referenciados nas transações filtradas
 * @param {string} userId - ID do usuário
 * @param {Object} matchAdicional - match base para o filtro de transações (sem o filtro de emprestimoId)
 * @returns {Promise<{totalGastosSubtraido: number, totalRecebiveisSubtraido: number}>}
 */
async function calcularAjusteResumoPorEmprestimo(emprestimoIds, userId, matchAdicional) {
  if (!Array.isArray(emprestimoIds) || emprestimoIds.length === 0) {
    return { totalGastosSubtraido: 0, totalRecebiveisSubtraido: 0 };
  }
  const Transacao = require('../models/transacao');

  const match = {
    ...(matchAdicional || {}),
    emprestimoId: { $in: emprestimoIds.map(id =>
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    )},
    usuario: new mongoose.Types.ObjectId(userId),
    status: 'ativo',
    emprestimoEhJurosAuto: { $ne: true }
  };

  const transacoes = await Transacao.find(match).lean();

  let totalGastosSubtraido = 0;
  let totalRecebiveisSubtraido = 0;

  for (const t of transacoes) {
    const valor = t.valor || 0;
    if (t.tipo === 'gasto') {
      totalGastosSubtraido += valor;
    } else if (t.tipo === 'recebivel') {
      totalRecebiveisSubtraido += valor;
    }
  }

  return { totalGastosSubtraido, totalRecebiveisSubtraido };
}

module.exports = { ajustarRecebiveisDeEmprestimo, calcularAjusteResumoPorEmprestimo };
