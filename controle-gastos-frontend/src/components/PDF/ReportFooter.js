import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    height: 20,
    backgroundColor: '#f5f6fa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5
  },
  text: {
    fontSize: 8,
    color: '#7f8c8d'
  }
});

const ReportFooter = () => (
  <View style={styles.footer} fixed>
    <Text style={styles.text}>Sistema de Controle de Gastos</Text>
    <Text style={styles.text} render={({ pageNumber, totalPages }) => (
      `Página ${pageNumber} de ${totalPages}`
    )} />
  </View>
);

export default ReportFooter; 