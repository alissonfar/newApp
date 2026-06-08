import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Select from 'react-select';
import { useImportacao } from '../../../contexts/ImportacaoContext';
import { useData } from '../../../context/DataContext';
import importacaoService from '../../../services/importacaoService';
import pluggyApi from '../../../services/pluggyApi';
import IconRenderer from '../../shared/IconRenderer';
import RevisaoMetadadosImportacao from './RevisaoMetadadosImportacao';
import ConfiguracaoImportacaoModal from './ConfiguracaoImportacaoModal';
import { getTodayBR } from '../../../utils/dateUtils';
import './NovaImportacaoForm.css';

const TIPOS_CONTA = {
  BANK: { label: 'Conta Corrente', cor: '#059669', fundo: '#d1fae5' },
  CREDIT: { label: 'Cartão de Crédito', cor: '#7c3aed', fundo: '#ede9fe' }
};

const MS_DIA = 86400000;

function getDefaultPeriod() {
  const hoje = new Date(getTodayBR() + 'T12:00:00.000Z');
  const primeiro = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1, 12, 0, 0));
  return {
    dateFrom: primeiro.toISOString().split('T')[0],
    dateTo: hoje.toISOString().split('T')[0]
  };
}

const NovaImportacaoForm = () => {
  const navigate = useNavigate();
  const { iniciarImportacao } = useImportacao();
  const { categorias = [], tags: allTags = [], refreshData } = useData();

  const [origem, setOrigem] = useState('arquivo');

  // Estado para fluxo de Arquivo
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [tagsPadrao, setTagsPadrao] = useState({});
  const [tipoImportacaoComplementar, setTipoImportacaoComplementar] = useState(false);

  // Estado da máquina de 2 passos
  const [etapa, setEtapa] = useState('upload');
  const [preview, setPreview] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [criando, setCriando] = useState(false);

  // Estado do modal de configuracao
  const [modalConfigAberto, setModalConfigAberto] = useState(false);

  // Estado para fluxo Pluggy
  const [pluggyItems, setPluggyItems] = useState([]);
  const [pluggyContaSelecionada, setPluggyContaSelecionada] = useState(null);
  const [periodoPluggy, setPeriodoPluggy] = useState('custom');
  const [dateFromPluggy, setDateFromPluggy] = useState(getDefaultPeriod().dateFrom);
  const [dateToPluggy, setDateToPluggy] = useState(getDefaultPeriod().dateTo);

  useEffect(() => {
    pluggyApi.obterConfig().then(cfg => {
      if (cfg && cfg.configurado && cfg.items && cfg.items.length > 0) {
        setPluggyItems(cfg.items.filter(i => i.ativo));
      }
    }).catch(() => {});
  }, []);

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

  const handlePeriodoChange = (value) => {
    setPeriodoPluggy(value);
    if (value === 'custom') return;
    const hojeStr = getTodayBR();
    const hoje = new Date(hojeStr + 'T12:00:00.000Z');
    let de;
    switch (value) {
      case '7': de = new Date(hoje.getTime() - 7 * MS_DIA); break;
      case '15': de = new Date(hoje.getTime() - 15 * MS_DIA); break;
      case '30': de = new Date(hoje.getTime() - 30 * MS_DIA); break;
      case '90': de = new Date(hoje.getTime() - 90 * MS_DIA); break;
      case 'mes': de = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1, 12, 0, 0)); break;
      case 'tudo': setDateFromPluggy(''); setDateToPluggy(''); return;
      default: return;
    }
    setDateFromPluggy(de.toISOString().split('T')[0]);
    setDateToPluggy(hojeStr);
  };

  const handleAnalisar = async () => {
    if (origem === 'arquivo') {
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
        const meta = data?.metadadosSugeridos || {};
        if (meta.tagSugerida && meta.tagSugerida.categoriaId && meta.tagSugerida.tagId) {
          setTagsPadrao(prev => ({
            ...prev,
            [meta.tagSugerida.categoriaId]: [meta.tagSugerida.tagId]
          }));
          if (meta.tagSugerida.autoCriada) {
            toast.info('Tag "' + meta.tagSugerida.tagNome + '" foi criada automaticamente na categoria "' + meta.tagSugerida.categoriaNome + '".');
          }
        }
        if (meta.isFaturaCartao || data?.sugestaoComplementar?.sugestao) {
          setTipoImportacaoComplementar(true);
        }
        if (meta.titulo) {
          if (meta.isFaturaCartao) {
            setDescricao(meta.titulo);
          } else if (!descricao.trim()) {
            setDescricao(meta.titulo);
          }
        }
        setEtapa('preview');
      } catch (error) {
        console.error('Erro no preview:', error);
        toast.error(error.message || 'Erro ao analisar arquivo');
      } finally {
        setAnalisando(false);
      }
    } else {
      if (!pluggyContaSelecionada) {
        toast.warn('Selecione uma conta do Open Finance.');
        return;
      }
      if (!descricao.trim()) {
        toast.warn('Por favor, insira uma descrição para a importação.');
        return;
      }
      setAnalisando(true);
      try {
        const payload = {
          itemId: pluggyContaSelecionada.itemId,
          accountId: pluggyContaSelecionada.accountId,
          dateFrom: dateFromPluggy || undefined,
          dateTo: dateToPluggy || undefined
        };
        console.log('[Frontend Preview] Enviando payload:', JSON.stringify(payload));
        const data = await importacaoService.previewPluggy(payload);
        console.log('[Frontend Preview] Resposta recebida:',
          'totalRegistros:', data?.metadadosSugeridos?.totalRegistros,
          '| dataInicial:', data?.metadadosSugeridos?.dataInicial,
          '| dataFinal:', data?.metadadosSugeridos?.dataFinal,
          '| periodoCompetencia:', data?.metadadosSugeridos?.periodoCompetencia);
        if (data?.metadadosSugeridos?.totalRegistros === 0) {
          console.warn('[Frontend Preview] ** ZERO transacoes retornadas no preview **');
        }
        if (data?.metadadosSugeridos?.dataFinal) {
          const filterEnd = new Date(payload.dateTo + 'T12:00:00.000Z');
          const dataEnd = new Date(data.metadadosSugeridos.dataFinal);
          if (dataEnd < filterEnd) {
            const diffDays = Math.round((filterEnd - dataEnd) / 86400000);
            console.warn('[Frontend Preview] ** Periodo retornado (' + data.metadadosSugeridos.dataFinal + ') esta ' + diffDays + ' dias antes do filtro (' + payload.dateTo + ') **');
          }
        }
        setPreview(data);
        const meta = data?.metadadosSugeridos || {};
        if (meta.tagSugerida && meta.tagSugerida.categoriaId && meta.tagSugerida.tagId) {
          setTagsPadrao(prev => ({
            ...prev,
            [meta.tagSugerida.categoriaId]: [meta.tagSugerida.tagId]
          }));
          if (meta.tagSugerida.autoCriada) {
            toast.info('Tag "' + meta.tagSugerida.tagNome + '" foi criada automaticamente na categoria "' + meta.tagSugerida.categoriaNome + '".');
          }
        }
        if (meta.isFaturaCartao || data?.sugestaoComplementar?.sugestao) {
          setTipoImportacaoComplementar(true);
        }
        if (meta.titulo) {
          if (meta.isFaturaCartao) {
            setDescricao(meta.titulo);
          } else if (!descricao.trim()) {
            setDescricao(meta.titulo);
          }
        }
        setEtapa('preview');
      } catch (error) {
        console.error('Erro no preview Pluggy:', error);
        toast.error(error.message || 'Erro ao analisar transações do Open Finance');
      } finally {
        setAnalisando(false);
      }
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
      navigate('/importacao/' + importacao.id);
    } catch (error) {
      console.error('Erro ao criar importação:', error);
      toast.error('Erro ao criar importação. Por favor, tente novamente.');
    } finally {
      setCriando(false);
    }
  };

  const handleConfirmarPreview = async () => {
    if (!preview) return;
    if (!preview.isPluggy && !preview?.previewId) return;
    setCriando(true);
    try {
      const tagsParaEnviar = Object.fromEntries(
        Object.entries(tagsPadrao).filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
      );
      const meta = preview.metadadosSugeridos || {};

      if (preview.isPluggy) {
        const params = preview.pluggyParams || {};
        const resultado = await importacaoService.importarDaPluggy({
          itemId: params.itemId,
          accountId: params.accountId,
          dateFrom: params.dateFrom || undefined,
          dateTo: params.dateTo || undefined,
          descricao,
          tagsPadrao: tagsParaEnviar,
          tipoImportacao: tipoImportacaoComplementar ? 'complementar' : 'normal',
          metadados: {
            vencimento: meta.vencimento || null,
            mesVencimento: meta.mesVencimento || null,
            numeroComplemento: meta.numeroComplemento != null ? meta.numeroComplemento : null,
            tagSugeridaId: meta.tagSugerida?.tagId || null,
            categoriaSugeridaId: meta.tagSugerida?.categoriaId || null
          }
        });
        iniciarImportacao({ id: resultado.importacaoId });
        toast.success(resultado.mensagem || 'Importação criada com sucesso!');
        navigate('/importacao/' + resultado.importacaoId);
      } else {
        const importacao = await importacaoService.confirmarPreview({
          previewId: preview.previewId,
          descricao,
          tipoImportacao: tipoImportacaoComplementar ? 'complementar' : 'normal',
          tagsPadrao: tagsParaEnviar,
          metadados: {
            vencimento: meta.vencimento || null,
            mesVencimento: meta.mesVencimento || null,
            numeroComplemento: meta.numeroComplemento != null ? meta.numeroComplemento : null,
            tagSugeridaId: meta.tagSugerida?.tagId || null,
            categoriaSugeridaId: meta.tagSugerida?.categoriaId || null
          }
        });
        iniciarImportacao(importacao);
        toast.success('Importação iniciada com sucesso!');
        navigate('/importacao/' + importacao.id);
      }
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

  const handleConfigSalva = async (dados) => {
    setModalConfigAberto(false);
    if (etapa === 'preview' && arquivo) {
      try { await refreshData(); } catch (e) { /* silencioso */ }
      await handleAnalisar();
    }
  };

  // ===== Etapa 1: Upload / Seleção =====
  if (etapa === 'upload') {
    return (
      <div className="nova-importacao-form">
        <h2>Nova Importação</h2>

        {/* Seletor de origem */}
        <div className="form-group">
          <div className="origem-selector" style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db' }}>
            <button
              type="button"
              onClick={() => { setOrigem('arquivo'); setPluggyContaSelecionada(null); }}
              style={{
                flex: 1, padding: '10px 16px', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                border: 'none', background: origem === 'arquivo' ? '#0ea5e9' : '#f3f4f6',
                color: origem === 'arquivo' ? '#fff' : '#374151'
              }}
            >
              📁 Importar de Arquivo
            </button>
            <button
              type="button"
              onClick={() => setOrigem('pluggy')}
              disabled={pluggyItems.length === 0}
              title={pluggyItems.length === 0 ? 'Configure o Open Finance no menu Patrimônio > Open Finance' : ''}
              style={{
                flex: 1, padding: '10px 16px', cursor: pluggyItems.length === 0 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500,
                border: 'none', background: origem === 'pluggy' ? '#6366f1' : '#f3f4f6',
                color: origem === 'pluggy' ? '#fff' : (pluggyItems.length === 0 ? '#9ca3af' : '#374151'),
                opacity: pluggyItems.length === 0 ? 0.6 : 1
              }}
            >
              🏦 Importar do Open Finance
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="descricao">Descrição da Importação</label>
          <input
            type="text"
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={origem === 'arquivo' ? 'Ex: Importação Janeiro/2024' : 'Ex: Fatura Nubank Junho/2026'}
            disabled={analisando || criando}
            required
          />
        </div>

        {origem === 'arquivo' ? (
          <>
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
                    value: t._id, label: t.nome, cor: t.cor, icone: t.icone
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
                          setTagsPadrao(prev => ({ ...prev, [cat._id]: selected.map(s => s.value) }));
                        }}
                        placeholder="Selecione tags..."
                        className="tag-select"
                        classNamePrefix="tag-select"
                        isClearable isSearchable
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
          </>
        ) : (
          <>
            {/* Seletor de conta Pluggy */}
            <div className="form-group">
              <label>Selecionar Conta</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pluggyItems.map((item) => {
                  const tipo = TIPOS_CONTA[item.accountType] || { label: item.accountType, cor: '#6b7280', fundo: '#f3f4f6' };
                  const selecionado = pluggyContaSelecionada &&
                    pluggyContaSelecionada.itemId === item.itemId &&
                    pluggyContaSelecionada.accountId === item.accountId;
                  return (
                    <button
                      key={item.itemId + '-' + item.accountId}
                      type="button"
                      onClick={() => {
                        setPluggyContaSelecionada(item);
                        if (!descricao.trim()) {
                          setDescricao(item.connectorName + ' - ' + (item.accountName || item.accountNumber || item.accountId));
                        }
                      }}
                      disabled={analisando || criando}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        borderRadius: 8, border: '2px solid ' + (selecionado ? tipo.cor : '#e5e7eb'),
                        background: selecionado ? tipo.fundo : '#fff',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.15s', opacity: analisando || criando ? 0.6 : 1
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 8,
                        background: tipo.fundo, color: tipo.cor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 'bold'
                      }}>
                        {item.accountType === 'CREDIT' ? '💳' : '🏦'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{item.connectorName || 'Banco'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{item.accountName || item.accountNumber || item.accountId}</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                        background: tipo.fundo, color: tipo.cor
                      }}>
                        {tipo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seletor de período */}
            <div className="form-group">
              <label>Período</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {[
                  { value: 'mes', label: 'Este mês' },
                  { value: '7', label: '7 dias' },
                  { value: '15', label: '15 dias' },
                  { value: '30', label: '30 dias' },
                  { value: '90', label: '90 dias' },
                  { value: 'tudo', label: 'Todo período' },
                  { value: 'custom', label: 'Personalizado' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePeriodoChange(opt.value)}
                    disabled={analisando || criando}
                    style={{
                      padding: '6px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13,
                      border: '1px solid ' + (periodoPluggy === opt.value ? '#6366f1' : '#d1d5db'),
                      background: periodoPluggy === opt.value ? '#eef2ff' : '#fff',
                      color: periodoPluggy === opt.value ? '#4338ca' : '#374151',
                      fontWeight: periodoPluggy === opt.value ? 600 : 400
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {periodoPluggy === 'custom' && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>De</label>
                    <input
                      type="date"
                      value={dateFromPluggy}
                      onChange={e => setDateFromPluggy(e.target.value)}
                      disabled={analisando || criando}
                      style={{ display: 'block', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>Até</label>
                    <input
                      type="date"
                      value={dateToPluggy}
                      onChange={e => setDateToPluggy(e.target.value)}
                      disabled={analisando || criando}
                      style={{ display: 'block', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
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
          {origem === 'arquivo' && (
            <button
              type="button"
              onClick={handleCriarDireto}
              disabled={analisando || criando}
              className="btn-secundario"
              style={{ background: 'transparent', color: '#0ea5e9', border: '1px solid #0ea5e9' }}
            >
              {criando ? 'Criando...' : 'Criar sem preview'}
            </button>
          )}
          <button
            type="button"
            onClick={handleAnalisar}
            disabled={analisando || criando || (origem === 'pluggy' && !pluggyContaSelecionada)}
            className="btn-importar"
            style={origem === 'pluggy' ? { background: '#6366f1', borderColor: '#6366f1' } : {}}
          >
            {analisando ? 'Analisando...' : 'Analisar e revisar'}
          </button>
        </div>

        <ConfiguracaoImportacaoModal
          aberto={modalConfigAberto}
          onFechar={() => setModalConfigAberto(false)}
          onSalvo={handleConfigSalva}
        />
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
        onAbrirConfiguracao={() => setModalConfigAberto(true)}
      />

      <ConfiguracaoImportacaoModal
        aberto={modalConfigAberto}
        onFechar={() => setModalConfigAberto(false)}
        onSalvo={handleConfigSalva}
      />
    </div>
  );
};

export default NovaImportacaoForm;
