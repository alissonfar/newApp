import React from 'react';
import { useRecebimentos } from '../context/RecebimentosContext';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TabFiltro = () => {
  const {
    recebimentoSelecionado,
    pendentes,
    loadingPendentes,
    draftFiltrosPendentes,
    setDraftFiltrosPendentes,
    applyFiltrosPendentes,
    pessoasOptions
  } = useRecebimentos();

  const somaFiltrada = pendentes.reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
  const quantidade = pendentes.length;

  if (!recebimentoSelecionado) {
    return (
      <div className="tab-filtro-placeholder">
        <p>Selecione um recebimento na aba Configuração para filtrar os gastos pendentes.</p>
      </div>
    );
  }

  return (
    <div className="tab-filtro">
      <h3>Filtros para gastos pendentes</h3>
      <p className="dica">Filtre por pessoa e período. Clique em Filtrar para buscar. Os gastos filtrados aparecerão na aba de Seleção.</p>

      <div className="tab-filtro-campos">
        <div className="filtro-grupo">
          <label>Pessoa</label>
          <select
            value={draftFiltrosPendentes?.pessoa || ''}
            onChange={(e) => setDraftFiltrosPendentes({ pessoa: e.target.value })}
          >
            <option value="">Todas as pessoas</option>
            {pessoasOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="filtro-grupo">
          <label>Data início</label>
          <input
            type="date"
            value={draftFiltrosPendentes?.dataInicio || ''}
            onChange={(e) => setDraftFiltrosPendentes({ dataInicio: e.target.value })}
          />
        </div>
        <div className="filtro-grupo">
          <label>Data fim</label>
          <input
            type="date"
            value={draftFiltrosPendentes?.dataFim || ''}
            onChange={(e) => setDraftFiltrosPendentes({ dataFim: e.target.value })}
          />
        </div>
        <div className="filtro-grupo">
          <label>&nbsp;</label>
          <button onClick={applyFiltrosPendentes} disabled={loadingPendentes}>
            {loadingPendentes ? 'Carregando...' : 'Filtrar'}
          </button>
        </div>
      </div>

      <div className="tab-filtro-preview">
        {loadingPendentes ? (
          <p>Carregando...</p>
        ) : (
          <>
            <div className="preview-item">
              <span>Transações encontradas:</span>
              <strong>{quantidade}</strong>
            </div>
            <div className="preview-item">
              <span>Soma filtrada:</span>
              <strong>R$ {formatarValor(somaFiltrada)}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TabFiltro;
