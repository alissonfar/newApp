import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  table: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#bdc3c7',
    borderBottomWidth: 1,
    minHeight: 24,
    flexGrow: 0,
    flexShrink: 0,
  },
  tableHeader: {
    backgroundColor: '#2980b9',
  },
  tableCell: {
    padding: 4,
    borderRightColor: '#bdc3c7',
    borderRightWidth: 1,
  },
  headerCell: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cell: {
    fontSize: 9,
    textAlign: 'left',
    padding: 4,
  },
  // Larguras das colunas
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
    borderRightWidth: 0, // Última coluna não tem borda direita
  },
  // Cores específicas
  expenseText: { 
    color: '#e74c3c',
  },
  incomeText: { 
    color: '#27ae60',
  },
  evenRow: {
    backgroundColor: '#f5f6fa',
  }
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [fullDate] = dateStr.split('T');
    const [year, month, day] = fullDate.split('-');
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return dateStr;
  }
};

const ReportTable = ({ data, categorias = [], tags = [] }) => {
  const formatValue = (value, type) => {
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Math.abs(value));
    
    return type === 'DESPESA' ? `- ${formattedValue}` : formattedValue;
  };

  const getTagNames = (tagIds) => {
    if (!tagIds || !Array.isArray(tagIds) || !tags || !Array.isArray(tags)) return '-';
    return tagIds
      .map(tagId => tags.find(t => t.id === tagId)?.nome)
      .filter(Boolean)
      .join(', ') || '-';
  };

  const getCategoryName = (categoryId) => {
    if (!categoryId || !categorias || !Array.isArray(categorias)) return '-';
    return categorias.find(c => c.id === categoryId)?.nome || '-';
  };

  return (
    <View style={styles.table}>
      {/* Cabeçalho */}
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

      {/* Linhas de dados */}
      {data.map((item, index) => (
        <View key={index} style={[
          styles.tableRow,
          index % 2 === 1 && styles.evenRow
        ]}>
          <View style={[styles.tableCell, styles.indexCell]}>
            <Text style={styles.cell}>{index + 1}</Text>
          </View>
          <View style={[styles.tableCell, styles.dateCell]}>
            <Text style={styles.cell}>{formatDate(item.data)}</Text>
          </View>
          <View style={[styles.tableCell, styles.typeCell]}>
            <Text style={[
              styles.cell,
              item.tipo === 'gasto' ? styles.expenseText : styles.incomeText
            ]}>
              {item.tipo === 'gasto' ? 'GASTO' : 'RECEBÍVEL'}
            </Text>
          </View>
          <View style={[styles.tableCell, styles.descriptionCell]}>
            <Text style={styles.cell}>{item.descricao || '-'}</Text>
          </View>
          <View style={[styles.tableCell, styles.personCell]}>
            <Text style={styles.cell}>{item.pessoa || '-'}</Text>
          </View>
          <View style={[styles.tableCell, styles.valueCell]}>
            <Text style={[
              styles.cell,
              item.tipo === 'gasto' ? styles.expenseText : styles.incomeText
            ]}>
              {formatValue(item.valorPagamento, item.tipo === 'gasto' ? 'DESPESA' : 'RECEITA')}
            </Text>
          </View>
          <View style={[styles.tableCell, styles.tagsCell]}>
            <Text style={styles.cell}>
              {Object.entries(item.tagsPagamento || {})
                .map(([catId, tagIds]) => {
                  const categoria = categorias.find(c => c._id === catId || c.nome === catId);
                  if (!categoria) return null;

                  const tagsTexto = tagIds
                    .map(tagId => {
                      const tag = tags.find(t => t._id === tagId || t.nome === tagId);
                      return tag ? tag.nome : null;
                    })
                    .filter(Boolean)
                    .join(', ');

                  return tagsTexto ? `${categoria.nome}: ${tagsTexto}` : null;
                })
                .filter(Boolean)
                .join(' | ') || '-'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

export default ReportTable; 