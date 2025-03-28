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
    width: '30%',
    borderRightWidth: 1,
    borderRightColor: '#bdc3c7',
    padding: 5,
    backgroundColor: '#ecf0f1'
  },
  tableColValue: {
    width: '70%',
    padding: 5
  },
  text: {
    fontSize: 10
  },
  bold: {
    fontWeight: 'bold'
  }
});

const ReportFilters = ({ filterDetails }) => {
  const {
    dataInicio,
    dataFim,
    selectedTipo,
    selectedPessoas,
    tagFilters
  } = filterDetails;

  // Formata o período
  const periodoLine = `${dataInicio || '-'} até ${dataFim || '-'}`;

  // Formata o tipo
  const tipoLine = selectedTipo === 'gasto' ? 'Gastos' : 
                  selectedTipo === 'recebivel' ? 'Recebíveis' : 'Todos';

  // Formata as pessoas selecionadas
  const pessoasLine = (selectedPessoas && selectedPessoas.length > 0)
    ? selectedPessoas.join(', ')
    : 'Todas';

  // Formata as tags
  let tagLine = "Nenhuma";
  if (tagFilters) {
    const tagEntries = Object.entries(tagFilters)
      .filter(([cat, tags]) => tags && tags.length > 0)
      .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`);
    if (tagEntries.length > 0) {
      tagLine = tagEntries.join(' | ');
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Filtros Aplicados</Text>
      <View style={styles.table}>
        {/* Período */}
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Período</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.text}>{periodoLine}</Text>
          </View>
        </View>

        {/* Tipo */}
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Tipo</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.text}>{tipoLine}</Text>
          </View>
        </View>

        {/* Pessoas */}
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Pessoas</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.text}>{pessoasLine}</Text>
          </View>
        </View>

        {/* Tags */}
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Tags</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.text}>{tagLine}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default ReportFilters; 