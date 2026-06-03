import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { toast } from 'react-toastify';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import IconRenderer from '../../shared/IconRenderer';

const ConfiguracaoImportacaoModal = ({ aberto, onFechar, onSalvo }) => {
  const { usuario, atualizarPreferencias } = useAuth();
  const { categorias = [], refreshData } = useData();
  const [categoriaCartaoId, setCategoriaCartaoId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      setCategoriaCartaoId(usuario?.preferencias?.categoriaCartaoCreditoId || null);
    }
  }, [aberto, usuario]);

  if (!aberto) return null;

  const opcoesCategoria = [
    { value: null, label: 'Nenhuma (desabilitar inferência automática de tag)' },
    ...categorias.map(c => ({
      value: c._id,
      label: c.nome,
      cor: c.cor,
      icone: c.icone
    }))
  ];

  const valorSelecionado = opcoesCategoria.find(o => o.value === categoriaCartaoId) || opcoesCategoria[0];

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await atualizarPreferencias({ categoriaCartaoCreditoId: categoriaCartaoId });
      if (typeof refreshData === 'function') {
        try { await refreshData(); } catch (e) { /* silencioso */ }
      }
      toast.success('Configuração de importação salva com sucesso.');
      if (typeof onSalvo === 'function') {
        onSalvo({ categoriaCartaoCreditoId: categoriaCartaoId });
      }
      onFechar();
    } catch (err) {
      console.error('Erro ao salvar configuração de importação:', err);
      toast.error('Erro ao salvar configuração. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

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
            Configurações de Importação
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
          Configure como o sistema deve tratar arquivos importados em massa.
        </p>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
            Categoria de Faturas de Cartão de Crédito
          </label>
          <Select
            options={opcoesCategoria}
            value={valorSelecionado}
            onChange={(op) => setCategoriaCartaoId(op ? op.value : null)}
            placeholder="Selecione uma categoria..."
            isSearchable
            formatOptionLabel={({ label, cor, icone }) => {
              if (!cor) return <span>{label}</span>;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconRenderer nome={icone || 'folder'} size={18} cor={cor || '#000'} />
                  <span>{label}</span>
                </div>
              );
            }}
          />
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
            Esta categoria será usada para classificar automaticamente faturas de cartão de crédito importadas.
            Tags do tipo <strong>Mês/Ano</strong> (ex: "Junho 2026") serão criadas automaticamente dentro dela
            caso não existam.
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

export default ConfiguracaoImportacaoModal;
