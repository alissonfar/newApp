const crypto = require('crypto');

function stripBOM(s) {
  return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function parse({ conteudo, delimitador = ',' }) {
  conteudo = stripBOM(conteudo);
  const linhas = conteudo.split(/\r?\n/);
  if (linhas.length < 2) {
    return [];
  }
  const cabecalho = linhas[0].split(delimitador).map(c => c.trim().replace(/^"|"$/g, ''));

  return linhas
    .slice(1)
    .filter(linha => linha.trim())
    .map(linha => {
      const valores = splitLinha(linha, delimitador);
      const registro = {};
      cabecalho.forEach((col, idx) => { registro[col] = (valores[idx] || '').trim(); });

      const [ano, mes, dia] = String(registro['date'] || '').split('-');
      const data = (ano && mes && dia)
        ? new Date(Date.UTC(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10), 12, 0, 0))
        : new Date(Date.UTC(1970, 0, 1, 12, 0, 0));

      const valor = Math.abs(parseFloat(registro['amount']) || 0);
      const descricao = registro['title'] || 'Transação Fatura';
      const tipo = 'gasto';
      const identificador = null;
      const observacao = 'Importado da Fatura Nubank';

      const obj = {
        descricao,
        valor,
        data,
        tipo,
        categoria: null,
        identificador,
        observacao,
        dadosOriginais: registro,
        pagamentos: [{ pessoa: 'Titular', valor, tags: {} }]
      };
      return obj;
    });
}

function match({ filename = '', cabecalho = [] }) {
  const cab = new Set(cabecalho);
  if (cab.has('date') && cab.has('title') && cab.has('amount')) {
    let score = 0.9;
    if (/nubank|fatura/i.test(filename)) score = 0.99;
    return score;
  }
  return 0;
}

function splitLinha(linha, delimitador) {
  const out = [];
  let atual = '';
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const ch = linha[i];
    if (ch === '"') {
      dentroAspas = !dentroAspas;
      continue;
    }
    if (ch === delimitador && !dentroAspas) {
      out.push(atual);
      atual = '';
      continue;
    }
    atual += ch;
  }
  out.push(atual);
  return out;
}

module.exports = {
  id: 'nubank_fatura',
  nome: 'Fatura Nubank',
  extensao: ['csv'],
  tipoDestino: 'fatura_cartao',
  match,
  parse
};
