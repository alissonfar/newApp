import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { toast } from 'react-toastify';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import IconRenderer from '../shared/IconRenderer';

const ConfiguracaoRecebimentosModal = ({ aberto, onFechar, onSalvo }) => {
  const { usuario, atualizarPreferencias } = useAuth();
  const { tags = [], refreshData } = useData();
  const [tagReceberId, setTagReceberId] = useState(null);
  const [tagRemoverId, setTagRemoverId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // IDs salvos no backend (podem ser ref quebrada)
  const preferencias = usuario?.preferencias || {};
  const tagReceberIdSalvo = preferencias.tagReceberPadraoId || null;
  const tagRemoverIdSalvo = preferencias.tagRemoverPadraoId || null;

  // Detecção de referência quebrada: ID salvo existe mas a tag não está mais em useData().tags
  const tagReceberQuebrada = tagReceberIdSalvo && !tags.find(t => t._id === tagReceberIdSalvo);
  const tagRemoverQuebrada = tagRemoverIdSalvo && !tags.find(t => t._id === tagRemoverIdSalvo);

  useEffect(() => {
    if (aberto) {
      setTagReceberId(tagReceberIdSalvo);
      setTagRemoverId(tagRemoverIdSalvo);
    }
  }, [aberto, tagReceberIdSalvo, tagRemoverIdSalvo]);

  if (!aberto) return null;

  const opcoesTags = (tags || []).map(t => ({
    value: t._id,
    label: t.nome,
    cor: t.cor,
    icone: t.icone
  }));

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await atualizarPreferencias({
        tagReceberPadraoId: tagReceberId || null,
        tagRemoverPadraoId: tagRemoverId || null
      });
      if (typeof refreshData === 'function') {
        try { await refreshData(); } catch (e) { /* silencioso */ }
      }
      toast.success('Configuração de recebimentos salva com sucesso.');
      if (typeof onSalvo === 'function') {
        onSalvo({
          tagReceberPadraoId: tagReceberId || null,
          tagRemoverPadraoId: tagRemoverId || null
        });
      }
      onFechar();
    } catch (err) {
      console.error('Erro ao salvar configuração de recebimentos:', err);
      toast.error('Erro ao salvar configuração. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemoverReferenciaQuebrada = async (campo) => {
    try {
      setSalvando(true);
      const atualizacao = campo === 'receber'
        ? { tagReceberPadraoId: null }
        : { tagRemoverPadraoId: null };
      await atualizarPreferencias(atualizacao);
      if (campo === 'receber') setTagReceberId(null);
      else setTagRemoverId(null);
      toast.success('Referência quebrada removida.');
      if (typeof onSalvo === 'function') {
        onSalvo({
          tagReceberPadraoId: campo === 'receber' ? null : (tagReceberId || null),
          tagRemoverPadraoId: campo === 'remover' ? null : (tagRemoverId || null)
        });
      }
    } catch (err) {
      console.error('Erro ao remover referência quebrada:', err);
      toast.error('Erro ao remover referência. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const valorSelecionadoReceber = opcoesTags.find(o => o.value === tagReceberId) || null;
  const valorSelecionadoRemover = opcoesTags.find(o => o.value === tagRemoverId) || null;

  const renderOption = ({ label, cor, icone }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconRenderer nome={icone || 'tag'} size={18} cor={cor || '#64748b'} />
      <span>{label}</span>
    </div>
  );

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, padding: 24, maxWidth: 560,
          width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>
            Configurações de Recebimentos
          </h2>
          <button
            type="button"
            onClick={onFechar}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 24, color: '#64748b', lineHeight: 1
            }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <p style={{ color: '#64748b', fontSize: 14, marginTop: 0, marginBottom: 24 }}>
          Configure as tags padrão que serão usadas automaticamente ao conciliar recebimentos.
          Você poderá sobrescrever a qualquer momento na tela de configuração da conciliação.
        </p>

        {tags.length === 0 && (
          <div style={{
            background: '#fef3c7', border: '1px solid #fde68a',
            borderRadius: 8, padding: 12, marginBottom: 16,
            fontSize: 13, color: '#78350f'
          }}>
            Você ainda não tem tags cadastradas. Vá em <strong>Gerenciar Tags</strong> para criar antes de continuar.
          </div>
        )}

        {tagReceberQuebrada && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: 12, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <FaExclamationTriangle style={{ color: '#dc2626', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, color: '#7f1d1d' }}>
              A tag para aplicar (ID: <code>{tagReceberIdSalvo}</code>) não existe mais.
            </div>
            <button
              type="button"
              onClick={() => handleRemoverReferenciaQuebrada('receber')}
              disabled={salvando}
              style={{
                padding: '6px 12px', border: '1px solid #dc2626',
                borderRadius: 6, background: 'white', color: '#dc2626',
                cursor: 'pointer', fontSize: 12
              }}
            >
              Remover referência
            </button>
          </div>
        )}

        {tagRemoverQuebrada && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: 12, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <FaExclamationTriangle style={{ color: '#dc2626', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, color: '#7f1d1d' }}>
              A tag para remover (ID: <code>{tagRemoverIdSalvo}</code>) não existe mais.
            </div>
            <button
              type="button"
              onClick={() => handleRemoverReferenciaQuebrada('remover')}
              disabled={salvando}
              style={{
                padding: '6px 12px', border: '1px solid #dc2626',
                borderRadius: 6, background: 'white', color: '#dc2626',
                cursor: 'pointer', fontSize: 12
              }}
            >
              Remover referência
            </button>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
            Tag para aplicar nas transações quitadas
          </label>
          <Select
            options={opcoesTags}
            value={valorSelecionadoReceber}
            onChange={(op) => setTagReceberId(op ? op.value : null)}
            placeholder="Selecione uma tag..."
            isClearable
            isSearchable
            formatOptionLabel={renderOption}
          />
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
            Esta tag será adicionada aos pagamentos das transações marcadas como quitadas
            (ex: <em>Conta Paga</em>).
          </p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
            Tag para remover (opcional)
          </label>
          <Select
            options={opcoesTags}
            value={valorSelecionadoRemover}
            onChange={(op) => setTagRemoverId(op ? op.value : null)}
            placeholder="Nenhuma (opcional)"
            isClearable
            isSearchable
            formatOptionLabel={renderOption}
          />
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
            Esta tag será removida dos pagamentos antes da tag de aplicar ser inserida
            (ex: <em>Pendente</em>). Deixe em branco se não quiser remover nada.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            style={{
              padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: 6,
              background: 'white', color: '#0f172a', cursor: 'pointer', fontSize: 14
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            style={{
              padding: '10px 20px', border: 'none', borderRadius: 6,
              background: '#0ea5e9', color: 'white', cursor: 'pointer', fontSize: 14,
              fontWeight: 500, opacity: salvando ? 0.6 : 1
            }}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracaoRecebimentosModal;
