import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 10
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2980b9',
    marginBottom: 5,
    backgroundColor: '#f5f6fa',
    padding: 5
  },
  table: {
    display: 'table',
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#bdc3c7'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#bdc3c7',
    minHeight: 25,
    backgroundColor: '#FFFFFF'
  },
  tableRowEven: {
    backgroundColor: '#f5f6fa'
  },
  tableCol: {
    width: '70%',
    borderRightWidth: 1,
    borderRightColor: '#bdc3c7',
    padding: 5,
    backgroundColor: '#ecf0f1'
  },
  tableColValue: {
    width: '30%',
    padding: 5
  },
  text: {
    fontSize: 10
  },
  bold: {
    fontWeight: 'bold'
  },
  valueText: {
    fontSize: 10,
    textAlign: 'right'
  },
  negative: {
    color: '#e74c3c'
  },
  positive: {
    color: '#2ecc71'
  }
});

const formatCurrency = (value) => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

const ReportSummary = ({ summaryInfo }) => {
  const {
    totalTransactions = 0,
    totalValue = 0,
    totalPeople = 0,
    averagePerPerson = 0,
    totalGastos = 0,
    totalRecebiveis = 0,
    netValue = 0
  } = summaryInfo;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Resumo Analítico</Text>
      <View style={styles.table}>
        {/* Total de Transações */}
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total de Transações</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>{totalTransactions}</Text>
          </View>
        </View>

        {/* Total em Valor */}
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total em Valor</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>{formatCurrency(totalValue)}</Text>
          </View>
        </View>

        {/* Número de Pessoas */}
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Número de Pessoas</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>{totalPeople}</Text>
          </View>
        </View>

        {/* Média por Pessoa */}
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Média por Pessoa</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.valueText}>{formatCurrency(averagePerPerson)}</Text>
          </View>
        </View>

        {/* Total de Gastos */}
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total de Gastos</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={[styles.valueText, styles.negative]}>{formatCurrency(totalGastos)}</Text>
          </View>
        </View>

        {/* Total de Recebíveis */}
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Total de Recebíveis</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={[styles.valueText, styles.positive]}>{formatCurrency(totalRecebiveis)}</Text>
          </View>
        </View>

        {/* Saldo */}
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Saldo (Recebíveis - Gastos)</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text 
              style={[
                styles.valueText, 
                netValue >= 0 ? styles.positive : styles.negative
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