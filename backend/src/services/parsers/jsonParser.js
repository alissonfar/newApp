const { normalizarDataUTC } = require('../../utils/dateUtils');

function parse({ conteudo }) {
  const dados = JSON.parse(conteudo);
  let transacoes = dados;
  if (transacoes && typeof transacoes === 'object' && Array.isArray(transacoes.transacoes)) {
    transacoes = transacoes.transacoes;
  }
  if (!Array.isArray(transacoes)) {
    transacoes = [transacoes];
  }
  return transacoes.map(t => ({
    ...t,
    data: t.data ? normalizarDataUTC(t.data) : t.data,
    dadosOriginais: t.dadosOriginais || t
  }));
}

function match({ filename = '', conteudo = '' }) {
  const fn = (filename || '').toLowerCase();
  if (fn.endsWith('.json')) return 0.8;
  try {
    JSON.parse(conteudo);
    return 0.7;
  } catch (e) {
    return 0;
  }
}

module.exports = {
  id: 'json',
  nome: 'JSON',
  extensao: ['json'],
  match,
  parse
};
