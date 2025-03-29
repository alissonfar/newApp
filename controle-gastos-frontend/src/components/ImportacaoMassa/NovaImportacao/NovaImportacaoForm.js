import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useImportacao } from '../../../contexts/ImportacaoContext';
import importacaoService from '../../../services/importacaoService';
import './NovaImportacaoForm.css';

const NovaImportacaoForm = () => {
  const navigate = useNavigate();
  const { iniciarImportacao } = useImportacao();
  
  const [descricao, setDescricao] = useState('');
  const [tipoArquivo, setTipoArquivo] = useState('json');
  const [arquivo, setArquivo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!descricao.trim()) {
      toast.warn('Por favor, insira uma descrição para a importação.');
      return;
    }

    if (!arquivo) {
      toast.warn('Por favor, selecione um arquivo para importar.');
      return;
    }

    // Validar extensão do arquivo
    const extensao = arquivo.name.split('.').pop().toLowerCase();
    if (extensao !== tipoArquivo) {
      toast.error(`O arquivo selecionado não é um arquivo ${tipoArquivo.toUpperCase()} válido.`);
      return;
    }

    setLoading(true);
    try {
      // Criar nova importação
      const importacao = await importacaoService.criarImportacao(descricao, tipoArquivo);
      
      // Fazer upload do arquivo
      await importacaoService.uploadArquivo(importacao.id, arquivo);
      
      // Iniciar o estado da importação no Context
      iniciarImportacao(importacao);
      
      toast.success('Importação iniciada com sucesso!');
      navigate(`/importacao/${importacao.id}`);
    } catch (error) {
      console.error('Erro ao criar importação:', error);
      toast.error('Erro ao criar importação. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArquivo(file);
    }
  };

  return (
    <div className="nova-importacao-form">
      <h2>Nova Importação</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="descricao">Descrição da Importação</label>
          <input
            type="text"
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Importação Janeiro/2024"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tipoArquivo">Tipo de Arquivo</label>
          <select
            id="tipoArquivo"
            value={tipoArquivo}
            onChange={(e) => setTipoArquivo(e.target.value)}
            disabled={loading}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="arquivo">Selecionar Arquivo</label>
          <input
            type="file"
            id="arquivo"
            accept={`.${tipoArquivo}`}
            onChange={handleFileChange}
            disabled={loading}
            required
          />
          {arquivo && (
            <p className="arquivo-info">
              Arquivo selecionado: {arquivo.name}
            </p>
          )}
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            onClick={() => navigate('/importacao')}
            disabled={loading}
            className="btn-cancelar"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="btn-importar"
          >
            {loading ? 'Processando...' : 'Iniciar Importação'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovaImportacaoForm; 