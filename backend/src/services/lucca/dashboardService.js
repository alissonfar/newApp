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

module.exports = { calcularIdade, calcularIdadeCorrigida };
