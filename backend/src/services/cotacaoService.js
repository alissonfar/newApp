const cache = new Map();
const TTL_CACHE = 60 * 60 * 1000;

async function obterCotacao(par) {
  const chave = par.toUpperCase();
  const cached = cache.get(chave);
  if (cached && Date.now() - cached.ts < TTL_CACHE) {
    return cached.valor;
  }
  try {
    const response = await fetch('https://economia.awesomeapi.com.br/json/last/' + chave, {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.warn('[Cotacao] HTTP ' + response.status + ' para ' + chave);
      return null;
    }
    const data = await response.json();
    const key = chave.replace('-', '');
    if (!data[key] || !data[key].bid) {
      console.warn('[Cotacao] Resposta inesperada:', JSON.stringify(data).slice(0, 200));
      return null;
    }
    const valor = parseFloat(data[key].bid);
    if (isNaN(valor) || valor <= 0) return null;
    cache.set(chave, { valor, ts: Date.now() });
    return valor;
  } catch (err) {
    console.warn('[Cotacao] Erro ao buscar ' + chave + ':', err.message);
    return null;
  }
}

async function converterSeMoedaEstrangeira(tx) {
  const resultado = {
    valorConvertido: Math.abs(parseFloat(tx.amount) || 0),
    moedaOriginal: null,
    cotacaoUsada: null,
    valorOriginal: null
  };
  if (!tx.currencyCode || tx.currencyCode === 'BRL') return resultado;
  resultado.moedaOriginal = tx.currencyCode;
  resultado.valorOriginal = Math.abs(parseFloat(tx.amount) || 0);
  if (tx.amountInAccountCurrency != null) {
    resultado.valorConvertido = Math.abs(parseFloat(tx.amountInAccountCurrency));
    const rawAmount = Math.abs(parseFloat(tx.amount));
    resultado.cotacaoUsada = rawAmount !== 0 ? resultado.valorConvertido / rawAmount : null;
  } else {
    const cotacao = await obterCotacao(tx.currencyCode + '-BRL');
    if (cotacao) {
      resultado.cotacaoUsada = cotacao;
      resultado.valorConvertido = resultado.valorOriginal * cotacao;
    }
  }
  return resultado;
}

function limparCache() {
  cache.clear();
}

module.exports = { obterCotacao, converterSeMoedaEstrangeira, limparCache };
