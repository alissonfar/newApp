/**
 * Formata valor numérico como moeda brasileira (R$ X.XXX,XX)
 * @param {number} valor - Valor a formatar
 * @returns {string} Valor formatado (ex: "R$ 1.234,56")
 */
export const formatarMoeda = (valor) => {
  const num = typeof valor === 'number' ? valor : parseFloat(valor) || 0;
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
