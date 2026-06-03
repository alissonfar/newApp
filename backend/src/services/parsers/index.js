const nubankFatura = require('./nubankFatura');
const nubankExtrato = require('./nubankExtrato');
const genericoCSV = require('./genericoCSV');
const jsonParser = require('./jsonParser');

const PARSERS = [nubankFatura, nubankExtrato, genericoCSV, jsonParser];

function stripBOM(s) {
  return s && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function extrairCabecalhoCSV(conteudo, delimitador = ',') {
  const primeira = (conteudo.split(/\r?\n/)[0] || '');
  return primeira.split(delimitador).map(c => c.trim().replace(/^"|"$/g, ''));
}

function detectar({ filename, conteudo }) {
  if (!conteudo || typeof conteudo !== 'string') {
    throw new Error('Conteúdo vazio ou inválido para detecção.');
  }
  const lower = (filename || '').toLowerCase();
  const isJson = lower.endsWith('.json') || (conteudo.trim().startsWith('{') || conteudo.trim().startsWith('['));
  let cabecalho = [];
  if (!isJson) {
    const safeConteudo = stripBOM(conteudo);
    const delim = genericoCSV.detectarDelimitador
      ? genericoCSV.detectarDelimitador(safeConteudo)
      : { delimitador: ',' };
    cabecalho = extrairCabecalhoCSV(safeConteudo, delim.delimitador);
  }

  let melhor = null;
  for (const p of PARSERS) {
    const score = (p.match && p.match({ filename, cabecalho, conteudo })) || 0;
    if (!melhor || score > melhor.score) {
      melhor = { parser: p, score };
    }
  }
  if (!melhor || melhor.score <= 0) {
    throw new Error('Não foi possível identificar o formato do arquivo. Envie um CSV com cabeçalho contendo descrição/valor/data, ou um JSON válido.');
  }
  return { ...melhor, cabecalho };
}

function parse({ conteudo, filename, parserHint = null }) {
  const det = parserHint
    ? { parser: PARSERS.find(p => p.id === parserHint) || null, score: parserHint ? 1 : 0, cabecalho: [] }
    : detectar({ filename, conteudo });
  if (!det.parser) {
    throw new Error('Parser não encontrado para o formato fornecido.');
  }
  const safe = stripBOM(conteudo);
  const opts = { conteudo: safe };
  if (det.parser.id === 'json') {
    return det.parser.parse(opts);
  }
  return det.parser.parse(opts);
}

function listarPares() {
  return PARSERS.map(p => ({ id: p.id, nome: p.nome, extensao: p.extensao }));
}

module.exports = {
  detectar,
  parse,
  listarPares,
  PARSERS
};
