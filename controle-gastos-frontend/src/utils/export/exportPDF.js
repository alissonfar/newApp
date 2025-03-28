import { pdf } from '@react-pdf/renderer';
import ReportDocument from '../../components/PDF/ReportDocument';

export const exportDataToPDF = async (
  data,
  filterDetails = {},
  summaryInfo = {},
  categorias = [],
  tags = [],
  filename = 'relatorio.pdf'
) => {
  try {
    if (!data || data.length === 0) {
      console.warn("Nenhum dado para exportar");
      return;
    }

    // Cria o documento PDF
    const blob = await pdf(
      <ReportDocument
        data={data}
        filterDetails={filterDetails}
        summaryInfo={summaryInfo}
        categorias={categorias}
        tags={tags}
      />
    ).toBlob();

    // Cria um URL para o blob
    const url = URL.createObjectURL(blob);

    // Cria um elemento <a> temporário para download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Limpa
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
}; 