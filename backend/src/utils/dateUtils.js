/**
 * Normaliza uma data para meio-dia UTC (12:00:00.000Z).
 * Elimina qualquer viés de timezone, garantindo que uma mesma data calendário
 * produza o mesmo timestamp independente do fuso horário de origem.
 *
 * Aceita string ISO (YYYY-MM-DD), Date, ou timestamp numérico.
 * Retorna null se a entrada for inválida.
 */
function normalizarDataUTC(input) {
  if (!input && input !== 0) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const year = input.getUTCFullYear();
    const month = input.getUTCMonth();
    const day = input.getUTCDate();
    return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  }
  const str = String(input);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0, 0));
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

module.exports = { normalizarDataUTC };
