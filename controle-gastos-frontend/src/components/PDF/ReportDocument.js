import React from 'react';
import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import ReportHeader from './ReportHeader';
import ReportFilters from './ReportFilters';
import ReportSummary from './ReportSummary';
import ReportTable from './ReportTable';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  section: {
    margin: 10,
    padding: 10,
  },
});

const ReportDocument = ({ data, filterDetails, summaryInfo, categorias, tags }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <ReportHeader />
      <ReportFilters filterDetails={filterDetails} />
      <ReportSummary summaryInfo={summaryInfo} />
      <ReportTable 
        data={data} 
        categorias={categorias} 
        tags={tags} 
      />
    </Page>
  </Document>
);

export default ReportDocument; 