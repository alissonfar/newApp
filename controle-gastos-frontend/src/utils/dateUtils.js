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
  const d = new Date(date);
  const offset = -3; // Brasília UTC-3
  const localDate = new Date(d.getTime() + offset * 60 * 60 * 1000);
  return localDate.toISOString();
};

// Função para formatar uma data ISO para exibição no formato brasileiro
export const formatDateBR = (isoString) => {
  if (!isoString) return '';
  const [fullDate] = isoString.split('T');
  const [year, month, day] = fullDate.split('-');
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