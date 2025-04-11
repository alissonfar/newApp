import React, { useState, useRef } from 'react';
import { FaUpload, FaSpinner, FaFileCode } from 'react-icons/fa';
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
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Processador de XML</h2>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <label htmlFor="xml-file-upload" className="sr-only">Escolher arquivo XML</label>
        <input 
          id="xml-file-upload"
          ref={fileInputRef}
          type="file"
          accept=".xml, text/xml"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 flex-grow cursor-pointer"
          disabled={isLoading}
        />
        <button 
          onClick={handleProcessXml}
          className="btn btn-primary w-full sm:w-auto whitespace-nowrap disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
          disabled={!selectedFile || isLoading}
        >
          {isLoading ? <FaSpinner className="animate-spin mr-2" /> : <FaFileCode className="mr-2" />}
          {isLoading ? 'Processando...' : 'Processar XML'}
        </button>
      </div>
      
       {uploadStatus && (
          <p className={`mb-4 text-sm ${uploadStatus.includes('Erro') || uploadStatus.includes('Por favor') ? 'text-red-600' : 'text-green-600'}`}>
            {uploadStatus}
          </p>
        )}

      {/* Área de Resumo */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Resumo do Último XML Processado</h3>
        <div className="p-4 border border-gray-200 rounded bg-gray-50 min-h-[150px]">
           {isLoading && (
            <div className="flex items-center justify-center text-gray-500">
              <FaSpinner className="animate-spin mr-2" /> Processando e extraindo dados...
            </div>
          )}
          {!isLoading && xmlSummary && (
             <div className="space-y-2 text-sm">
                <p><strong className="font-medium text-gray-800">Número:</strong> {xmlSummary.numeroNota}</p>
                <p><strong className="font-medium text-gray-800">Emitente:</strong> {xmlSummary.emitente}</p>
                <p><strong className="font-medium text-gray-800">Destinatário:</strong> {xmlSummary.destinatario}</p>
                <p><strong className="font-medium text-gray-800">Valor Total:</strong> R$ {xmlSummary.valorTotal}</p>
                {xmlSummary.dataEmissao && 
                  <p><strong className="font-medium text-gray-800">Data Emissão:</strong> {new Date(xmlSummary.dataEmissao + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                }
              </div>
          )}
           {!isLoading && !xmlSummary && (
            <p className="text-center text-gray-400 italic">Nenhum XML processado recentemente. Envie um arquivo para ver o resumo.</p>
          )}
        </div>
      </div>

    </div>
  );
};

export default XmlProcessorTool; 