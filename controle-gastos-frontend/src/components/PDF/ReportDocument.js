import React from 'react';
import { Document, Page, StyleSheet } from '@react-pdf/renderer';
import ReportHeader from './ReportHeader';
import ReportFilters from './ReportFilters';
import ReportSummary from './ReportSummary';
import ReportTable from './ReportTable';
import { spacing } from './theme';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  section: {
    marginBottom: spacing.xl,
  },
});

const ReportDocument = ({ data, filterDetails, summaryInfo, categorias, tags, templateUsed }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <ReportHeader filterDetails={filterDetails} />
      <ReportFilters filterDetails={filterDetails} categorias={categorias} tags={tags} />
      <ReportSummary summaryInfo={summaryInfo} templateUsed={templateUsed} />
    </Page>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <ReportTable
        data={data}
        categorias={categorias}
        tags={tags}
      />
    </Page>
  </Document>
);

export default ReportDocument; 