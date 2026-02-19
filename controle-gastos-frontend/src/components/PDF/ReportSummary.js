import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing } from './theme';

const formatCurrency = (value) => {
  if (value === undefined || value === null) return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return (isNaN(num) ? 0 : num).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  table: {
    display: 'table',
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    minHeight: 26,
    backgroundColor: colors.white,
  },
  tableRowEven: {
    backgroundColor: colors.neutral[50],
  },
  tableCol: {
    width: '70%',
    borderRightWidth: 1,
    borderRightColor: colors.neutral[200],
    padding: 8,
    backgroundColor: colors.neutral[100],
  },
  tableColValue: {
    width: '30%',
    padding: 8,
  },
  text: {
    fontSize: typography.body.fontSize,
  },
  bold: {
    fontWeight: 'bold',
  },
  valueText: {
    fontSize: typography.body.fontSize,
    textAlign: 'right',
  },
  negative: {
    color: colors.danger,
  },
  positive: {
    color: colors.success,
  },
  warning: {
    color: colors.warning,
  },
});

const ReportSummary = ({ summaryInfo = {}, templateUsed }) => {
  const isDevedor =
    templateUsed === 'devedor' ||
    (summaryInfo && 'totalBruto' in summaryInfo && 'totalDevido' in summaryInfo);

  const {
    totalTransactions = 0,
    totalValue = 0,
    totalPeople = 0,
    averagePerPerson = 0,
    totalGastos = 0,
    totalRecebiveis = 0,
    netValue = 0,
    totalBruto = 0,
    totalPago = 0,
    totalDevido = 0,
    totalRows = 0,
  } = summaryInfo;

  if (isDevedor) {
    const totalDevidoNum = parseFloat(totalDevido);
    const devidoStyle =
      totalDevidoNum >= 0 ? styles.warning : styles.negative;

    return (
      <View style={styles.section}>
        <Text style={styles.title}>Resumo - Relatório de Devedor</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={styles.tableCol}>
              <Text style={[styles.text, styles.bold]}>Total Bruto</Text>
            </View>
            <View style={styles.tableColValue}>
              <Text style={styles.valueText}>{formatCurrency(totalBruto)}</Text>
            </View>
          </View>
          <View style={[styles.tableRow, styles.tableRowEven]}>
            <View style={styles.tableCol}>
              <Text style={[styles.text, styles.bold]}>Total Pago</Text>
            </View>
            <View style={styles.tableColValue}>
              <Text style={[styles.valueText, styles.positive]}>
                {formatCurrency(totalPago)}
              </Text>
            </View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCol}>
              <Text style={[styles.text, styles.bold]}>Total Devido</Text>
            </View>
            <View style={styles.tableColValue}>
              <Text style={[styles.valueText, devidoStyle]}>
                {formatCurrency(totalDevido)}
              </Text>
            </View>
          </View>
          <View style={[styles.tableRow, styles.tableRowEven]}>
            <View style={styles.tableCol}>
              <Text style={[styles.text, styles.bold]}>Registros</Text>
            </View>
            <View style={styles.tableColValue}>
              <Text style={styles.valueText}>{totalRows}</Text>
            </View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCol}>
              <Text style={[styles.text, styles.bold]}>Pessoas</Text>
            </View>
            <View style={styles.tableColValue}>
              <Text style={styles.valueText}>{totalPeople}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Resumo Analítico</Text>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total de Transações</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>{totalTransactions}</Text>
          </View>
        </View>
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total em Valor</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>{formatCurrency(totalValue)}</Text>
          </View>
        </View>
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Número de Pessoas</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>{totalPeople}</Text>
          </View>
        </View>
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Média por Pessoa</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>
              {formatCurrency(averagePerPerson)}
            </Text>
          </View>
        </View>
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total de Gastos</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={[styles.valueText, styles.negative]}>
              {formatCurrency(totalGastos)}
            </Text>
          </View>
        </View>
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total de Recebíveis</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={[styles.valueText, styles.positive]}>
              {formatCurrency(totalRecebiveis)}
            </Text>
          </View>
        </View>
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>
              Saldo (Recebíveis - Gastos)
            </Text>
          </View>
          <View style={styles.tableColValue}>
            <Text
              style={[
                styles.valueText,
                parseFloat(netValue) >= 0 ? styles.positive : styles.negative,
              ]}
            >
              {formatCurrency(netValue)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ReportSummary;
