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
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2980b9'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#bdc3c7',
    minHeight: 25
  },
  tableRowEven: {
    backgroundColor: '#f5f6fa'
  },
  tableCol: {
    borderRightWidth: 1,
    borderRightColor: '#bdc3c7',
    padding: 5
  },
  tableCell: {
    fontSize: 9,
    textAlign: 'left'
  },
  headerCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  // Colunas específicas
  colNum: { width: '5%' },
  colData: { width: '10%' },
  colTipo: { width: '10%' },
  colDescricao: { width: '25%' },
  colPessoa: { width: '15%' },
  colValor: { width: '10%' },
  colTags: { width: '25%' },
  // Estilos específicos
  gastoText: { color: '#e74c3c' },
  recebivelText: { color: '#2ecc71' },
  centerText: { textAlign: 'center' },
  rightText: { textAlign: 'right' },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  tag: {
    fontSize: 8,
    padding: 2,
    backgroundColor: '#f0f0f0',
    borderRadius: 2
  }
});

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const [fullDate] = dateStr.split('T');
  const [year, month, day] = fullDate.split('-');
  return `${day}/${month}/${year}`;
};

const formatCurrency = (value) => {
  if (value === undefined || value === null) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

const TransactionsTable = ({ data, categorias, tags }) => {
  const processarTags = (tagsPagamento) => {
    if (!tagsPagamento || !categorias || !tags) return '-';
    
    try {
      return Object.entries(tagsPagamento)
        .map(([catId, tagIds]) => {
          const categoria = categorias.find(c => c._id === catId || c.nome === catId);
          if (!categoria) return null;

          const tagsProcessadas = tagIds
            .map(tagId => {
              const tag = tags.find(t => t._id === tagId || t.nome === tagId);
              return tag ? tag.nome : null;
            })
            .filter(Boolean);

          if (tagsProcessadas.length === 0) return null;
          return `${categoria.nome}: ${tagsProcessadas.join(', ')}`;
        })
        .filter(Boolean)
        .join(' | ');
    } catch (error) {
      console.error('Erro ao processar tags:', error);
      return '-';
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Lista Completa de Transações</Text>
      <View style={styles.table}>
        {/* Cabeçalho */}
        <View style={styles.tableHeader}>
          <View style={[styles.tableCol, styles.colNum]}>
            <Text style={styles.headerCell}>#</Text>
          </View>
          <View style={[styles.tableCol, styles.colData]}>
            <Text style={styles.headerCell}>Data</Text>
          </View>
          <View style={[styles.tableCol, styles.colTipo]}>
            <Text style={styles.headerCell}>Tipo</Text>
          </View>
          <View style={[styles.tableCol, styles.colDescricao]}>
            <Text style={styles.headerCell}>Descrição</Text>
          </View>
          <View style={[styles.tableCol, styles.colPessoa]}>
            <Text style={styles.headerCell}>Pessoa</Text>
          </View>
          <View style={[styles.tableCol, styles.colValor]}>
            <Text style={styles.headerCell}>Valor</Text>
          </View>
          <View style={[styles.tableCol, styles.colTags]}>
            <Text style={styles.headerCell}>Tags</Text>
          </View>
        </View>

        {/* Linhas de dados */}
        {data.map((row, index) => {
          const isGasto = row.tipo === 'gasto';
          const valor = isGasto ? -Math.abs(row.valorPagamento) : Math.abs(row.valorPagamento);
          
          return (
            <View key={index} style={[
              styles.tableRow,
              index % 2 === 1 && styles.tableRowEven
            ]}>
              <View style={[styles.tableCol, styles.colNum]}>
                <Text style={[styles.tableCell, styles.centerText]}>{index + 1}</Text>
              </View>
              <View style={[styles.tableCol, styles.colData]}>
                <Text style={[styles.tableCell, styles.centerText]}>
                  {formatDate(row.data)}
                </Text>
              </View>
              <View style={[styles.tableCol, styles.colTipo]}>
                <Text style={[
                  styles.tableCell,
                  styles.centerText,
                  isGasto ? styles.gastoText : styles.recebivelText
                ]}>
                  {isGasto ? 'GASTO' : 'RECEBÍVEL'}
                </Text>
              </View>
              <View style={[styles.tableCol, styles.colDescricao]}>
                <Text style={styles.tableCell}>{row.descricao || '-'}</Text>
              </View>
              <View style={[styles.tableCol, styles.colPessoa]}>
                <Text style={styles.tableCell}>{row.pessoa || '-'}</Text>
              </View>
              <View style={[styles.tableCol, styles.colValor]}>
                <Text style={[
                  styles.tableCell,
                  styles.rightText,
                  isGasto ? styles.gastoText : styles.recebivelText
                ]}>
                  {formatCurrency(valor)}
                </Text>
              </View>
              <View style={[styles.tableCol, styles.colTags]}>
                <Text style={styles.tableCell}>
                  {processarTags(row.tagsPagamento)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default TransactionsTable; 