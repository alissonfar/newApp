import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import NovaImportacaoForm from '../../components/ImportacaoMassa/NovaImportacao/NovaImportacaoForm';
import ConfiguracaoImportacaoModal from '../../components/ImportacaoMassa/NovaImportacao/ConfiguracaoImportacaoModal';
import IconRenderer from '../../components/shared/IconRenderer';
import './NovaImportacaoPage.css';

const NovaImportacaoPage = () => {
  const { usuario } = useAuth();
  const { categorias = [] } = useData();
  const [modalAberto, setModalAberto] = useState(false);

  const categoriaConfigId = usuario?.preferencias?.categoriaCartaoCreditoId;
  const categoriaConfigNome = useMemo(() => {
    if (!categoriaConfigId) return null;
    const cat = categorias.find(c => c._id === categoriaConfigId);
    return cat ? cat.nome : null;
  }, [categoriaConfigId, categorias]);

  const handleAbrirModal = useCallback(() => setModalAberto(true), []);
  const handleFecharModal = useCallback(() => setModalAberto(false), []);
  const handleSalvo = useCallback(() => {
    setModalAberto(false);
  }, []);

  return (
    <div className="nova-importacao-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1>Nova Importação</h1>
          <p>Importe suas transações a partir de arquivos JSON, CSV ou XLSX.</p>
        </div>
        <button
          type="button"
          onClick={handleAbrirModal}
          title="Configurações de Importação"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '8px 14px', borderRadius: 999,
            border: `1px solid ${categoriaConfigId ? '#10b981' : '#dc2626'}`,
            background: categoriaConfigId ? '#ecfdf5' : '#fef2f2',
            color: categoriaConfigId ? '#065f46' : '#991b1b',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: 16 }}>⚙️</span>
          {categoriaConfigId ? (
            <>
              <span>Faturas →</span>
              <strong>{categoriaConfigNome || 'Categoria configurada'}</strong>
            </>
          ) : (
            <strong>Faturas: Não configurado</strong>
          )}
        </button>
      </div>

      <NovaImportacaoForm />

      <ConfiguracaoImportacaoModal
        aberto={modalAberto}
        onFechar={handleFecharModal}
        onSalvo={handleSalvo}
      />
    </div>
  );
};

export default NovaImportacaoPage;
