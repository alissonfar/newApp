const MESES_PT = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, 'março': 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12
};

function parseDataPossivel(token) {
  if (!token) return null;
  const s = String(token).trim();
  if (!s) return null;

  // YYYY-MM-DD
  let m = s.match(/^(\d{4})[-_](\d{1,2})(?:[-_](\d{1,2}))?$/);
  if (m) {
    const ano = +m[1];
    const mes = +m[2];
    const dia = m[3] ? +m[3] : 1;
    if (mes >= 1 && mes <= 12) return { ano, mes, dia };
  }

  // MM_YYYY ou MM-YYYY
  m = s.match(/^(\d{1,2})[-_/](\d{4})$/);
  if (m) {
    const mes = +m[1];
    const ano = +m[2];
    if (mes >= 1 && mes <= 12) return { ano, mes, dia: 1 };
  }

  // YYYYMM
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) {
    const ano = +m[1];
    const mes = +m[2];
    if (mes >= 1 && mes <= 12) return { ano, mes, dia: 1 };
  }

  // "janeiro 2026" / "janeiro_de_2026" / "jan-2026"
  const m2 = s.toLowerCase().match(/^([a-zçãáéíóúô]+)[_\-\s]*(\d{4})$/);
  if (m2) {
    const chave = m2[1].normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (MESES_PT[chave]) {
      return { ano: +m2[2], mes: MESES_PT[chave], dia: 1 };
    }
  }

  return null;
}

function extrairDatasDoNome(filename) {
  if (!filename) return [];
  const base = filename.replace(/\.[^.]+$/, '');
  const encontradas = [];

  // YYYY-MM-DD ou YYYY-MM
  const r1 = base.match(/(\d{4})[-_](\d{1,2})(?:[-_](\d{1,2}))?/g) || [];
  for (const m of r1) {
    const p = parseDataPossivel(m.replace(/_/g, '-'));
    if (p) encontradas.push(p);
  }

  // MM_YYYY ou MM/YYYY ou MM-YYYY
  const r2 = base.match(/(\d{1,2})[-_/](\d{4})/g) || [];
  for (const m of r2) {
    const p = parseDataPossivel(m.replace(/[\/_]/g, '-'));
    if (p) encontradas.push(p);
  }

  // YYYYMM
  const r3 = base.match(/(?<!\d)(\d{4})(\d{2})(?!\d)/g) || [];
  for (const m of r3) {
    const p = parseDataPossivel(m);
    if (p) encontradas.push(p);
  }

  // "janeiro 2026" / "janeiro_de_2026" / "jan-2026"
  const r4 = base.toLowerCase().match(/[a-zçãáéíóúô]+[_\-\s]+\d{4}/g) || [];
  for (const m of r4) {
    const p = parseDataPossivel(m.replace(/_/g, ' ').replace(/-/g, ' '));
    if (p) encontradas.push(p);
  }

  // dedupe
  const seen = new Set();
  return encontradas.filter(d => {
    const k = `${d.ano}-${d.mes}-${d.dia}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function inferirCompetencia(transacoes) {
  const contadores = {};
  for (const t of transacoes) {
    const d = new Date(t.data);
    if (isNaN(d.getTime())) continue;
    const chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    contadores[chave] = (contadores[chave] || 0) + 1;
  }
  let melhor = null;
  let max = 0;
  for (const [k, v] of Object.entries(contadores)) {
    if (v > max) { max = v; melhor = k; }
  }
  return melhor;
}

function normalizarTitulo(s) {
  if (!s) return '';
  return String(s)
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

function formatarCompetenciaPT(periodo) {
  if (!periodo) return null;
  const [ano, mes] = periodo.split('-').map(Number);
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  if (!nomes[mes - 1]) return periodo;
  return `${nomes[mes - 1]}/${ano}`;
}

function sugerirTitulo({ filename, parserId, competencia, dataInicial, dataFinal }) {
  const baseSemExtensao = (filename || '').replace(/\.[^.]+$/, '');
  const partesLimpa = baseSemExtensao
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const origem = parserId && parserId !== 'json' && parserId !== 'generico_csv'
    ? parserId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;
  const compFmt = formatarCompetenciaPT(competencia);

  if (origem && compFmt) return `${origem} - ${compFmt}`;
  if (origem) return origem;
  if (compFmt) return `Importação - ${compFmt}`;
  if (dataInicial && dataFinal) {
    return `Importação ${new Date(dataInicial).toLocaleDateString('pt-BR')} a ${new Date(dataFinal).toLocaleDateString('pt-BR')}`;
  }
  return normalizarTitulo(partesLimpa) || 'Importação';
}

function extrairMetadados({ transacoes, filename, parserId }) {
  if (!Array.isArray(transacoes) || transacoes.length === 0) {
    return {
      dataInicial: null,
      dataFinal: null,
      periodoCompetencia: null,
      totalRegistros: 0,
      totalCreditos: 0,
      totalDebitos: 0,
      tituloSugerido: null
    };
  }
  const datas = transacoes
    .map(t => new Date(t.data))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);
  const dataInicial = datas[0] || null;
  const dataFinal = datas[datas.length - 1] || null;

  let totalCreditos = 0;
  let totalDebitos = 0;
  for (const t of transacoes) {
    const v = Math.abs(parseFloat(t.valor) || 0);
    if (t.tipo === 'recebivel') totalCreditos += v;
    else if (t.tipo === 'gasto') totalDebitos += v;
  }
  totalCreditos = Math.round(totalCreditos * 100) / 100;
  totalDebitos = Math.round(totalDebitos * 100) / 100;

  const periodoCompetencia = inferirCompetencia(transacoes);
  const tituloSugerido = sugerirTitulo({
    filename,
    parserId,
    competencia: periodoCompetencia,
    dataInicial,
    dataFinal
  });

  return {
    dataInicial,
    dataFinal,
    periodoCompetencia,
    totalRegistros: transacoes.length,
    totalCreditos,
    totalDebitos,
    tituloSugerido
  };
}

async function detectarPossivelComplementar(Importacao, { usuarioId, dataInicial, dataFinal, origem }) {
  if (!dataInicial || !dataFinal) return { sugestao: false, motivo: null, sobrepostas: 0 };
  const sobrepostas = await Importacao.countDocuments({
    usuario: usuarioId,
    _id: { $ne: undefined },
    dataInicial: { $ne: null },
    dataFinal: { $ne: null },
    $or: [
      { dataInicial: { $lte: dataFinal }, dataFinal: { $gte: dataInicial } }
    ]
  });
  if (sobrepostas > 0) {
    return {
      sugestao: true,
      motivo: `Detectamos ${sobrepostas} importação(ões) com período sobreposto no mesmo usuário.`,
      sobrepostas
    };
  }
  return { sugestao: false, motivo: null, sobrepostas: 0 };
}

module.exports = {
  extrairMetadados,
  detectarPossivelComplementar,
  inferirCompetencia,
  extrairDatasDoNome,
  formatarCompetenciaPT,
  normalizarTitulo,
  sugerirTitulo
};
