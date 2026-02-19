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
    width: '30%',
    borderRightWidth: 1,
    borderRightColor: colors.neutral[200],
    padding: 8,
    backgroundColor: colors.neutral[100],
  },
  tableColValue: {
    width: '70%',
    padding: 8,
  },
  text: {
    fontSize: typography.body.fontSize,
  },
  bold: {
    fontWeight: 'bold',
  },
});

const ReportFilters = ({ filterDetails = {}, categorias = [], tags = [] }) => {
  const {
    dataInicio,
    dataFim,
    selectedTipo,
    selectedPessoas,
    pessoas,
    tipo,
    tagFilters,
  } = filterDetails;

  // Backend retorna "pessoas" e "tipo"; frontend usa "selectedPessoas" e "selectedTipo"
  const pessoasFiltro = selectedPessoas ?? pessoas;
  const tipoFiltro = selectedTipo ?? tipo;

  const periodoLine =
    dataInicio && dataFim
      ? `${formatDateBR(dataInicio)} até ${formatDateBR(dataFim)}`
      : '-';

  const tipoLine =
    tipoFiltro === 'gasto'
      ? 'Gastos'
      : tipoFiltro === 'recebivel'
        ? 'Recebíveis'
        : 'Todos';

  const pessoasArray = Array.isArray(pessoasFiltro) ? pessoasFiltro : (pessoasFiltro ? [pessoasFiltro] : []);
  const pessoasLine =
    pessoasArray.length > 0
      ? pessoasArray.join(', ')
      : 'Todas';

  // Backend usa "tagsFilter", frontend usa "tagFilters"
  const tagsParaExibir = tagFilters ?? filterDetails.tagsFilter;
  let tagLine = 'Nenhuma';
  if (tagsParaExibir) {
    const tagEntries = Object.entries(tagsParaExibir)
      .filter(([, tagIds]) => tagIds && tagIds.length > 0)
      .map(([catId, tagIds]) => {
        const categoria = categorias.find((c) => c._id === catId || c.id === catId);
        const catNome = categoria?.nome || catId;
        const tagNomes = tagIds
          .map((tid) => tags.find((t) => t._id === tid || t.id === tid)?.nome || tid)
          .filter(Boolean);
        return `${catNome}: ${tagNomes.join(', ')}`;
      });
    if (tagEntries.length > 0) {
      tagLine = tagEntries.join(' | ');
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Filtros Aplicados</Text>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Período</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.text}>{periodoLine}</Text>
          </View>
        </View>
        <View style={[styles.tableRow, styles.tableRowEven]}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Tipo</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.text}>{tipoLine}</Text>
          </View>
        </View>
        <View style={styles.tableRow}>
          <View style={styles.tableCol}>
            <Text style={[styles.text, styles.bold]}>Pessoas</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.text}>{pessoasLine}</Text>
          </View>
        </View>
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
