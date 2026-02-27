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