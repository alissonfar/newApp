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

      const valorStr = registro['Valor'] ? registro['Valor'].toString() : '0';
      const valorOriginal = parseFloat(valorStr.replace(',', '.')) || 0;
      const valor = Math.abs(valorOriginal);

      const dataStr = registro['Data'];
      const [diaExt, mesExt, anoExt] = dataStr ? dataStr.split('/') : [null, null, null];
      const data = (diaExt && mesExt && anoExt)
        ? new Date(Date.UTC(parseInt(anoExt, 10), parseInt(mesExt, 10) - 1, parseInt(diaExt, 10), 12, 0, 0))
        : new Date(Date.UTC(1970, 0, 1, 12, 0, 0));

      const tipo = valorOriginal < 0 ? 'gasto' : 'recebivel';
      const descricao = registro['Descrição'] || registro['DescriÃ§Ã£o'] || registro['Descricao'] || 'Transação Extrato';
      const identificador = registro['Identificador'] || null;
      const observacao = `Importado do Extrato Nubank - ID: ${identificador || 's/id'}`;

      let grupo = registro['Grupo'] || registro['installmentGroupId'] || null;
      const parcelaNum = registro['Parcela'] != null ? parseInt(registro['Parcela'], 10) : null;
      const totalParcelas = registro['TotalParcelas'] != null ? parseInt(registro['TotalParcelas'], 10) : null;
      const isInstallment = grupo != null && parcelaNum != null && totalParcelas != null;
      if (isInstallment && grupo && typeof grupo === 'string' && !/^[a-fA-F0-9]{24}$/.test(grupo)) {
        grupo = crypto.createHash('md5').update(grupo).digest('hex').substring(0, 24);
      }

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
      if (isInstallment) {
        obj.isInstallment = true;
        obj.installmentGroupId = grupo;
        obj.installmentNumber = parcelaNum;
        obj.installmentTotal = totalParcelas;
        const intervalDias = registro['IntervaloDias'] != null ? parseInt(registro['IntervaloDias'], 10) : null;
        obj.installmentIntervalDays = (intervalDias != null && intervalDias >= 1) ? intervalDias : 30;
      }
      return obj;
    });
}

function match({ filename = '', cabecalho = [] }) {
  const cab = new Set(cabecalho);
  if (cab.has('Data') && cab.has('Valor') && (cab.has('Descrição') || cab.has('DescriÃ§Ã£o') || cab.has('Descricao'))) {
    let score = 0.9;
    if (/nubank|extrato/i.test(filename)) score = 0.99;
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
  id: 'nubank_extrato',
  nome: 'Extrato Nubank',
  extensao: ['csv'],
  match,
  parse
};
