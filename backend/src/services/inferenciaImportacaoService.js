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

const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

function extrairVencimentoDoNome(filename) {
  if (!filename) return null;
  const datas = extrairDatasDoNome(filename);
  if (datas.length === 0) return null;
  // Preferir datas mais "completas" (com dia). Se houver mais de uma, pegar a última
  // (geralmente Nubank usa sufixo YYYY-MM-DD com vencimento).
  const comDia = datas.filter(d => d.dia > 1);
  if (comDia.length > 0) {
    return comDia[comDia.length - 1];
  }
  return datas[datas.length - 1];
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function sugerirTitulo({ filename, parserId, competencia, dataInicial, dataFinal, vencimento, numeroComplemento }) {
  // Caso especial: Fatura de Cartão de Crédito Nubank
  if (parserId === 'nubank_fatura' && (competencia || vencimento)) {
    const compFmt = formatarCompetenciaPT(competencia) || 'Fatura';
    let venceStr = '';
    if (vencimento) {
      const v = new Date(vencimento);
      if (!isNaN(v.getTime())) {
        venceStr = ` (vence ${pad2(v.getUTCDate())}/${pad2(v.getUTCMonth() + 1)})`;
      }
    }
    const complemento = (numeroComplemento != null && numeroComplemento > 0)
      ? ' - ' + numeroComplemento + '\u00ba Complemento'
      : '';
    return `Fatura Nubank - ${compFmt}${venceStr}${complemento}`;
  }

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
      tituloSugerido: null,
      vencimento: null,
      mesVencimento: null,
      isFaturaCartao: false,
      sugerirComplementarAutomaticamente: false
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

  // Detecção específica de Fatura de Cartão
  const isFaturaCartao = parserId === 'nubank_fatura' || parserId === 'pluggy_fatura';
  let vencimento = null;
  let mesVencimento = null;
  if (isFaturaCartao) {
    const v = extrairVencimentoDoNome(filename);
    if (v) {
      vencimento = new Date(Date.UTC(v.ano, v.mes - 1, v.dia, 12, 0, 0));
      mesVencimento = `${v.ano}-${pad2(v.mes)}`;
    }
  }

  const tituloSugerido = sugerirTitulo({
    filename,
    parserId,
    competencia: periodoCompetencia,
    dataInicial,
    dataFinal,
    vencimento,
    numeroComplemento: 1 // default no preview inicial
  });

  return {
    dataInicial,
    dataFinal,
    periodoCompetencia,
    totalRegistros: transacoes.length,
    totalCreditos,
    totalDebitos,
    tituloSugerido,
    vencimento,
    mesVencimento,
    isFaturaCartao,
    sugerirComplementarAutomaticamente: isFaturaCartao
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

/**
 * Normaliza o nome de uma tag para comparação (remove acentos, lowercase, normaliza separadores).
 */
function normalizarNomeTag(nome) {
  if (!nome) return '';
  return String(nome)
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[_\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Procura uma tag cujo nome normalizado bate com o mês/ano de vencimento.
 * Tolerante a: "Junho 2026", "Junho/2026", "Jun 2026", "Jun/2026", "06/2026", "2026-06".
 */
function tagCorrespondeMes(tag, mesVencimento) {
  if (!tag || !tag.nome || !mesVencimento) return false;
  const [anoStr, mesStr] = mesVencimento.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  if (!ano || !mes) return false;
  const nomeNorm = normalizarNomeTag(tag.nome);
  if (!nomeNorm) return false;
  const nomeCompleto = MESES_NOMES[mes - 1].toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const abrev = MESES_ABREV[mes - 1].toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const mesPad = pad2(mes);
  // Padrões candidatos (todos sem acento, sem separadores não-espaciais)
  const candidatos = [
    `${nomeCompleto} ${ano}`,
    `${abrev} ${ano}`,
    `${mesPad} ${ano}`,
    `${ano} ${mesPad}`,
    `${ano} ${nomeCompleto}`,
    `${ano} ${abrev}`
  ];
  for (const cand of candidatos) {
    if (nomeNorm === cand) return true;
  }
  return false;
}

/**
 * Gera o nome canônico da tag: "Junho 2026" (PT-BR, completo).
 */
function nomeTagMes(mesVencimento) {
  if (!mesVencimento) return null;
  const [anoStr, mesStr] = mesVencimento.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  if (!ano || !mes || mes < 1 || mes > 12) return null;
  return `${MESES_NOMES[mes - 1]} ${ano}`;
}

/**
 * Infere a tag de fatura do mês.
 * - Se categoriaCartaoId for null → retorna { tagSugerida: null, motivo: 'categoria_nao_configurada' }
 * - Se a categoria configurada não existir (foi deletada) → retorna { tagSugerida: null, motivo: 'categoria_deletada' }
 * - Caso contrário, busca tag pelo nome do mês na categoria. Se não existir, auto-cria.
 *
 * @param {Object} params
 * @param {String|null} params.categoriaCartaoId
 * @param {Array} params.tags - tags do usuário
 * @param {String} params.parserId
 * @param {String} params.mesVencimento - 'YYYY-MM'
 * @param {Object} params.Categoria - model Categoria
 * @param {Object} params.Tag - model Tag
 * @param {String} params.usuarioId
 * @returns {Object} { categoriaId, categoriaNome, tagId, tagNome, cor, icone, autoCriada } | { tagSugerida: null, motivo }
 */
async function inferirTagPorMes({ categoriaCartaoId, tags, parserId, mesVencimento, Categoria, Tag, usuarioId }) {
  if (!categoriaCartaoId) {
    return { tagSugerida: null, motivo: 'categoria_nao_configurada' };
  }
  // Verificar se a categoria configurada ainda existe
  const categoria = await Categoria.findOne({ _id: categoriaCartaoId, usuario: usuarioId }).lean();
  if (!categoria) {
    return { tagSugerida: null, motivo: 'categoria_deletada' };
  }
  if (!mesVencimento) {
    return { tagSugerida: null, motivo: 'mes_vencimento_indisponivel' };
  }

  // Procura tag existente
  const tagExistente = (tags || []).find(t => {
    const catId = (t.categoria && (t.categoria._id || t.categoria)) || t.categoria;
    return String(catId) === String(categoriaCartaoId) && tagCorrespondeMes(t, mesVencimento);
  });

  if (tagExistente) {
    return {
      categoriaId: categoriaCartaoId,
      categoriaNome: categoria.nome,
      tagId: tagExistente._id,
      tagNome: tagExistente.nome,
      cor: tagExistente.cor || '#000000',
      icone: tagExistente.icone || 'tag',
      autoCriada: false
    };
  }

  // Auto-criar tag
  const nomeTag = nomeTagMes(mesVencimento);
  if (!nomeTag) {
    return { tagSugerida: null, motivo: 'mes_invalido' };
  }
  try {
    const novaTag = new Tag({
      nome: nomeTag,
      categoria: categoriaCartaoId,
      cor: '#3b82f6',
      icone: 'tag',
      ativo: true,
      mostrarNoDashboard: false,
      usuario: usuarioId
    });
    await novaTag.save();
    return {
      categoriaId: categoriaCartaoId,
      categoriaNome: categoria.nome,
      tagId: novaTag._id,
      tagNome: novaTag.nome,
      cor: novaTag.cor,
      icone: novaTag.icone,
      autoCriada: true
    };
  } catch (err) {
    // Em caso de race condition (índice único), buscar de novo
    const tagReptica = await Tag.findOne({ nome: nomeTag, usuario: usuarioId }).lean();
    if (tagReptica) {
      return {
        categoriaId: categoriaCartaoId,
        categoriaNome: categoria.nome,
        tagId: tagReptica._id,
        tagNome: tagReptica.nome,
        cor: tagReptica.cor || '#3b82f6',
        icone: tagReptica.icone || 'tag',
        autoCriada: false
      };
    }
    throw err;
  }
}

/**
 * Conta quantas importações complementares já existem para (parserId, mesVencimento).
 * Retorna 0 se nenhuma (primeira importação), 1 se já há uma, etc.
 */
async function contarComplementosAnteriores(Importacao, { usuarioId, parserId, mesVencimento }) {
  if (!mesVencimento || !parserId) return 0;
  const total = await Importacao.countDocuments({
    usuario: usuarioId,
    origem: parserId,
    tipoImportacao: 'complementar',
    mesVencimento
  });
  return total;
}

module.exports = {
  extrairMetadados,
  detectarPossivelComplementar,
  inferirCompetencia,
  extrairDatasDoNome,
  extrairVencimentoDoNome,
  formatarCompetenciaPT,
  normalizarTitulo,
  normalizarNomeTag,
  tagCorrespondeMes,
  nomeTagMes,
  sugerirTitulo,
  inferirTagPorMes,
  contarComplementosAnteriores
};
