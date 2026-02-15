import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Select from 'react-select';
import { useImportacao } from '../../../contexts/ImportacaoContext';
import { useData } from '../../../context/DataContext';
import importacaoService from '../../../services/importacaoService';
import IconRenderer from '../../shared/IconRenderer';
import './NovaImportacaoForm.css';

const NovaImportacaoForm = () => {
  const navigate = useNavigate();
  const { iniciarImportacao } = useImportacao();
  const { categorias = [], tags: allTags = [] } = useData();
  
  const [descricao, setDescricao] = useState('');
  const [tipoArquivo, setTipoArquivo] = useState('json');
  const [arquivo, setArquivo] = useState(null);
  const [tagsPadrao, setTagsPadrao] = useState({});
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
      // Criar FormData com os dados da importação
      const formData = new FormData();
      formData.append('descricao', descricao);
      formData.append('tipoArquivo', tipoArquivo);
      formData.append('arquivo', arquivo);
      const tagsParaEnviar = Object.fromEntries(
        Object.entries(tagsPadrao).filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
      );
      if (Object.keys(tagsParaEnviar).length > 0) {
        formData.append('tagsPadrao', JSON.stringify(tagsParaEnviar));
      }

      // Criar nova importação com o arquivo
      const importacao = await importacaoService.criarImportacao(formData);
      
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

        {categorias.length > 0 && (
          <div className="form-group tags-padrao-section">
            <label>Tags padrão da importação (opcional)</label>
            <p className="tags-padrao-hint">
              As tags selecionadas serão aplicadas automaticamente a todas as transações desta importação.
            </p>
            {categorias.map((cat) => {
              const options = allTags.filter(t => t.categoria === cat._id).map(t => ({
                value: t._id,
                label: t.nome,
                cor: t.cor,
                icone: t.icone
              }));
              const selectedValues = ((tagsPadrao[cat._id] || []).map(tagId => {
                const tag = allTags.find(t => t._id === tagId);
                return tag ? { value: tag._id, label: tag.nome, cor: tag.cor, icone: tag.icone } : null;
              })).filter(Boolean);
              return (
                <div key={cat._id} className="tag-category-group">
                  <label className="tag-category-label">
                    <IconRenderer nome={cat.icone || 'folder'} size={18} cor={cat.cor || '#000'} />
                    {cat.nome}
                  </label>
                  <Select
                    isMulti
                    options={options}
                    value={selectedValues}
                    onChange={(selected) => {
                      setTagsPadrao(prev => ({
                        ...prev,
                        [cat._id]: selected.map(s => s.value)
                      }));
                    }}
                    placeholder="Selecione tags..."
                    className="tag-select"
                    classNamePrefix="tag-select"
                    isClearable
                    isSearchable
                    isDisabled={loading}
                    noOptionsMessage={() => "Nenhuma tag encontrada"}
                    formatOptionLabel={({ label, cor, icone }) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IconRenderer nome={icone || 'tag'} size={18} cor={cor} />
                        <span>{label}</span>
                      </div>
                    )}
                  />
                </div>
              );
            })}
          </div>
        )}

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