import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing } from './theme';

const styles = StyleSheet.create({
  table: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    marginVertical: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomColor: colors.neutral[200],
    borderBottomWidth: 1,
    minHeight: 26,
    flexGrow: 0,
    flexShrink: 0,
  },
  tableHeader: {
    backgroundColor: colors.primary,
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightColor: colors.neutral[200],
    borderRightWidth: 1,
  },
  headerCell: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cell: {
    fontSize: typography.body.fontSize,
    textAlign: 'left',
    lineHeight: 1.35,
  },
  indexCell: {
    width: '5%',
    textAlign: 'center',
  },
  dateCell: {
    width: '12%',
    textAlign: 'center',
  },
  typeCell: {
    width: '10%',
    textAlign: 'center',
  },
  descriptionCell: {
    width: '25%',
    minWidth: 0,
  },
  personCell: {
    width: '15%',
  },
  valueCell: {
    width: '13%',
    textAlign: 'right',
  },
  tagsCell: {
    width: '20%',
    minWidth: 0,
    borderRightWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 2,
  },
  tagBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  tagBadgeText: {
    fontSize: typography.small.fontSize,
  },
  expenseText: {
    color: colors.danger,
  },
  incomeText: {
    color: colors.success,
  },
  evenRow: {
    backgroundColor: colors.neutral[50],
  },
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [fullDate] = String(dateStr).split('T');
    const [year, month, day] = fullDate.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const truncate = (str, maxLen) => {
  if (!str || str.length <= maxLen) return str || '-';
  return str.slice(0, maxLen).trim() + '...';
};

const ReportTable = ({ data = [], categorias = [], tags = [] }) => {
  const safeData = Array.isArray(data) ? data : [];
  const formatValue = (value, type) => {
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Math.abs(value));

    return type === 'DESPESA' ? `- ${formattedValue}` : formattedValue;
  };

  const getTagBadges = (item) => {
    const tagsPagamento = item.tagsPagamento || {};
    const badges = [];

    Object.entries(tagsPagamento).forEach(([catId, tagIds]) => {
      const categoria = categorias.find(
        (c) => c._id === catId || c.nome === catId
      );
      if (!categoria || !tagIds || !Array.isArray(tagIds)) return;

      tagIds.forEach((tagId) => {
        const tag = tags.find((t) => t._id === tagId || t.nome === tagId);
        if (!tag) return;

        const cor = tag.cor || categoria.cor || '#64748b';
        const label = `${categoria.nome}: ${tag.nome}`;

        badges.push(
          <View
            key={`${catId}-${tagId}`}
            style={[
              styles.tagBadge,
              {
                backgroundColor: `${cor}20`,
                borderWidth: 1,
                borderColor: cor,
              },
            ]}
          >
            <View
              style={[styles.tagBadgeDot, { backgroundColor: cor }]}
            />
            <Text style={[styles.tagBadgeText, { color: cor }]}>
              {truncate(label, 45)}
            </Text>
          </View>
        );
      });
    });

    return badges;
  };

  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeader]}>
        <View style={[styles.tableCell, styles.indexCell]}>
          <Text style={styles.headerCell}>#</Text>
        </View>
        <View style={[styles.tableCell, styles.dateCell]}>
          <Text style={styles.headerCell}>Data</Text>
        </View>
        <View style={[styles.tableCell, styles.typeCell]}>
          <Text style={styles.headerCell}>Tipo</Text>
        </View>
        <View style={[styles.tableCell, styles.descriptionCell]}>
          <Text style={styles.headerCell}>Descrição</Text>
        </View>
        <View style={[styles.tableCell, styles.personCell]}>
          <Text style={styles.headerCell}>Pessoa</Text>
        </View>
        <View style={[styles.tableCell, styles.valueCell]}>
          <Text style={styles.headerCell}>Valor</Text>
        </View>
        <View style={[styles.tableCell, styles.tagsCell]}>
          <Text style={styles.headerCell}>Tags</Text>
        </View>
      </View>

      {safeData.map((item, index) => (
        <View
          key={index}
          style={[styles.tableRow, index % 2 === 1 && styles.evenRow]}
        >
          <View style={[styles.tableCell, styles.indexCell]}>
            <Text style={styles.cell}>{index + 1}</Text>
          </View>
          <View style={[styles.tableCell, styles.dateCell]}>
            <Text style={styles.cell}>{formatDate(item.data)}</Text>
          </View>
          <View style={[styles.tableCell, styles.typeCell]}>
            <Text
              style={[
                styles.cell,
                item.tipo === 'gasto' ? styles.expenseText : styles.incomeText,
              ]}
            >
              {item.tipo === 'gasto' ? 'GASTO' : 'RECEBÍVEL'}
            </Text>
          </View>
            <View style={[styles.tableCell, styles.descriptionCell]}>
            <Text style={styles.cell}>
              {truncate(item.descricao, 90)}
            </Text>
          </View>
          <View style={[styles.tableCell, styles.personCell]}>
            <Text style={styles.cell}>{item.pessoa || '-'}</Text>
          </View>
          <View style={[styles.tableCell, styles.valueCell]}>
            <Text
              style={[
                styles.cell,
                item.tipo === 'gasto' ? styles.expenseText : styles.incomeText,
              ]}
            >
              {formatValue(
                item.valorPagamento,
                item.tipo === 'gasto' ? 'DESPESA' : 'RECEITA'
              )}
            </Text>
          </View>
            <View style={[styles.tableCell, styles.tagsCell]}>
            {(() => {
              const badges = getTagBadges(item);
              return badges.length > 0 ? badges : <Text style={styles.cell}>-</Text>;
            })()}
          </View>
        </View>
      ))}
    </View>
  );
};

export default ReportTable;
