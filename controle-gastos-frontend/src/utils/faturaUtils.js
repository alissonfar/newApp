function diasNoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

export function calcularPeriodoFatura(fechamentoFatura, anoMes) {
  if (!anoMes || anoMes.length < 7) return null;
  const ano = parseInt(anoMes.substring(0, 4), 10);
  const mes = parseInt(anoMes.substring(5, 7), 10);

  if (fechamentoFatura == null) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
    return {
      dataInicio: inicio,
      dataFim: fim,
      label: `${String(inicio.getDate()).padStart(2, '0')}/${String(inicio.getMonth() + 1).padStart(2, '0')} a ${String(fim.getDate()).padStart(2, '0')}/${String(fim.getMonth() + 1).padStart(2, '0')}`
    };
  }

  if (fechamentoFatura === 0) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
    return {
      dataInicio: inicio,
      dataFim: fim,
      label: `${String(inicio.getDate()).padStart(2, '0')}/${String(inicio.getMonth() + 1).padStart(2, '0')} a ${String(fim.getDate()).padStart(2, '0')}/${String(fim.getMonth() + 1).padStart(2, '0')}`
    };
  }

  const diaFechamento = Math.min(fechamentoFatura, diasNoMes(ano, mes));
  let dataInicio, dataFim;

  if (mes === 1) {
    dataInicio = new Date(ano - 1, 11, Math.min(fechamentoFatura, diasNoMes(ano - 1, 12)) + 1);
  } else {
    dataInicio = new Date(ano, mes - 2, Math.min(fechamentoFatura, diasNoMes(ano, mes - 1)) + 1);
  }

  dataFim = new Date(ano, mes - 1, diaFechamento, 23, 59, 59, 999);

  return {
    dataInicio,
    dataFim,
    label: `${String(dataInicio.getDate()).padStart(2, '0')}/${String(dataInicio.getMonth() + 1).padStart(2, '0')} a ${String(dataFim.getDate()).padStart(2, '0')}/${String(dataFim.getMonth() + 1).padStart(2, '0')}`
  };
}
