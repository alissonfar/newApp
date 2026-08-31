// src/utils/export/exportFechamentoZip.js
import JSZip from 'jszip';
import { generateReportPdfBlob, sanitizeFilenamePart } from './exportPDF';
import { obterTransacoesInstanciaFechamento } from '../../api';

/**
 * Gera um PDF por instância selecionada e empacota tudo num único .zip.
 * Reaproveita 100% o motor de PDF existente (`@react-pdf/renderer`) — só o empacotamento é novo.
 */
export async function exportarFechamentosEmLote(instancias, categorias, tags, periodo) {
  const zip = new JSZip();
  let algumaAdicionada = false;

  for (const instancia of instancias) {
    const pessoa = instancia.cadastro?.pessoa?.nome || 'pessoa';
    const { rows, resumoModelo } = await obterTransacoesInstanciaFechamento(instancia._id);
    if (!rows || rows.length === 0) continue;

    const blob = await generateReportPdfBlob(
      rows,
      { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim, selectedPessoas: [pessoa] },
      resumoModelo,
      categorias,
      tags,
      instancia.cadastro?.modeloRelatorio?.aggregation || 'default'
    );

    const nomeArquivo = `${sanitizeFilenamePart(pessoa) || 'pessoa'}-${periodo.dataInicio}-${periodo.dataFim}-${String(instancia._id).slice(-6)}.pdf`;
    zip.file(nomeArquivo, blob);
    algumaAdicionada = true;
  }

  if (!algumaAdicionada) {
    throw new Error('Nenhuma das instâncias selecionadas tem transações neste período — nada para exportar.');
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fechamentos-${periodo.dataInicio}-${periodo.dataFim}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
