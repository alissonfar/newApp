import React, { useState, useRef } from 'react';
import { FaUpload, FaSearch, FaSpinner, FaBuilding, FaFileExcel, FaInfoCircle, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { uploadPlanilhaCnpj, consultarCnpj } from '../../api';
import '../../pages/Everest/EverestPage.css';

const CnpjAccessTool = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [cnpjSearchTerm, setCnpjSearchTerm] = useState('');
  // Estados para a busca
  const [searchResults, setSearchResults] = useState([]); // Armazena a lista de resultados
  const [searchMessage, setSearchMessage] = useState(''); // Mensagens de status/erro da busca
  // Estados para o upload
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(''); // Mensagens de status/erro do upload
  const [uploadDetails, setUploadDetails] = useState(null); // Detalhes do upload (contagens)
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    // Validação mais robusta, incluindo extensões
    const allowedExtensions = /(\.csv|\.xlsx)$/i;
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel', // Para CSV em alguns casos
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // XLSX
    ];

    if (file && allowedExtensions.exec(file.name) && allowedMimeTypes.includes(file.type)) {
      setSelectedFile(file);
      setUploadMessage('');
      setUploadDetails(null);
    } else {
      setSelectedFile(null);
      setUploadMessage('Erro: Por favor, selecione um arquivo .csv ou .xlsx válido.');
      setUploadDetails(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = ''; // Limpa o input
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.warn('Nenhum arquivo selecionado.');
      setUploadMessage('Nenhum arquivo selecionado.');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile); // O nome 'file' deve corresponder ao backend (multer)

    setIsLoadingUpload(true);
    setUploadMessage(`Enviando ${selectedFile.name}...`); 
    setUploadDetails(null); // Limpa detalhes anteriores
    
    try {
      const responseData = await uploadPlanilhaCnpj(formData);
      toast.success(responseData.mensagem || 'Arquivo processado com sucesso!');
      setUploadMessage(responseData.mensagem || `Arquivo ${selectedFile.name} processado.`);
      setUploadDetails(responseData.detalhes);
      setSelectedFile(null); // Limpa seleção após sucesso
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Erro no upload:", error);
      const errorMessage = error.response?.data?.erro || error.message || 'Falha ao enviar o arquivo.';
      toast.error(errorMessage);
      setUploadMessage(`Erro ao enviar: ${errorMessage}`);
      setUploadDetails(error.response?.data?.detalhes); // Pode haver detalhes mesmo no erro
    } finally {
      setIsLoadingUpload(false);
    }
  };

  const handleSearch = async () => {
    const searchTerm = cnpjSearchTerm.replace(/\D/g, ''); // Limpa antes de enviar?
    if (!searchTerm) {
      toast.warn('Por favor, digite um CNPJ para buscar.');
      setSearchMessage('Erro: Por favor, digite um CNPJ para buscar.');
      setSearchResults([]);
      return;
    }
    setIsLoadingSearch(true);
    setSearchResults([]); // Limpa resultados anteriores
    setSearchMessage('');   // Limpa mensagens anteriores
    
    try {
      // A API agora espera o CNPJ com ou sem máscara, ela vai limpar
      const responseData = await consultarCnpj(cnpjSearchTerm);
      
      if (responseData.sucesso && responseData.dados && responseData.dados.length > 0) {
        setSearchResults(responseData.dados);
        setSearchMessage(''); // Limpa mensagem se encontrou
      } else {
        setSearchResults([]);
        setSearchMessage('CNPJ não encontrado na base de dados.');
      }
    } catch (error) {
      console.error("Erro na busca:", error);
      const errorMessage = error.response?.data?.erro || error.message || 'Falha ao buscar CNPJ.';
      toast.error(errorMessage); 
      setSearchResults([]);
      setSearchMessage(`Erro: ${errorMessage}`);
    } finally {
      setIsLoadingSearch(false);
    }
  };

  // Formatar CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
  // O input agora aceita máscara, mas a busca envia o valor do estado (limpo ou não)
  // const formatCnpjForDisplay = (cnpj) => {
  //   if (!cnpj) return '';
  //   cnpj = String(cnpj).replace(/\D/g, '');
  //   return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  // };

  // Permite digitar com máscara, mas armazena só números (ou deixa a API limpar?)
  // Vamos deixar o input mais livre e a API limpar/validar.
  const handleCnpjInputChange = (event) => {
    // Poderia adicionar máscara aqui se desejado com uma lib externa
    setCnpjSearchTerm(event.target.value);
  };


  return (
    <div className="space-y-8">
      {/* Seção de Upload */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
          <FaFileExcel className="mr-2 text-green-600" />
          Atualizar Base CNPJ x Usuário
        </h3>
        <div className="space-y-4">
          <label htmlFor="cnpj-file-upload" className="block text-sm font-medium text-gray-600">Selecione a planilha (.xlsx):</label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input 
              id="cnpj-file-upload"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" // Aceita apenas XLSX agora
              onChange={handleFileChange}
              className="flex-grow w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              disabled={isLoadingUpload}
            />
            <button 
              onClick={handleUpload}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!selectedFile || isLoadingUpload}
            >
              {isLoadingUpload ? <FaSpinner className="animate-spin mr-2" /> : <FaUpload className="mr-2" />}
              {isLoadingUpload ? 'Enviando...' : 'Enviar Arquivo'}
            </button>
          </div>
          {/* Mensagem de Status do Upload */}
          {uploadMessage && (
            <div className={`mt-3 text-sm p-3 rounded-md flex items-center ${uploadMessage.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {uploadMessage.includes('Erro') ? <FaExclamationTriangle className="mr-2" /> : <FaCheckCircle className="mr-2" />}
              <span>{uploadMessage}</span>
            </div>
          )}
          {/* Detalhes do Upload */} 
          {uploadDetails && (
            <div className="mt-2 text-xs p-2 rounded-md bg-gray-100 text-gray-600">
              {uploadDetails.avisos && uploadDetails.avisos.length > 0 && (
                <p><strong>Avisos:</strong> {uploadDetails.avisos.join(', ')}</p>
              )}
              <p>Emissão: {uploadDetails.emissaoProcessados ?? 'N/A'} registros processados.</p>
              <p>Recebimento: {uploadDetails.recebimentoProcessados ?? 'N/A'} registros processados.</p>
            </div>
          )}
        </div>
      </div>

      {/* Seção de Busca */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
          <FaSearch className="mr-2 text-blue-600" />
          Consultar CNPJ
        </h3>
        <div className="space-y-4">
          <label htmlFor="cnpj-search" className="block text-sm font-medium text-gray-600">Digite o CNPJ (com ou sem máscara):</label>
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <input 
              id="cnpj-search"
              type="text"
              placeholder="00.000.000/0000-00 ou 00000000000000"
              value={cnpjSearchTerm}
              onChange={handleCnpjInputChange}
              className="flex-grow w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
              disabled={isLoadingSearch}
            />
            <button 
              onClick={handleSearch}
              className="w-full sm:w-auto inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0"
              disabled={isLoadingSearch || !cnpjSearchTerm.trim()}
            >
              {isLoadingSearch ? <FaSpinner className="animate-spin mr-2" /> : <FaSearch className="mr-2" />}
              {isLoadingSearch ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>

        {/* Área de Resultado da Busca - Usando Tabela Real */}
        <div className="mt-6 results-table-container"> 
          {isLoadingSearch && (
            <div className="p-6 flex items-center justify-center text-gray-500 notes-loading"> 
              <FaSpinner className="animate-spin mr-3" />
              <span>Buscando informações...</span>
            </div>
          )}
          
          {!isLoadingSearch && searchMessage && (
             <div className={`p-4 flex items-center text-sm ${searchMessage.includes('Erro') ? 'text-red-700 bg-red-50' : 'text-yellow-700 bg-yellow-50'} rounded-md border ${searchMessage.includes('Erro') ? 'border-red-200' : 'border-yellow-200'}`}>
              {searchMessage.includes('Erro') ? <FaExclamationTriangle className="mr-2 flex-shrink-0" /> : <FaInfoCircle className="mr-2 flex-shrink-0" />}
              <span>{searchMessage}</span>
            </div>
          )}

          {/* Tabela Real de Resultados */} 
          {!isLoadingSearch && !searchMessage && searchResults.length > 0 && (
            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm"> {/* Container para overflow e estilo */}
              <table className="ticket-table w-full"> {/* Aplicando classe ticket-table */}
                <thead className="ticket-table-header"> {/* Cabeçalho da Tabela */}
                  <tr>
                    <th className="w-3/4 px-4 py-3 text-left">Usuário Associado</th> {/* th real */}
                    <th className="w-1/4 px-4 py-3 text-right">Origem</th>
                  </tr>
                </thead>
                <tbody className="ticket-table-body divide-y divide-gray-200 bg-white"> {/* Corpo da Tabela */}
                  {searchResults.map((result, index) => (
                    <tr key={index} className="hover:bg-gray-50"> {/* Linha da Tabela */}
                      {/* Célula Usuário */}
                      <td className="w-3/4 px-4 py-3 whitespace-nowrap truncate" title={result.usuario}>{result.usuario}</td>
                      {/* Célula Origem (Badge) */}
                      <td className="w-1/4 px-4 py-3 whitespace-nowrap text-right">
                        <span 
                          className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${result.tipoOrigem === 'EMISSAO' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
                        >
                          {result.tipoOrigem} 
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Mensagem de Sucesso sem Resultados */}
          {!isLoadingSearch && !searchMessage && searchResults.length === 0 && (
             <div className="p-4 flex items-center text-sm text-gray-500 bg-gray-50 rounded-md border border-gray-200">
                <FaInfoCircle className="mr-2 flex-shrink-0" />
                <span>Nenhum registro encontrado para este CNPJ.</span>
             </div>
           )} 
        </div>
      </div>
    </div>
  );
};

export default CnpjAccessTool; 