const MS_POR_DIA = 1000 * 60 * 60 * 24;

function calcularIdade(dataNascimento, dataReferencia = new Date()) {
  const diffMs = dataReferencia.getTime() - new Date(dataNascimento).getTime();
  const diasTotais = Math.floor(diffMs / MS_POR_DIA);
  return {
    semanas: Math.floor(diasTotais / 7),
    dias: diasTotais % 7,
    diasTotais
  };
}

function calcularIdadeCorrigida(dataNascimento, idadeGestacionalNascimento, dataReferencia = new Date()) {
  const idadeCronologica = calcularIdade(dataNascimento, dataReferencia);
  const semanasAjuste = 40 - idadeGestacionalNascimento.semanas - (idadeGestacionalNascimento.dias / 7);
  const diasAjuste = Math.round(semanasAjuste * 7);
  const diasCorrigidos = Math.max(idadeCronologica.diasTotais - diasAjuste, 0);
  return {
    semanas: Math.floor(diasCorrigidos / 7),
    dias: diasCorrigidos % 7,
    diasTotais: diasCorrigidos
  };
}

function calcularProximaMamadaEstimada(eventosAlimentacao, agora = new Date()) {
  const concluidos = eventosAlimentacao
    .filter((e) => e.fim)
    .sort((a, b) => new Date(b.inicio) - new Date(a.inicio));

  if (concluidos.length < 2) return null;

  const ultimos = concluidos.slice(0, 5);
  let somaIntervalosMs = 0;
  for (let i = 0; i < ultimos.length - 1; i++) {
    somaIntervalosMs += new Date(ultimos[i].inicio) - new Date(ultimos[i + 1].inicio);
  }
  const intervaloMedioMs = somaIntervalosMs / (ultimos.length - 1);
  const ultimaMamada = new Date(ultimos[0].inicio);
  return new Date(ultimaMamada.getTime() + intervaloMedioMs);
}

function calcularProximaSonecaEstimada(ultimoSonoFim, janelaVigiliaAlvoMinutos) {
  if (!ultimoSonoFim || !janelaVigiliaAlvoMinutos) return null;
  return new Date(new Date(ultimoSonoFim).getTime() + janelaVigiliaAlvoMinutos * 60 * 1000);
}

const PRAZO_VALIDADE_MS = {
  geladeira: 24 * 60 * 60 * 1000,
  freezer: 180 * 24 * 60 * 60 * 1000
};

const LIMIAR_ALERTA_MS = {
  geladeira: 4 * 60 * 60 * 1000,
  freezer: 7 * 24 * 60 * 60 * 1000
};

function calcularValidadeLeite(evento, agora = new Date()) {
  if (evento.armazenadoComo === 'uso_imediato') {
    return { pertoDeVencer: false, expiraEm: null };
  }
  const referencia = new Date(evento.fim || evento.inicio);
  const expiraEm = new Date(referencia.getTime() + PRAZO_VALIDADE_MS[evento.armazenadoComo]);
  const msRestantes = expiraEm.getTime() - agora.getTime();
  const pertoDeVencer = msRestantes > 0 && msRestantes <= LIMIAR_ALERTA_MS[evento.armazenadoComo];
  return { pertoDeVencer, expiraEm };
}

module.exports = {
  calcularIdade,
  calcularIdadeCorrigida,
  calcularProximaMamadaEstimada,
  calcularProximaSonecaEstimada,
  calcularValidadeLeite
};
