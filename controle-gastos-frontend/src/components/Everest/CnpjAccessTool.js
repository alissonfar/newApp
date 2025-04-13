import React, { useState, useRef } from 'react';
import { FaUpload, FaSearch, FaSpinner, FaBuilding, FaFileExcel } from 'react-icons/fa';
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

  // Formatar CNPJ (XX.XXX.XXX/XXXX-XX)
  const formatCnpj = (cnpj) => {
    if (!cnpj) return '';
    cnpj = cnpj.replace(/\D/g, '');
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  return (
    <div>
      {/* Seção de Upload */}
      <div className="cnpj-search-container">
        <h3 className="cnpj-section-title">
          <FaFileExcel className="inline-block mr-2" />
          Atualizar Base de Dados
        </h3>
        <div className="cnpj-search-form">
          <div className="cnpj-form-group">
            <label htmlFor="cnpj-file-upload" className="cnpj-form-label">Selecione um arquivo de planilha (.csv ou .xlsx)</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                id="cnpj-file-upload"
                ref={fileInputRef}
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="cnpj-form-input file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                disabled={isLoadingUpload}
              />
              <button 
                onClick={handleUpload}
                className="cnpj-search-button"
                disabled={!selectedFile || isLoadingUpload}
              >
                {isLoadingUpload ? <FaSpinner className="animate-spin" /> : <FaUpload />}
                {isLoadingUpload ? 'ENVIANDO...' : 'ENVIAR ARQUIVO'}
              </button>
            </div>
          </div>
          {uploadStatus && (
            <p className={`mt-2 text-sm ${uploadStatus.includes('Erro') || uploadStatus.includes('Por favor') ? 'cnpj-error' : 'text-green-600'}`}>
              {uploadStatus}
            </p>
          )}
        </div>
      </div>

      {/* Seção de Busca */}
      <div className="cnpj-search-container">
        <h3 className="cnpj-section-title">
          <FaSearch className="inline-block mr-2" />
          Consultar CNPJ
        </h3>
        <div className="cnpj-search-form">
          <div className="cnpj-form-group">
            <label htmlFor="cnpj-search" className="cnpj-form-label">Digite o número do CNPJ (somente números)</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                id="cnpj-search"
                type="text"
                placeholder="00.000.000/0000-00"
                value={cnpjSearchTerm}
                onChange={(e) => setCnpjSearchTerm(e.target.value.replace(/\D/g, ''))}
                className="cnpj-form-input"
                disabled={isLoadingSearch}
              />
              <button 
                onClick={handleSearch}
                className="cnpj-search-button"
                disabled={isLoadingSearch || !cnpjSearchTerm.trim()}
              >
                {isLoadingSearch ? <FaSpinner className="animate-spin" /> : <FaSearch />}
                {isLoadingSearch ? 'BUSCANDO...' : 'BUSCAR CNPJ'}
              </button>
            </div>
          </div>
        </div>

        {/* Área de Resultado */}
        {isLoadingSearch && (
          <div className="cnpj-loading mt-4">
            <FaSpinner className="cnpj-spinner" />
            <p>Buscando informações do CNPJ...</p>
          </div>
        )}
        
        {!isLoadingSearch && searchResult && searchResult.error && (
          <div className="cnpj-error mt-4">
            {searchResult.error}
          </div>
        )}
        
        {!isLoadingSearch && searchResult && !searchResult.error && (
          <div className="cnpj-result mt-4">
            <div className="cnpj-result-header">
              <span className="cnpj-result-status">Ativo</span>
              <h3 className="cnpj-result-title">{searchResult.razaoSocial || 'Empresa'}</h3>
            </div>
            <div className="cnpj-result-body">
              <div className="cnpj-info-group">
                <div className="cnpj-info">
                  <span className="cnpj-info-label">CNPJ</span>
                  <span className="cnpj-info-value">{formatCnpj(searchResult.cnpj)}</span>
                </div>
                <div className="cnpj-info">
                  <span className="cnpj-info-label">Usuário de Acesso</span>
                  <span className="cnpj-info-value">{searchResult.usuarioAcesso || 'Não definido'}</span>
                </div>
                <div className="cnpj-info">
                  <span className="cnpj-info-label">Situação</span>
                  <span className="cnpj-info-value">ATIVA</span>
                </div>
              </div>
              
              <h4 className="cnpj-section-title">Informações Adicionais</h4>
              <div className="cnpj-info-group">
                <div className="cnpj-info">
                  <span className="cnpj-info-label">Informação</span>
                  <span className="cnpj-info-value">{searchResult.infoAdicional || 'Nenhuma informação adicional disponível'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CnpjAccessTool; 