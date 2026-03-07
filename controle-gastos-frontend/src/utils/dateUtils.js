// Função para obter a data atual no fuso horário de Brasília
export const getCurrentDateBR = () => {
  const now = new Date();
  // Ajusta para o fuso horário de Brasília (UTC-3)
  const offset = -3;
  const brasiliaTime = new Date(now.getTime() + offset * 60 * 60 * 1000);
  return brasiliaTime;
};

// Função para converter uma data para o formato ISO mantendo o fuso horário de Brasília
export const toISOStringBR = (date) => {
  if (!date) return '';
  // Cria uma data a partir do input, que deve estar no formato YYYY-MM-DD
  const [year, month, day] = date.split('-').map(Number);
  // Cria uma nova data usando o fuso horário local
  const d = new Date(year, month - 1, day, 12, 0, 0);
  return d.toISOString();
};

// Função para formatar uma data ISO ou Date para exibição no formato brasileiro
export const formatDateBR = (isoStringOrDate) => {
  if (!isoStringOrDate) return '';
  const str = typeof isoStringOrDate === 'string'
    ? isoStringOrDate
    : (isoStringOrDate instanceof Date ? isoStringOrDate.toISOString() : String(isoStringOrDate));
  const [fullDate] = str.split('T');
  if (!fullDate) return '';
  const parts = fullDate.split('-');
  if (parts.length < 3) return '';
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

// Função para obter a data atual no formato YYYY-MM-DD
export const getTodayBR = () => {
  const now = getCurrentDateBR();
  return now.toISOString().split('T')[0];
};

// Função para obter a data de ontem no formato YYYY-MM-DD
export const getYesterdayBR = () => {
  const now = getCurrentDateBR();
  now.setDate(now.getDate() - 1);
  return now.toISOString().split('T')[0];
};

/**
 * Períodos rápidos disponíveis (compatível com Relatório e Recebimentos)
 */
export const PERIODOS_RAPIDOS = {
  MES_ATUAL: 'MES_ATUAL',
  MES_ANTERIOR: 'MES_ANTERIOR',
  ULTIMOS_7_DIAS: 'ULTIMOS_7_DIAS',
  ULTIMOS_15_DIAS: 'ULTIMOS_15_DIAS',
  ULTIMOS_30_DIAS: 'ULTIMOS_30_DIAS',
  ULTIMOS_60_DIAS: 'ULTIMOS_60_DIAS',
  ULTIMOS_3_MESES: 'ULTIMOS_3_MESES',
  ULTIMOS_6_MESES: 'ULTIMOS_6_MESES',
  ULTIMOS_12_MESES: 'ULTIMOS_12_MESES',
  ESTE_ANO: 'ESTE_ANO',
  PERSONALIZADO: 'PERSONALIZADO'
};

/**
 * Retorna { dataInicio, dataFim } em formato YYYY-MM-DD para um período rápido.
 * Reutilizado por Relatório e Recebimentos - DRY obrigatório.
 * @param {string} period - Uma das chaves de PERIODOS_RAPIDOS (exceto PERSONALIZADO)
 * @returns {{ dataInicio: string, dataFim: string } | null}
 */
export const getDateRangeForPeriod = (period) => {
  if (!period || period === PERIODOS_RAPIDOS.PERSONALIZADO) return null;

  const now = getCurrentDateBR();
  let start;
  let end;

  switch (period) {
    case PERIODOS_RAPIDOS.MES_ATUAL:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case PERIODOS_RAPIDOS.MES_ANTERIOR: {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
      end = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
      break;
    }
    case PERIODOS_RAPIDOS.ULTIMOS_7_DIAS:
      end = new Date(now);
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case PERIODOS_RAPIDOS.ULTIMOS_15_DIAS:
      end = new Date(now);
      start = new Date(now);
      start.setDate(start.getDate() - 15);
      break;
    case PERIODOS_RAPIDOS.ULTIMOS_30_DIAS:
      end = new Date(now);
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      break;
    case PERIODOS_RAPIDOS.ULTIMOS_60_DIAS:
      end = new Date(now);
      start = new Date(now);
      start.setDate(start.getDate() - 60);
      break;
    case PERIODOS_RAPIDOS.ULTIMOS_3_MESES:
      end = new Date(now);
      start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      break;
    case PERIODOS_RAPIDOS.ULTIMOS_6_MESES:
      end = new Date(now);
      start = new Date(now);
      start.setMonth(start.getMonth() - 6);
      break;
    case PERIODOS_RAPIDOS.ULTIMOS_12_MESES:
      end = new Date(now);
      start = new Date(now);
      start.setMonth(start.getMonth() - 12);
      break;
    case PERIODOS_RAPIDOS.ESTE_ANO:
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      return null;
  }

  const toStringDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    dataInicio: toStringDate(start),
    dataFim: toStringDate(end)
  };
}; 