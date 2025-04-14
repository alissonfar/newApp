import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaUpload, FaSpinner, FaFileCode, FaFileAlt, FaEye, FaExclamationTriangle, FaTimes, FaTrash } from 'react-icons/fa'; // Adicionado FaTrash
import { toast } from 'react-toastify';
import { processarXml, obterSumariosXml, obterSumarioXmlPorId, excluirSumarioXml } from '../../api'; // Adicionado excluirSumarioXml

// --- Helpers --- (Movidos para fora do Modal)
const formatCurrency = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '-'; // Retorna '-' se não for número
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateString;
    }
}

// --- Componente Modal para Detalhes do XML ---
const XmlDetailModal = ({ summaryData, isOpen, onClose, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      > 
        <div className="sticky top-0 bg-gray-100 p-3 border-b flex justify-between items-center z-10 flex-shrink-0">
          <h3 className="text-lg font-semibold text-purple-800">Detalhes do XML: {summaryData?.originalFilename ?? 'Carregando...'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-grow">
          {isLoading && (
              <div className="flex justify-center items-center p-10">
                   <FaSpinner className="animate-spin text-purple-600 text-4xl" />
              </div>
          )}

          {!isLoading && !summaryData && (
              <div className="text-center p-10 text-red-600">Erro ao carregar detalhes.</div>
          )}
          
          {!isLoading && summaryData && summaryData.processingError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                  <strong className="font-bold">Erro no Processamento:</strong>
                  <span className="block sm:inline"> {summaryData.processingError}</span>
              </div>
          )}

          {!isLoading && summaryData && !summaryData.processingError && (
              <>
                {/* Seção de Identificação */}
                <section>
                  <h4 className="text-base font-semibold text-purple-700 mb-2 border-b pb-1">Identificação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                    <div><strong>Chave:</strong> <span className="break-all font-mono">{summaryData.identificacao?.chaveAcesso}</span></div>
                    <div><strong>Número:</strong> {summaryData.identificacao?.nNF}</div>
                    <div><strong>Série:</strong> {summaryData.identificacao?.serie}</div>
                    <div><strong>Modelo:</strong> {summaryData.identificacao?.mod}</div>
                    <div><strong>Emissão:</strong> {formatDate(summaryData.identificacao?.dhEmi)}</div>
                    <div><strong>Saída/Entrada:</strong> {formatDate(summaryData.identificacao?.dhSaiEnt)}</div>
                    <div><strong>Tipo NF:</strong> {summaryData.identificacao?.tpNF === '0' ? '0 - Entrada' : '1 - Saída'}</div>
                    <div><strong>Finalidade:</strong> {summaryData.identificacao?.finNFe}</div>
                    <div><strong>Nat. Operação:</strong> {summaryData.identificacao?.natOp}</div>
                  </div>
                </section>

                {/* Seção Emitente e Destinatário lado a lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <section>
                        <h4 className="text-base font-semibold text-purple-700 mb-2 border-b pb-1">Emitente</h4>
                        <div className="space-y-1 text-xs">
                            <div><strong>Nome:</strong> {summaryData.emitente?.nome}</div>
                            <div><strong>Fantasia:</strong> {summaryData.emitente?.nomeFantasia}</div>
                            <div><strong>CNPJ:</strong> {summaryData.emitente?.cnpj}</div>
                            <div><strong>IE:</strong> {summaryData.emitente?.ie}</div>
                            <div><strong>CRT:</strong> {summaryData.emitente?.crt}</div>
                            {/* Adicionar endereço do emitente */} 
                            {summaryData.emitente?.endereco && 
                              <div><strong>End.:</strong> {`${summaryData.emitente.endereco.logradouro ?? ''}, ${summaryData.emitente.endereco.numero ?? 'S/N'} - ${summaryData.emitente.endereco.bairro ?? ''}, ${summaryData.emitente.endereco.municipio ?? ''}/${summaryData.emitente.endereco.uf ?? ''}`}</div>
                            }
                        </div>
                    </section>
                    <section>
                        <h4 className="text-base font-semibold text-purple-700 mb-2 border-b pb-1">Destinatário</h4>
                         <div className="space-y-1 text-xs">
                            <div><strong>Nome:</strong> {summaryData.destinatario?.nome}</div>
                            <div><strong>CNPJ/CPF:</strong> {summaryData.destinatario?.cpfCnpj}</div>
                            <div><strong>IE:</strong> {summaryData.destinatario?.ie ?? '-'} (Ind: {summaryData.destinatario?.indIEDest})</div>
                            <div><strong>Email:</strong> {summaryData.destinatario?.email}</div>
                            {/* Adicionar endereço do destinatário */} 
                             {summaryData.destinatario?.endereco && 
                              <div><strong>End.:</strong> {`${summaryData.destinatario.endereco.logradouro ?? ''}, ${summaryData.destinatario.endereco.numero ?? 'S/N'} - ${summaryData.destinatario.endereco.bairro ?? ''}, ${summaryData.destinatario.endereco.municipio ?? ''}/${summaryData.destinatario.endereco.uf ?? ''}`}</div>
                            }
                        </div>
                    </section>
                </div>


                {/* Seção de Itens */}
                {summaryData.itens && summaryData.itens.length > 0 && (
                  <section>
                    <h4 className="text-base font-semibold text-purple-700 mb-2 border-b pb-1">Itens ({summaryData.itens.length})</h4>
                    <div className="overflow-x-auto max-h-60 border rounded">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 uppercase tracking-wider">#</th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 uppercase tracking-wider">Cód.</th>
                            <th className="px-2 py-1 text-left font-medium text-gray-600 uppercase tracking-wider">Descrição</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 uppercase tracking-wider">Qtd</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 uppercase tracking-wider">Vl. Unit.</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 uppercase tracking-wider">Vl. Total</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 uppercase tracking-wider">CFOP</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 uppercase tracking-wider">ICMS CST</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 uppercase tracking-wider">IPI CST</th>
                            <th className="px-2 py-1 text-right font-medium text-gray-600 uppercase tracking-wider">Vl. Trib Aprox.</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {summaryData.itens.map((item, index) => (
                            <tr key={item.numeroItem || index} className="hover:bg-purple-50">
                              <td className="px-2 py-1 whitespace-nowrap text-center">{item.numeroItem}</td>
                              <td className="px-2 py-1 whitespace-nowrap">{item.codigoProduto}</td>
                              <td className="px-2 py-1 max-w-xs truncate" title={item.descricao}>{item.descricao}</td>
                              <td className="px-2 py-1 text-right">{item.quantidadeComercial} {item.unidadeComercial}</td>
                              <td className="px-2 py-1 text-right whitespace-nowrap">{formatCurrency(item.valorUnitarioComercial)}</td>
                              <td className="px-2 py-1 text-right whitespace-nowrap">{formatCurrency(item.valorTotalBruto)}</td>
                              <td className="px-2 py-1 text-right">{item.cfop}</td>
                              <td className="px-2 py-1 text-right">{item.impostos?.icms?.cst ?? '-'}</td>
                              <td className="px-2 py-1 text-right">{item.impostos?.ipi?.cst ?? '-'}</td>
                              <td className="px-2 py-1 text-right whitespace-nowrap">{formatCurrency(item.impostos?.vTotTrib)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                 {/* Seção de Pagamentos */}
                {summaryData.pagamento?.detalhes && summaryData.pagamento.detalhes.length > 0 && (
                   <section>
                      <h4 className="text-base font-semibold text-purple-700 mb-2 border-b pb-1">Pagamento</h4>
                       <div className="space-y-1 text-xs">
                          {summaryData.pagamento.detalhes.map((pag, index) => (
                               <div key={index} className="grid grid-cols-3 gap-x-4">
                                   <span><strong>Forma:</strong> {pag.descricaoPagamento} [{pag.formaPagamento}]</span>
                                   <span><strong>Valor:</strong> {formatCurrency(pag.valor)}</span>
                                   <span>{pag.indPag === '0' ? 'À Vista' : pag.indPag === '1' ? 'A Prazo' : ''}</span>
                               </div>
                          ))}
                          {summaryData.pagamento.vTroco > 0 && (
                               <div className="mt-1"><strong>Troco:</strong> {formatCurrency(summaryData.pagamento.vTroco)}</div>
                          )}
                      </div>
                   </section>
                )}

                {/* Seção de Totais */}
                {summaryData.totais?.icmsTot && (
                  <section>
                    <h4 className="text-base font-semibold text-purple-700 mb-2 border-b pb-1">Totais</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                      <div><strong>Vl. Total Produtos:</strong> {formatCurrency(summaryData.totais.icmsTot.vProd)}</div>
                      <div><strong>Vl. Frete:</strong> {formatCurrency(summaryData.totais.icmsTot.vFrete)}</div>
                      <div><strong>Vl. Seguro:</strong> {formatCurrency(summaryData.totais.icmsTot.vSeg)}</div>
                      <div><strong>Vl. Desconto:</strong> {formatCurrency(summaryData.totais.icmsTot.vDesc)}</div>
                      <div><strong>Vl. Outro:</strong> {formatCurrency(summaryData.totais.icmsTot.vOutro)}</div>
                      <div><strong>Vl. BC ICMS:</strong> {formatCurrency(summaryData.totais.icmsTot.vBC)}</div>
                      <div><strong>Vl. ICMS:</strong> {formatCurrency(summaryData.totais.icmsTot.vICMS)}</div>
                      <div><strong>Vl. BC ICMS ST:</strong> {formatCurrency(summaryData.totais.icmsTot.vBCST)}</div>
                      <div><strong>Vl. ICMS ST:</strong> {formatCurrency(summaryData.totais.icmsTot.vST)}</div>
                      <div><strong>Vl. IPI:</strong> {formatCurrency(summaryData.totais.icmsTot.vIPI)}</div>
                      <div><strong>Vl. PIS:</strong> {formatCurrency(summaryData.totais.icmsTot.vPIS)}</div>
                      <div><strong>Vl. COFINS:</strong> {formatCurrency(summaryData.totais.icmsTot.vCOFINS)}</div>
                       <div className="font-bold text-sm col-span-full mt-1"><strong>Vl. Total NF:</strong> {formatCurrency(summaryData.totais.icmsTot.vNF)}</div>
                       <div className="text-gray-600"><strong>Vl. Aprox. Tributos:</strong> {formatCurrency(summaryData.totais.icmsTot.vTotTrib)}</div>
                    </div>
                  </section>
                )}

                 {/* Seção de Transporte */} 
                 {summaryData.transporte && (
                      <section>
                          <h4 className="text-base font-semibold text-purple-700 mb-2 border-b pb-1">Transporte</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                               <div><strong>Modalidade Frete:</strong> {summaryData.transporte.descricaoModFrete} [{summaryData.transporte.modFrete}]</div>
                               {summaryData.transporte.transportadora && (
                                  <div>
                                      <strong>Transportadora:</strong> {summaryData.transporte.transportadora.nome ?? 'N/A'} ({summaryData.transporte.transportadora.cnpjCpf ?? 'N/A'})
                                      <br/><span>{summaryData.transporte.transportadora.enderecoCompleto ?? ''}</span>
                                  </div>
                               )}
                               {summaryData.transporte.veiculo && (
                                  <div>
                                      <strong>Veículo:</strong> Placa {summaryData.transporte.veiculo.placa ?? 'N/A'} - {summaryData.transporte.veiculo.uf ?? ''}
                                  </div>
                               )}
                               {/* Add Volume display if needed */} 
                               {summaryData.transporte.volumes && summaryData.transporte.volumes.length > 0 && (
                                   <div className="md:col-span-2 mt-1"><strong>Volumes:</strong> {summaryData.transporte.volumes.length} volume(s)</div>
                               )}
                          </div>
                      </section>
                 )}
              </>
          )} 
        </div>
      </div>
    </div>
  );
};


// --- Componente Principal ---
const XmlProcessorTool = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [summaries, setSummaries] = useState([]); // Lista de resumos para os cards
  const [isLoading, setIsLoading] = useState(false); // Loading do processamento
  const [isFetchingList, setIsFetchingList] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSummaryDetail, setSelectedSummaryDetail] = useState(null);
  const [fetchingDetailId, setFetchingDetailId] = useState(null); // Para saber qual botão está carregando
  const [isDeleting, setIsDeleting] = useState(false); // Estado para exclusão
  const [deletingId, setDeletingId] = useState(null); // ID do item sendo excluído
  const fileInputRef = useRef(null);

  // --- Busca a lista de resumos sumarizados ---
  const fetchSummaries = useCallback(async () => {
    setIsFetchingList(true);
    setUploadStatus(''); // Limpa status de upload antigo
    try {
      const data = await obterSumariosXml();
      setSummaries(data || []);
    } catch (error) {
      toast.error('Erro ao buscar histórico de XMLs processados.');
      console.error("Erro fetchSummaries:", error);
    } finally {
      setIsFetchingList(false);
    }
  }, []);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  // --- Handler para mudança de arquivo --- (Igual antes)
   const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/xml' || file.name.endsWith('.xml'))) {
      setSelectedFile(file);
      setUploadStatus('');
    } else {
      setSelectedFile(null);
      setUploadStatus('Por favor, selecione um arquivo XML válido.');
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };


  // --- Handler para processar XML ---
  const handleProcessXml = async () => {
    if (!selectedFile) {
      toast.warn('Nenhum arquivo XML selecionado.');
      setUploadStatus('Selecione um arquivo para processar.');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsLoading(true);
    setUploadStatus(`Processando ${selectedFile.name}...`);

    try {
      await processarXml(formData);
      toast.success(`Arquivo ${selectedFile.name} processado com sucesso!`);
      setUploadStatus(''); // Limpa status após sucesso
      fetchSummaries(); // Refaz o fetch da lista

      setSelectedFile(null);
      if(fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      console.error("Erro ao processar XML:", error);
      const errorMsg = error?.response?.data?.erro || error.message || 'Falha ao processar o arquivo XML.';
      toast.error(errorMsg);
      setUploadStatus(`Erro: ${errorMsg}`);
      // Mesmo com erro, pode ser útil atualizar a lista para ver o registro de erro
      fetchSummaries();
    } finally {
       setIsLoading(false);
    }
  };

  // --- Handler para abrir o modal de detalhes ---
  const handleViewDetails = async (summaryId) => {
      if (!summaryId || isFetchingDetails) return;
      setFetchingDetailId(summaryId); // Marca qual ID está buscando
      setIsFetchingDetails(true);
      setSelectedSummaryDetail(null); // Limpa detalhes antigos
      setIsModalOpen(true); // Abre o modal imediatamente com estado de loading

      try {
          const fullData = await obterSumarioXmlPorId(summaryId); // API call para detalhes completos
          setSelectedSummaryDetail(fullData);
      } catch (error) {
          toast.error(error?.response?.data?.erro || error.message || 'Erro ao buscar detalhes do XML.');
          console.error("Erro handleViewDetails:", error);
          setIsModalOpen(false); // Fecha modal se não conseguir buscar detalhes
      } finally {
          setIsFetchingDetails(false);
          setFetchingDetailId(null); // Limpa ID em busca
      }
  };

  // --- Handler para excluir um resumo --- 
  const handleDeleteSummary = async (summaryId, filename) => {
    if (!summaryId || isDeleting) return;

    // Simples confirmação do navegador
    if (window.confirm(`Tem certeza que deseja excluir o resumo do arquivo "${filename}"?`)) {
      setIsDeleting(true);
      setDeletingId(summaryId);
      try {
        await excluirSumarioXml(summaryId);
        toast.success(`Resumo de ${filename} excluído com sucesso!`);
        // Remove o item excluído do estado local ou refaz o fetch
        // setSummaries(prev => prev.filter(s => s.id !== summaryId)); // Opção 1: Filtro local
        fetchSummaries(); // Opção 2: Refaz o fetch (mais simples)
      } catch (error) {
         toast.error(error?.response?.data?.erro || error.message || 'Erro ao excluir o resumo XML.');
         console.error("Erro handleDeleteSummary:", error);
      } finally {
          setIsDeleting(false);
          setDeletingId(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Seção de Upload e Processamento */} 
      <div className="xml-processor-container">
         <h3 className="xml-section-title">
          <FaFileCode /> Processamento de Arquivos XML (NF-e)
        </h3>
        <div className="xml-form-group">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
             <input
              id="xml-file-upload"
              ref={fileInputRef}
              type="file"
              accept=".xml, text/xml, application/xml"
              onChange={handleFileChange}
              className="xml-file-input file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 flex-grow disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || isFetchingList}
            />
            <button
              onClick={handleProcessXml}
              className="xml-process-button w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedFile || isLoading || isFetchingList}
            >
              {isLoading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
              {isLoading ? 'PROCESSANDO...' : 'PROCESSAR XML'}
            </button>
          </div>
        </div>
         {uploadStatus && (
          <p className={`xml-status text-sm mt-2 ${uploadStatus.includes('Erro') || uploadStatus.includes('Por favor') || uploadStatus.includes('Selecione') ? 'error' : 'success'}`}>
            {uploadStatus}
          </p>
        )}
      </div>

      {/* Seção de Histórico/Resultados */} 
      <div className="xml-processor-container">
           <h3 className="xml-section-title">
                <FaFileAlt /> Histórico de XMLs Processados
           </h3>

           {isFetchingList && (
                <div className="xml-loading"><FaSpinner className="xml-spinner" /><p>Carregando histórico...</p></div>
           )}

           {!isFetchingList && summaries.length === 0 && (
                <div className="xml-empty-state">
                    <FaFileCode className="text-purple-200 text-5xl mb-4" />
                    <p>Nenhum XML processado encontrado.</p>
                </div>
           )}

           {!isFetchingList && summaries.length > 0 && (
               <div className="space-y-3">
                   {summaries.map((summary) => (
                       <div key={summary.id} className={`border rounded-md p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white shadow-sm transition-colors ${summary.error ? 'border-red-300 bg-red-50' : 'hover:bg-purple-50'}`}>
                           <div className="text-xs flex-grow space-y-1">
                               <p className="font-medium text-gray-700"><strong>Arquivo:</strong> {summary.filename}</p>
                               {summary.error ? (
                                   <p className="text-red-600 font-semibold"><FaExclamationTriangle className="inline mr-1"/> Erro: {summary.error}</p>
                               ) : (
                                   <>
                                      <p><strong>Chave:</strong> <span className="text-gray-600 font-mono text-[10px] break-all">{summary.key}</span></p>
                                      <p><strong>Valor:</strong> <span className="font-semibold text-purple-700">{formatCurrency(summary.value)}</span> | <strong>Emitente:</strong> {summary.emitter}</p>
                                   </>
                               )}
                               <p className="text-gray-500 text-[10px]">Processado em: {formatDate(summary.date)}</p>
                           </div>
                           
                           {/* Botões de Ação */} 
                           <div className="flex items-center gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                {!summary.error && (
                                    <button
                                        onClick={() => handleViewDetails(summary.id)}
                                        className="xml-action-button xml-details-button"
                                        disabled={isFetchingDetails || isDeleting}
                                        title="Ver detalhes completos"
                                    >
                                       {isFetchingDetails && fetchingDetailId === summary.id ? <FaSpinner className="animate-spin" /> : <FaEye />}
                                       <span className="action-btn-label">Detalhes</span>
                                    </button>
                               )}
                                <button
                                    onClick={() => handleDeleteSummary(summary.id, summary.filename)}
                                    className="xml-action-button xml-delete-button"
                                    disabled={isDeleting || isFetchingDetails}
                                    title="Excluir este resumo"
                                >
                                    {isDeleting && deletingId === summary.id ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                                     <span className="action-btn-label">Excluir</span>
                                </button>
                           </div>
                       </div>
                   ))}
               </div>
           )}
      </div>

      {/* Modal de Detalhes */} 
      <XmlDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        summaryData={selectedSummaryDetail} // Passa os detalhes buscados
        isLoading={isFetchingDetails} // Indica se está carregando os detalhes
      />
    </div>
  );
}

export default XmlProcessorTool;