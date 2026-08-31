// src/utils/fechamentoResumo.js
// Helpers para ler o resumo "cru" (sem regras de tag) e o resumo "modelo" (com as regras do
// modelo de relatório da pessoa) devolvidos pelo backend em `resumoCru`/`resumoModelo`.
// O formato de `resumoModelo` varia conforme `aggregation` do modelo ('default' ou 'devedor') —
// estas funções escondem essa diferença do resto do frontend.

export function extrairValorCru(resumoCru) {
  return parseFloat(resumoCru?.totalValue) || 0;
}

export function extrairValorModelo(resumoModelo, aggregationType) {
  if (!resumoModelo) return 0;
  if (aggregationType === 'devedor') return parseFloat(resumoModelo.totalDevido) || 0;
  return parseFloat(resumoModelo.totalValue) || 0;
}

export function labelValorModelo(aggregationType) {
  return aggregationType === 'devedor' ? 'Devido (modelo)' : 'Total (modelo)';
}
