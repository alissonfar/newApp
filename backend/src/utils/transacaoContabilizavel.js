// src/utils/transacaoContabilizavel.js

/**
 * Adiciona ao objeto match a condição para considerar apenas transações contabilizáveis.
 *
 * REGRA DE NEGÓCIO:
 * - Gastos: SEMPRE aparecem nos relatórios. O settlementApplied serve apenas para evitar
 *   quitação dupla (não pode ser usado em outra conciliação). A TAG aplicada pelo
 *   settlement é o divisor de águas: modelos de relatório usam regras de tag (add/subtract/ignore)
 *   para decidir se o valor entra ou não no total.
 * - Recebíveis: excluir os usados em conciliação (settlementAsSource preenchido), pois o
 *   recebimento foi "consumido" para quitar gastos e não deve ser contabilizado como receita.
 *
 * @param {Object} match - Objeto de match do MongoDB (será mutado)
 * @returns {Object} O mesmo objeto match com a condição adicionada em $and
 */
function addContabilizavelCondition(match) {
  let contabilizavelCond;
  if (match.tipo === 'gasto') {
    // Gastos: nenhuma exclusão. Todos aparecem; a tag controla a contabilização nos modelos.
    return match;
  } else if (match.tipo === 'recebivel') {
    contabilizavelCond = {
      $or: [{ settlementAsSource: null }, { settlementAsSource: { $exists: false } }]
    };
  } else {
    contabilizavelCond = {
      $or: [
        { tipo: 'gasto' },
        {
          tipo: 'recebivel',
          $or: [{ settlementAsSource: null }, { settlementAsSource: { $exists: false } }]
        }
      ]
    };
  }
  match.$and = match.$and || [];
  match.$and.push(contabilizavelCond);
  return match;
}

module.exports = {
  addContabilizavelCondition
};
