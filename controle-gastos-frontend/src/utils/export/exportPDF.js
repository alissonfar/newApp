import { pdf } from '@react-pdf/renderer';
import ReportDocument from '../../components/PDF/ReportDocument';

/**
 * Gera nome de arquivo baseado nos filtros aplicados.
 * Formato: relatorio-{dataInicio}-{dataFim}-{pessoas}-{tags}.pdf
 */
export const buildReportFilename = (filterDetails = {}, extension = 'pdf', categorias = [], tags = []) => {
  const sanitize = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 25);
  };

  const parts = ['relatorio'];

  const dataInicio = filterDetails.dataInicio || '';
  const dataFim = filterDetails.dataFim || '';
  if (dataInicio && dataFim) {
    const d1 = dataInicio.replace(/-/g, '').slice(0, 8);
    const d2 = dataFim.replace(/-/g, '').slice(0, 8);
    if (d1 && d2) parts.push(`${d1}-${d2}`);
  } else if (dataInicio) {
    parts.push(dataInicio.replace(/-/g, '').slice(0, 8));
  }

  const pessoas = filterDetails.selectedPessoas ?? filterDetails.pessoas;
  const pessoasArr = Array.isArray(pessoas) ? pessoas : (pessoas ? [pessoas] : []);
  if (pessoasArr.length > 0) {
    parts.push(pessoasArr.map(sanitize).filter(Boolean).join('-') || 'pessoas');
  } else {
    parts.push('todas');
  }

  const tagFilters = filterDetails.tagFilters ?? filterDetails.tagsFilter;
  if (tagFilters && typeof tagFilters === 'object') {
    const tagParts = [];
    Object.entries(tagFilters).forEach(([catId, tagIds]) => {
      if (!Array.isArray(tagIds) || tagIds.length === 0) return;
      tagIds.forEach((tid) => {
        const tag = tags.find((t) => t._id === tid || t.nome === tid);
        if (tag?.nome) tagParts.push(sanitize(tag.nome));
      });
    });
    if (tagParts.length > 0) {
      parts.push(tagParts.slice(0, 3).join('-'));
    }
  }

  const name = parts.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'relatorio';
  return `${name}.${extension}`;
};

export const exportDataToPDF = async (
  data,
  filterDetails = {},
  summaryInfo = {},
  categorias = [],
  tags = [],
  filename = 'relatorio.pdf',
  templateUsed = 'simples'
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
        templateUsed={templateUsed}
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