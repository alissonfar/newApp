import React, { useState, useRef } from 'react';
import { FaUpload, FaSpinner, FaFileCode, FaFileAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { processarXml } from '../../api';

const XmlProcessorTool = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [xmlSummary, setXmlSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/xml' || file.name.endsWith('.xml'))) {
      setSelectedFile(file);
      setUploadStatus('');
      setXmlSummary(null);
    } else {
      setSelectedFile(null);
      setUploadStatus('Por favor, selecione um arquivo XML.');
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleProcessXml = async () => {
    if (!selectedFile) {
      toast.warn('Nenhum arquivo XML selecionado.');
      setUploadStatus('Nenhum arquivo XML selecionado.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsLoading(true);
    setXmlSummary(null);
    setUploadStatus(`Processando ${selectedFile.name}...`);
    
    try {
      const response = await processarXml(formData);
      setXmlSummary(response.extractedData);
      toast.success(`Arquivo ${selectedFile.name} processado com sucesso!`);
      setUploadStatus(`Arquivo ${selectedFile.name} processado com sucesso!`);
      setSelectedFile(null); 
      if(fileInputRef.current) {
         fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Erro ao processar XML (API Mock):", error);
      toast.error(error.message || 'Falha ao processar o arquivo XML.');
      setUploadStatus(`Erro ao processar ${selectedFile.name}.`);
    } finally {
       setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Seção de Upload e Processamento */}
      <div className="xml-processor-container">
        <h3 className="xml-section-title">
          <FaFileCode />
          Processamento de Arquivos XML
        </h3>
        
        <div className="xml-form-group">
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              id="xml-file-upload"
              ref={fileInputRef}
              type="file"
              accept=".xml, text/xml"
              onChange={handleFileChange}
              className="xml-file-input file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
              disabled={isLoading}
            />
            <button 
              onClick={handleProcessXml}
              className="xml-process-button"
              disabled={!selectedFile || isLoading}
            >
              {isLoading ? <FaSpinner className="animate-spin" /> : <FaFileCode />}
              {isLoading ? 'PROCESSANDO...' : 'PROCESSAR XML'}
            </button>
          </div>
        </div>
        
        {uploadStatus && (
          <p className={`xml-status ${uploadStatus.includes('Erro') || uploadStatus.includes('Por favor') ? 'error' : 'success'}`}>
            {uploadStatus}
          </p>
        )}
      </div>

      {/* Área de Resultado */}
      {isLoading && (
        <div className="xml-loading">
          <FaSpinner className="xml-spinner" />
          <p>Processando e extraindo dados do XML...</p>
        </div>
      )}
      
      {!isLoading && xmlSummary && (
        <div className="xml-summary">
          <div className="xml-summary-header">
            <FaFileAlt className="text-purple-700" />
            <h3 className="xml-summary-title">Resumo do XML Processado</h3>
          </div>
          <div className="xml-summary-body">
            <div className="xml-summary-item">
              <span className="xml-summary-label">Número da Nota</span>
              <span className="xml-summary-value">{xmlSummary.numeroNota}</span>
            </div>
            <div className="xml-summary-item">
              <span className="xml-summary-label">Emitente</span>
              <span className="xml-summary-value">{xmlSummary.emitente}</span>
            </div>
            <div className="xml-summary-item">
              <span className="xml-summary-label">Destinatário</span>
              <span className="xml-summary-value">{xmlSummary.destinatario}</span>
            </div>
            <div className="xml-summary-item">
              <span className="xml-summary-label">Valor Total</span>
              <span className="xml-summary-value">R$ {xmlSummary.valorTotal}</span>
            </div>
            {xmlSummary.dataEmissao && (
              <div className="xml-summary-item">
                <span className="xml-summary-label">Data de Emissão</span>
                <span className="xml-summary-value">{new Date(xmlSummary.dataEmissao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {!isLoading && !xmlSummary && (
        <div className="xml-empty-state">
          <FaFileCode className="text-purple-200 text-5xl mb-4" />
          <p className="text-lg">Nenhum XML processado recentemente.</p>
          <p className="text-sm mt-2">Selecione um arquivo XML e clique em "Processar XML" para ver os dados extraídos.</p>
        </div>
      )}
    </div>
  );
}

export default XmlProcessorTool; 