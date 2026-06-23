// src/utils/format.js (helpers compartilhados para Empréstimos)
import { formatDateBR } from './dateUtils';
export function formatarMoedaBRL(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataBR(data) {
  if (!data) return '';
  const d = new Date(data);
  if (isNaN(d.getTime())) return '';
  return formatDateBR(d);
}

export function calcularDiasAtraso(prazoFinal) {
  if (!prazoFinal) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(prazoFinal);
  prazo.setHours(0, 0, 0, 0);
  const diff = Math.floor((hoje - prazo) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function labelTipoRetorno(tipo) {
  const map = {
    valor_fixo: 'Valor fixo',
    sem_juros: 'Sem juros'
  };
  return map[tipo] || tipo;
}

export function labelStatus(status, isQuitadoCalculado) {
  if (status === 'cancelado') return { text: 'Cancelado', cls: 'emp-status-cancelado' };
  if (status === 'quitado' || isQuitadoCalculado) return { text: 'Quitado', cls: 'emp-status-quitado' };
  return { text: 'Ativo', cls: 'emp-status-ativo' };
}
