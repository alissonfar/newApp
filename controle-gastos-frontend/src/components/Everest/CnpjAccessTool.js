import React, { useState, useRef } from 'react';
import { FaUpload, FaSearch, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { uploadPlanilhaCnpj, consultarCnpj } from '../../api';

const CnpjAccessTool = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [cnpjSearchTerm, setCnpjSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.name.endsWith('.xlsx'))) {
      setSelectedFile(file);
      setUploadStatus('');
    } else {
      setSelectedFile(null);
      setUploadStatus('Por favor, selecione um arquivo CSV ou XLSX.');
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.warn('Nenhum arquivo selecionado.');
      setUploadStatus('Nenhum arquivo selecionado.');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsLoadingUpload(true);
    setUploadStatus(`Enviando ${selectedFile.name}...`); 
    
    try {
      const response = await uploadPlanilhaCnpj(formData);
      toast.success(response.message || 'Arquivo enviado com sucesso!');
      setUploadStatus(`Arquivo ${selectedFile.name} enviado com sucesso!`);
      setSelectedFile(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Erro no upload (API Mock):", error);
      toast.error(error.message || 'Falha ao enviar o arquivo.');
      setUploadStatus(`Erro ao enviar ${selectedFile.name}.`);
    } finally {
      setIsLoadingUpload(false);
    }
  };

  const handleSearch = async () => {
    const searchTerm = cnpjSearchTerm.trim();
    if (!searchTerm) {
      toast.warn('Por favor, digite um CNPJ para buscar.');
      setSearchResult({ error: 'Por favor, digite um CNPJ para buscar.' });
      return;
    }
    setIsLoadingSearch(true);
    setSearchResult(null); 
    
    try {
      const result = await consultarCnpj(searchTerm);
      setSearchResult(result);
    } catch (error) {
      console.error("Erro na busca (API Mock):", error);
      toast.error(error.message || 'Falha ao buscar CNPJ.'); 
      setSearchResult({ error: error.message || 'Erro ao buscar CNPJ.' });
    } finally {
      setIsLoadingSearch(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Consulta Acesso por CNPJ</h2>

      {/* Seção de Upload */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Atualizar Base de Dados</h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-2">
          <label htmlFor="cnpj-file-upload" className="sr-only">Escolher arquivo</label>
          <input 
            id="cnpj-file-upload"
            ref={fileInputRef}
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 flex-grow cursor-pointer"
            disabled={isLoadingUpload}
          />
          <button 
            onClick={handleUpload}
            className="btn btn-secondary w-full sm:w-auto whitespace-nowrap disabled:opacity-50"
            disabled={!selectedFile || isLoadingUpload}
          >
            {isLoadingUpload ? <FaSpinner className="animate-spin mr-2" /> : <FaUpload className="mr-2" />}
            {isLoadingUpload ? 'Enviando...' : 'Enviar Arquivo'}
          </button>
        </div>
        {uploadStatus && (
          <p className={`mt-2 text-sm ${uploadStatus.includes('Erro') || uploadStatus.includes('Por favor') ? 'text-red-600' : 'text-green-600'}`}>
            {uploadStatus}
          </p>
        )}
      </div>

      {/* Seção de Busca */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-4">Consultar CNPJ</h3>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full flex-grow">
            <input 
              type="text"
              placeholder="Digite o CNPJ (somente números)"
              value={cnpjSearchTerm}
              onChange={(e) => setCnpjSearchTerm(e.target.value.replace(/\D/g, ''))}
              className="input-field pl-8 w-full"
              disabled={isLoadingSearch}
            />
            <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          <button 
            onClick={handleSearch}
            className="btn btn-primary w-full sm:w-auto whitespace-nowrap disabled:opacity-50"
            disabled={isLoadingSearch || !cnpjSearchTerm.trim()}
          >
            {isLoadingSearch ? <FaSpinner className="animate-spin mr-2" /> : <FaSearch className="mr-2" />}
            {isLoadingSearch ? 'Buscando...' : 'Buscar CNPJ'}
          </button>
        </div>

        {/* Área de Resultado */}
        <div className="mt-6 p-4 border border-gray-200 rounded bg-gray-50 min-h-[80px]">
          {isLoadingSearch && (
            <div className="flex items-center justify-center text-gray-500">
              <FaSpinner className="animate-spin mr-2" /> Buscando informações...
            </div>
          )}
          {!isLoadingSearch && searchResult && (
            searchResult.error ? (
              <p className="text-center text-red-600">{searchResult.error}</p>
            ) : (
              <div className="space-y-1">
                <p><strong className="font-medium text-gray-800">CNPJ:</strong> {searchResult.cnpj}</p>
                <p><strong className="font-medium text-gray-800">Usuário de Acesso:</strong> {searchResult.usuarioAcesso}</p>
                <p><strong className="font-medium text-gray-800">Info Adicional:</strong> {searchResult.infoAdicional}</p>
              </div>
            )
          )}
          {!isLoadingSearch && !searchResult && (
            <p className="text-center text-gray-400 italic">Digite um CNPJ e clique em buscar.</p>
          )}
        </div>
      </div>

    </div>
  );
};

export default CnpjAccessTool; 