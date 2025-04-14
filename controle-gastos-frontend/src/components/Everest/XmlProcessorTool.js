import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaUpload, FaSpinner, FaFileCode, FaFileAlt, FaEye, FaExclamationTriangle, FaTimes, FaTrash, FaSearch } from 'react-icons/fa'; // Adicionado FaTrash e FaSearch
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
      className="xml-modal-overlay" 
      onClick={onClose}
    >
      <div 
        className="xml-modal" 
        onClick={(e) => e.stopPropagation()}
      > 
        <div className="xml-modal-header">
          <h3 className="xml-modal-title">Detalhes do XML: {summaryData?.originalFilename ?? 'Carregando...'}</h3>
          <button onClick={onClose} className="xml-modal-close">&times;</button>
        </div>

        <div className="xml-modal-body">
          {isLoading && (
              <div className="xml-loading">
                   <FaSpinner className="xml-spinner" />
              </div>
          )}

          {!isLoading && !summaryData && (
              <div className="xml-error">Erro ao carregar detalhes.</div>
          )}
          
          {!isLoading && summaryData && summaryData.processingError && (
              <div className="xml-error-message" role="alert">
                  <strong className="font-bold">Erro no Processamento:</strong>
                  <span className="block sm:inline"> {summaryData.processingError}</span>
              </div>
          )}

          {!isLoading && summaryData && !summaryData.processingError && (
              <>
                {/* Seção de Identificação */}
                <section>
                  <h4 className="xml-section-subtitle">Identificação</h4>
                  <div className="xml-grid-info">
                    <div><strong>Chave:</strong> <span className="xml-chave-acesso">{summaryData.identificacao?.chaveAcesso}</span></div>
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
                <div className="xml-grid-columns">
                    <section>
                        <h4 className="xml-section-subtitle">Emitente</h4>
                        <div className="xml-info-list">
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
                        <h4 className="xml-section-subtitle">Destinatário</h4>
                         <div className="xml-info-list">
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
                    <h4 className="xml-section-subtitle">Itens ({summaryData.itens.length})</h4>
                    <div className="xml-table-container">
                      <table className="xml-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Cód.</th>
                            <th>Descrição</th>
                            <th>Qtd</th>
                            <th>Vl. Unit.</th>
                            <th>Vl. Total</th>
                            <th>CFOP</th>
                            <th>ICMS CST</th>
                            <th>IPI CST</th>
                            <th>Vl. Trib Aprox.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryData.itens.map((item, index) => (
                            <tr key={item.numeroItem || index} className="xml-table-row">
                              <td>{item.numeroItem}</td>
                              <td>{item.codigoProduto}</td>
                              <td className="xml-description" title={item.descricao}>{item.descricao}</td>
                              <td>{item.quantidadeComercial} {item.unidadeComercial}</td>
                              <td>{formatCurrency(item.valorUnitarioComercial)}</td>
                              <td>{formatCurrency(item.valorTotalBruto)}</td>
                              <td>{item.cfop}</td>
                              <td>{item.impostos?.icms?.cst ?? '-'}</td>
                              <td>{item.impostos?.ipi?.cst ?? '-'}</td>
                              <td>{formatCurrency(item.impostos?.vTotTrib)}</td>
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
                      <h4 className="xml-section-subtitle">Pagamento</h4>
                       <div className="xml-info-list">
                          {summaryData.pagamento.detalhes.map((pag, index) => (
                               <div key={index} className="xml-payment-item">
                                   <span><strong>Forma:</strong> {pag.descricaoPagamento} [{pag.formaPagamento}]</span>
                                   <span><strong>Valor:</strong> {formatCurrency(pag.valor)}</span>
                                   <span>{pag.indPag === '0' ? 'À Vista' : pag.indPag === '1' ? 'A Prazo' : ''}</span>
                               </div>
                          ))}
                          {summaryData.pagamento.vTroco > 0 && (
                               <div className="xml-troco"><strong>Troco:</strong> {formatCurrency(summaryData.pagamento.vTroco)}</div>
                          )}
                      </div>
                   </section>
                )}

                {/* Seção de Totais */}
                {summaryData.totais?.icmsTot && (
                  <section>
                    <h4 className="xml-section-subtitle">Totais</h4>
                    <div className="xml-grid-info">
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
                       <div className="xml-total-nf"><strong>Vl. Total NF:</strong> {formatCurrency(summaryData.totais.icmsTot.vNF)}</div>
                       <div className="xml-total-tributos"><strong>Vl. Aprox. Tributos:</strong> {formatCurrency(summaryData.totais.icmsTot.vTotTrib)}</div>
                    </div>
                  </section>
                )}

                 {/* Seção de Transporte */} 
                 {summaryData.transporte && (
                      <section>
                          <h4 className="xml-section-subtitle">Transporte</h4>
                          <div className="xml-grid-info">
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
                               {summaryData.transporte.volumes && summaryData.transporte.volumes.length > 0 && (
                                   <div className="xml-volumes"><strong>Volumes:</strong> {summaryData.transporte.volumes.length} volume(s)</div>
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
  const [filteredSummaries, setFilteredSummaries] = useState([]); // Lista filtrada pelos termos de busca
  const [searchTerm, setSearchTerm] = useState(''); // Termo de busca
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
      // Mapear os dados para garantir que temos as propriedades necessárias
      const formattedData = (data || []).map(item => ({
        ...item,
        // Se esses campos não existirem, definimos como N/A
        number: item.number || (item.identificacao?.nNF) || 'N/A',
        serie: item.serie || (item.identificacao?.serie) || 'N/A',
        model: item.modelo || item.model || (item.identificacao?.mod) || 'N/A'
      }));
      setSummaries(formattedData);
      setFilteredSummaries(formattedData);
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

  // --- Efeito para filtrar summaries baseado no termo de busca ---
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSummaries(summaries);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const filtered = summaries.filter(summary => {
      // Busca em vários campos
      return (
        // Nome do arquivo
        summary.filename?.toLowerCase().includes(term) ||
        // Chave de acesso
        summary.key?.toLowerCase().includes(term) ||
        // Emitente
        summary.emitter?.toLowerCase().includes(term) ||
        // Valor (convertido para string)
        formatCurrency(summary.value)?.toLowerCase().includes(term) ||
        // Data (formatada)
        formatDate(summary.date)?.toLowerCase().includes(term) ||
        // Erro (se existir)
        summary.error?.toLowerCase().includes(term)
      );
    });

    setFilteredSummaries(filtered);
  }, [searchTerm, summaries]);

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

  // --- Handler para mudança no campo de busca ---
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
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

           {/* Campo de Busca */}
           {!isFetchingList && summaries.length > 0 && (
             <div className="xml-search-bar">
               <input
                 type="text"
                 placeholder="Buscar por emitente, valor, arquivo, chave..."
                 value={searchTerm}
                 onChange={handleSearchChange}
                 className="xml-search-input"
               />
               {searchTerm && (
                 <button
                   onClick={() => setSearchTerm('')}
                   className="xml-search-clear"
                   title="Limpar busca"
                 >
                   <FaTimes />
                 </button>
               )}
               
               {searchTerm && (
                 <div className="xml-search-results-info">
                   {filteredSummaries.length === 0 ? (
                     <span>Nenhum resultado encontrado para "{searchTerm}"</span>
                   ) : (
                     <span>Exibindo {filteredSummaries.length} de {summaries.length} resultados</span>
                   )}
                 </div>
               )}
             </div>
           )}

           {isFetchingList && (
                <div className="xml-loading"><FaSpinner className="xml-spinner" /><p>Carregando histórico...</p></div>
           )}

           {!isFetchingList && summaries.length === 0 && (
                <div className="xml-empty-state">
                    <FaFileCode className="text-purple-200 text-5xl mb-4" />
                    <p>Nenhum XML processado encontrado.</p>
                </div>
           )}

           {!isFetchingList && filteredSummaries.length === 0 && summaries.length > 0 && (
             <div className="xml-empty-search">
               <FaSearch className="xml-empty-search-icon" />
               <p>Nenhum XML corresponde à sua busca.</p>
               <button 
                 onClick={() => setSearchTerm('')}
                 className="xml-clear-search-button"
               >
                 Limpar busca
               </button>
             </div>
           )}

           {!isFetchingList && filteredSummaries.length > 0 && (
               <div className="space-y-3">
                   {filteredSummaries.map((summary) => (
                       <div 
                            key={summary.id} 
                            className={`xml-history-card ${summary.error ? 'xml-card-error' : ''}`}
                        >
                            <div className="xml-card-content">
                                <div className="xml-card-header">
                                    <span className="xml-card-title">
                                        <strong>Arquivo:</strong> {summary.filename}
                                    </span>
                                </div>
                                
                                {summary.error ? (
                                    <p className="xml-card-error-message">
                                        <FaExclamationTriangle className="inline mr-1"/> 
                                        <span>Erro: {summary.error}</span>
                                    </p>
                                ) : (
                                    <>
                                        <div className="xml-card-info">
                                            <div className="xml-card-key">
                                                <strong>Chave:</strong> 
                                                <span className="xml-card-key-value">{summary.key}</span>
                                            </div>
                                            
                                            <div className="xml-card-details">
                                                <div className="xml-card-detail-item">
                                                    <strong>Número:</strong> <span>{summary.number || summary.identificacao?.nNF || 'N/A'}</span>
                                                </div>
                                                <div className="xml-card-detail-item">
                                                    <strong>Série:</strong> <span>{summary.serie || summary.identificacao?.serie || 'N/A'}</span>
                                                </div>
                                                <div className="xml-card-detail-item">
                                                    <strong>Modelo:</strong> <span>{summary.model || summary.identificacao?.mod || 'N/A'}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="xml-card-values">
                                                <span className="xml-card-value">
                                                    <strong>Valor:</strong> 
                                                    <span className="xml-card-value-number">{formatCurrency(summary.value)}</span>
                                                </span>
                                                <span className="xml-card-emitter">
                                                    <strong>Emitente:</strong> {summary.emitter}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                <div className="xml-card-footer">
                                    <span className="xml-card-date">
                                        Processado em: {formatDate(summary.date)}
                                    </span>
                                    
                                    <div className="xml-card-actions">
                                        {!summary.error && (
                                            <button
                                                onClick={() => handleViewDetails(summary.id)}
                                                className="xml-action-button xml-details-button"
                                                disabled={isFetchingDetails || isDeleting}
                                                title="Ver detalhes completos"
                                            >
                                                {isFetchingDetails && fetchingDetailId === summary.id ? 
                                                    <FaSpinner className="animate-spin" /> : 
                                                    <FaEye />
                                                }
                                                <span className="action-btn-label">Detalhes</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteSummary(summary.id, summary.filename)}
                                            className="xml-action-button xml-delete-button"
                                            disabled={isDeleting || isFetchingDetails}
                                            title="Excluir este resumo"
                                        >
                                            {isDeleting && deletingId === summary.id ? 
                                                <FaSpinner className="animate-spin" /> : 
                                                <FaTrash />
                                            }
                                            <span className="action-btn-label">Excluir</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                   ))}
               </div>
           )}
      </div>

      {/* Modal de Detalhes - Agora usando Portal */}
      {isModalOpen && createPortal(
        <XmlDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          summaryData={selectedSummaryDetail}
          isLoading={isFetchingDetails}
        />,
        document.body
      )}
    </div>
  );
}

export default XmlProcessorTool;