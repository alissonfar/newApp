import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Select from 'react-select';
import { useImportacao } from '../../../contexts/ImportacaoContext';
import { useData } from '../../../context/DataContext';
import importacaoService from '../../../services/importacaoService';
import IconRenderer from '../../shared/IconRenderer';
import RevisaoMetadadosImportacao from './RevisaoMetadadosImportacao';
import './NovaImportacaoForm.css';

const NovaImportacaoForm = () => {
  const navigate = useNavigate();
  const { iniciarImportacao } = useImportacao();
  const { categorias = [], tags: allTags = [] } = useData();

  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [tagsPadrao, setTagsPadrao] = useState({});
  const [tipoImportacaoComplementar, setTipoImportacaoComplementar] = useState(false);

  // Estado da máquina de 2 passos
  const [etapa, setEtapa] = useState('upload'); // 'upload' | 'preview'
  const [preview, setPreview] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [criando, setCriando] = useState(false);

  const inferirDescricao = (file) => {
    if (!file) return null;
    const semExtensao = file.name.replace(/\.[^.]+$/, '');
    return semExtensao
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(p => p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p)
      .join(' ');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArquivo(file);
      if (!descricao.trim()) {
        const sugerida = inferirDescricao(file);
        if (sugerida) setDescricao(sugerida);
      }
    }
  };

  const handleAnalisar = async () => {
    if (!arquivo) {
      toast.warn('Selecione um arquivo para analisar.');
      return;
    }
    const extensao = arquivo.name.split('.').pop().toLowerCase();
    if (!['csv', 'json', 'xlsx'].includes(extensao)) {
      toast.error('Formato não suportado. Envie um arquivo .csv, .json ou .xlsx.');
      return;
    }
    if (!descricao.trim()) {
      toast.warn('Por favor, insira uma descrição para a importação.');
      return;
    }
    setAnalisando(true);
    try {
      const data = await importacaoService.previewArquivo(arquivo);
      setPreview(data);
      // Auto-sugerir complementar se a inferência indicou sobreposição
      if (data?.sugestaoComplementar?.sugestao) {
        setTipoImportacaoComplementar(true);
      }
      // Se a descrição estava vazia, usar a sugerida
      if (!descricao.trim() && data?.metadadosSugeridos?.titulo) {
        setDescricao(data.metadadosSugeridos.titulo);
      }
      setEtapa('preview');
    } catch (error) {
      console.error('Erro no preview:', error);
      toast.error(error.message || 'Erro ao analisar arquivo');
    } finally {
      setAnalisando(false);
    }
  };

  const handleCriarDireto = async () => {
    if (!descricao.trim()) {
      toast.warn('Por favor, insira uma descrição para a importação.');
      return;
    }
    if (!arquivo) {
      toast.warn('Por favor, selecione um arquivo para importar.');
      return;
    }
    const extensao = arquivo.name.split('.').pop().toLowerCase();
    if (!['csv', 'json', 'xlsx'].includes(extensao)) {
      toast.error('Formato não suportado. Envie um arquivo .csv, .json ou .xlsx.');
      return;
    }
    setCriando(true);
    try {
      const formData = new FormData();
      formData.append('descricao', descricao);
      formData.append('arquivo', arquivo);
      const tagsParaEnviar = Object.fromEntries(
        Object.entries(tagsPadrao).filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
      );
      if (Object.keys(tagsParaEnviar).length > 0) {
        formData.append('tagsPadrao', JSON.stringify(tagsParaEnviar));
      }
      if (tipoImportacaoComplementar) {
        formData.append('tipoImportacao', 'complementar');
      }
      const importacao = await importacaoService.criarImportacao(formData);
      iniciarImportacao(importacao);
      toast.success('Importação iniciada com sucesso!');
      navigate(`/importacao/${importacao.id}`);
    } catch (error) {
      console.error('Erro ao criar importação:', error);
      toast.error('Erro ao criar importação. Por favor, tente novamente.');
    } finally {
      setCriando(false);
    }
  };

  const handleConfirmarPreview = async () => {
    if (!preview?.previewId) return;
    setCriando(true);
    try {
      const tagsParaEnviar = Object.fromEntries(
        Object.entries(tagsPadrao).filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
      );
      const importacao = await importacaoService.confirmarPreview({
        previewId: preview.previewId,
        descricao,
        tipoImportacao: tipoImportacaoComplementar ? 'complementar' : 'normal',
        tagsPadrao: tagsParaEnviar
      });
      iniciarImportacao(importacao);
      toast.success('Importação iniciada com sucesso!');
      navigate(`/importacao/${importacao.id}`);
    } catch (error) {
      console.error('Erro ao confirmar preview:', error);
      toast.error(error.message || 'Erro ao criar importação');
    } finally {
      setCriando(false);
    }
  };

  const handleCancelarPreview = async () => {
    if (preview?.previewId) {
      await importacaoService.cancelarPreview(preview.previewId);
    }
    setPreview(null);
    setEtapa('upload');
  };

  const handleVoltar = () => {
    navigate('/importacao');
  };

  // ===== Etapa 1: Upload =====
  if (etapa === 'upload') {
    return (
      <div className="nova-importacao-form">
        <h2>Nova Importação</h2>

        <div className="form-group">
          <label htmlFor="descricao">Descrição da Importação</label>
          <input
            type="text"
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Importação Janeiro/2024"
            disabled={analisando || criando}
            required
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={tipoImportacaoComplementar}
              onChange={(e) => setTipoImportacaoComplementar(e.target.checked)}
              disabled={analisando || criando}
            />
            <span>Importação complementar (evitar duplicatas)</span>
          </label>
          <p className="form-hint">
            Ao marcar, o sistema identificará transações já importadas e importará apenas as novas.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="arquivo">Selecionar Arquivo</label>
          <input
            type="file"
            id="arquivo"
            accept=".csv,.json,.xlsx"
            onChange={handleFileChange}
            disabled={analisando || criando}
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
                    isDisabled={analisando || criando}
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
            onClick={handleVoltar}
            disabled={analisando || criando}
            className="btn-cancelar"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCriarDireto}
            disabled={analisando || criando}
            className="btn-secundario"
            style={{
              background: 'transparent',
              color: '#0ea5e9',
              border: '1px solid #0ea5e9'
            }}
          >
            {criando ? 'Criando...' : 'Criar sem preview'}
          </button>
          <button
            type="button"
            onClick={handleAnalisar}
            disabled={analisando || criando}
            className="btn-importar"
          >
            {analisando ? 'Analisando...' : 'Analisar e revisar'}
          </button>
        </div>
      </div>
    );
  }

  // ===== Etapa 2: Revisão de metadados =====
  return (
    <div className="nova-importacao-form">
      <h2>Revisar Metadados</h2>
      <RevisaoMetadadosImportacao
        preview={preview}
        descricao={descricao}
        onDescricaoChange={setDescricao}
        tipoImportacaoComplementar={tipoImportacaoComplementar}
        onTipoImportacaoChange={setTipoImportacaoComplementar}
        tagsPadrao={tagsPadrao}
        onTagsPadraoChange={setTagsPadrao}
        onConfirmar={handleConfirmarPreview}
        onCancelar={handleCancelarPreview}
        loading={criando}
      />
    </div>
  );
};

export default NovaImportacaoForm;
