const crypto = require('crypto');

function stripBOM(s) {
  return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

const SINONIMOS = {
  descricao: ['descricao', 'description', 'descrição', 'historico', 'histórico', 'memo', 'title', 'nome', 'transacao', 'lancamento'],
  valor:     ['valor', 'amount', 'value', 'total', 'quantia', 'montante', 'value'],
  data:      ['data', 'date', 'dt', 'data_lancamento', 'data_lançamento', 'posted', 'dtposted', 'data_posted'],
  tipo:      ['tipo', 'type', 'trntype'],
  identificador: ['identificador', 'id', 'fitid', 'ref', 'referencia', 'referência']
};

function detectarDelimitador(conteudo) {
  const primeiraLinha = conteudo.split(/\r?\n/)[0] || '';
  const candidatos = [',', ';', '\t', '|'];
  let melhor = ',';
  let max = 0;
  for (const d of candidatos) {
    const c = primeiraLinha.split(d).length;
    if (c > max) { max = c; melhor = d; }
  }
  return { delimitador: melhor, colunas: max };
}

function acharColuna(cabecalho, sinonimos) {
  const norm = cabecalho.map(c => c.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim());
  for (const s of sinonimos) {
    const alvo = s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const idx = norm.indexOf(alvo);
    if (idx >= 0) return cabecalho[idx];
  }
  return null;
}

function detectarTipo(valor) {
  const num = parseFloat(String(valor).replace(',', '.'));
  if (isNaN(num)) return 'gasto';
  return num < 0 ? 'gasto' : 'recebivel';
}

function parseDataGenerica(str) {
  if (!str) return new Date(NaN);
  const s = String(str).trim();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
  }
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) {
    return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12, 0, 0));
  }
  if ((m = s.match(/^(\d{2})-(\d{2})-(\d{4})/))) {
    return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 12, 0, 0));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(NaN) : d;
}

function parse({ conteudo, delimitador }) {
  conteudo = stripBOM(conteudo);
  const det = delimitador ? { delimitador } : detectarDelimitador(conteudo);
  const linhas = conteudo.split(/\r?\n/);
  if (linhas.length < 2) return [];

  const cabecalho = linhas[0].split(det.delimitador).map(c => c.trim().replace(/^"|"$/g, ''));
  const colDesc  = acharColuna(cabecalho, SINONIMOS.descricao);
  const colValor = acharColuna(cabecalho, SINONIMOS.valor);
  const colData  = acharColuna(cabecalho, SINONIMOS.data);
  const colTipo  = acharColuna(cabecalho, SINONIMOS.tipo);
  const colId    = acharColuna(cabecalho, SINONIMOS.identificador);

  if (!colDesc || !colValor || !colData) {
    throw new Error('CSV genérico: cabeçalho não contém colunas reconhecíveis (descricao/valor/data).');
  }

  return linhas.slice(1)
    .filter(l => l.trim())
    .map(linha => {
      const valores = splitLinha(linha, det.delimitador);
      const registro = {};
      cabecalho.forEach((col, idx) => { registro[col] = (valores[idx] || '').trim(); });

      const valorStr = registro[colValor] || '0';
      const valorOriginal = parseFloat(String(valorStr).replace(',', '.')) || 0;
      const valor = Math.abs(valorOriginal);
      const data = parseDataGenerica(registro[colData]);
      const tipo = colTipo
        ? (registro[colTipo] || '').toLowerCase().includes('receb') ? 'recebivel' : 'gasto'
        : detectarTipo(valorStr);

      return {
        descricao: registro[colDesc] || 'Transação',
        valor,
        data,
        tipo,
        categoria: null,
        identificador: colId ? (registro[colId] || null) : null,
        observacao: 'Importado de CSV',
        dadosOriginais: registro,
        pagamentos: [{ pessoa: 'Titular', valor, tags: {} }]
      };
    });
}

function match({ filename = '', cabecalho = [] }) {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const cn = new Set(cabecalho.map(norm));
  const temDesc = SINONIMOS.descricao.some(s => cn.has(norm(s)));
  const temValor = SINONIMOS.valor.some(s => cn.has(norm(s)));
  const temData = SINONIMOS.data.some(s => cn.has(norm(s)));
  if (temDesc && temValor && temData) {
    let score = 0.5;
    if (/csv|extrato|relatorio|relatório/i.test(filename)) score = 0.6;
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
  id: 'generico_csv',
  nome: 'CSV Genérico',
  extensao: ['csv'],
  match,
  parse,
  detectarDelimitador
};
