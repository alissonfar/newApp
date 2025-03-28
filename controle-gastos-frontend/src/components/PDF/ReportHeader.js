import React from 'react';
import { Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#2980b9',
    padding: 10,
    marginBottom: 10
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 10
  }
});

const ReportHeader = () => {
  const currentDate = new Date().toLocaleDateString('pt-BR');
  const currentTime = new Date().toLocaleTimeString('pt-BR');

  return (
    <View style={styles.header}>
      <Text style={styles.title}>Relatório de Transações</Text>
      <Text style={styles.subtitle}>
        Gerado em: {currentDate} às {currentTime}
      </Text>
    </View>
  );
};

export default ReportHeader; 