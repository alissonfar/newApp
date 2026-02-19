import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing } from './theme';

const formatDateBR = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const [fullDate] = String(dateStr).split('T');
    const [year, month, day] = fullDate.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.white,
    fontSize: 10,
  },
  periodLine: {
    color: colors.white,
    fontSize: 9,
    marginBottom: 2,
  },
});

const ReportHeader = ({ filterDetails }) => {
  const currentDate = new Date().toLocaleDateString('pt-BR');
  const currentTime = new Date().toLocaleTimeString('pt-BR');

  const periodoLine =
    filterDetails?.dataInicio && filterDetails?.dataFim
      ? `${formatDateBR(filterDetails.dataInicio)} até ${formatDateBR(filterDetails.dataFim)}`
      : null;

  return (
    <View style={styles.header}>
      <Text style={styles.title}>Relatório de Transações</Text>
      {periodoLine && (
        <Text style={styles.periodLine}>Período: {periodoLine}</Text>
      )}
      <Text style={styles.subtitle}>
        Gerado em: {currentDate} às {currentTime}
      </Text>
    </View>
  );
};

export default ReportHeader;
