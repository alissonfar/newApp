import React from 'react';
import { FaFilter } from 'react-icons/fa';
import { CircularProgress } from '@mui/material';
import { useRecebimentos } from '../context/RecebimentosContext';
import Card, { CardContent } from '../../../components/shared/Card';
import SectionHeader from '../../../components/shared/SectionHeader';
import Button from '../../../components/shared/Button';
import EmptyState from '../../../components/shared/EmptyState';

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
      <Card>
        <CardContent>
          <EmptyState
            message="Selecione um recebimento na aba Configuração para filtrar os gastos pendentes."
            icon={<FaFilter size={48} />}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="tab-filtro-wrapper">
      <Card className="tab-filtro-card">
        <CardContent>
          <SectionHeader title="Filtros para gastos pendentes" icon={<FaFilter size={18} />} />
          <p className="dica">Filtre por pessoa e período. Clique em Filtrar para buscar. Os gastos filtrados aparecerão na aba de Seleção.</p>

          <div className="tab-filtro-campos">
            <div className="filtro-grupo">
              <label>Pessoa</label>
              <select
                className="input-field"
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
                className="input-field"
                value={draftFiltrosPendentes?.dataInicio || ''}
                onChange={(e) => setDraftFiltrosPendentes({ dataInicio: e.target.value })}
              />
            </div>
            <div className="filtro-grupo">
              <label>Data fim</label>
              <input
                type="date"
                className="input-field"
                value={draftFiltrosPendentes?.dataFim || ''}
                onChange={(e) => setDraftFiltrosPendentes({ dataFim: e.target.value })}
              />
            </div>
            <div className="filtro-grupo filtro-grupo--action">
              <label>&nbsp;</label>
              <Button
                variant="primary"
                onClick={applyFiltrosPendentes}
                disabled={loadingPendentes}
              >
                {loadingPendentes ? 'Carregando...' : 'Filtrar'}
              </Button>
            </div>
          </div>

          <Card className="tab-filtro-preview">
            <CardContent>
              {loadingPendentes ? (
                <div className="tab-loading">
                  <CircularProgress size={32} />
                  <p>Carregando...</p>
                </div>
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
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabFiltro;
