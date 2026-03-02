import React from 'react';
import { FaChartLine, FaSpinner, FaExclamationTriangle, FaSyncAlt } from 'react-icons/fa';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Card from '../shared/Card';
import Button from '../shared/Button';
import './CdiDataCard.css';

function formatarPercentual(valorDecimal) {
  if (valorDecimal == null) return '-';
  const percentual = (Number(valorDecimal) * 100).toFixed(2);
  return `${percentual}%`;
}

function CdiDataCard({ cdi, loading, error, onRefetch }) {

  if (loading) {
    return (
      <Card className="cdi-data-card cdi-data-card--loading">
        <div className="cdi-data-card__loading">
          <FaSpinner className="spinner" />
          <p>Carregando dados do CDI...</p>
        </div>
      </Card>
    );
  }

  if (error || !cdi) {
    return (
      <Card className="cdi-data-card cdi-data-card--erro">
        <div className="cdi-data-card__erro">
          <FaExclamationTriangle />
          <p>{error || 'Taxa CDI não disponível.'}</p>
          <Button variant="primary" size="sm" onClick={onRefetch}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  const dataFormatada = cdi.data || cdi.dataUltimaAtualizacao
    ? format(new Date(cdi.data || cdi.dataUltimaAtualizacao), "dd/MM/yyyy", { locale: ptBR })
    : '-';

  return (
    <Card className="cdi-data-card">
      <div className="cdi-data-card__header">
        <div className="cdi-data-card__icon">
          <FaChartLine size={24} />
        </div>
        <h3 className="cdi-data-card__title">Dados Atuais do CDI</h3>
        <Button variant="ghost" size="sm" icon={<FaSyncAlt size={12} />} onClick={onRefetch} disabled={loading} title="Atualizar dados">
          Atualizar
        </Button>
      </div>
      <div className="cdi-data-card__body">
        <div className="cdi-data-card__row">
          <span className="cdi-data-card__label">CDI anual</span>
          <span className="cdi-data-card__valor">{cdi.taxaAnual != null ? `${Number(cdi.taxaAnual).toFixed(2)}%` : '-'}</span>
        </div>
        <div className="cdi-data-card__row">
          <span className="cdi-data-card__label">CDI mensal equivalente</span>
          <span className="cdi-data-card__valor">{formatarPercentual(cdi.taxaMensalEquivalente)}</span>
        </div>
        <div className="cdi-data-card__row">
          <span className="cdi-data-card__label">CDI diário equivalente</span>
          <span className="cdi-data-card__valor">{formatarPercentual(cdi.taxaDiariaEquivalente)}</span>
        </div>
        <div className="cdi-data-card__row">
          <span className="cdi-data-card__label">Última atualização</span>
          <span className="cdi-data-card__valor">{dataFormatada}</span>
        </div>
        <div className="cdi-data-card__fonte">
          Fonte: Banco Central (api.bcb.gov.br)
        </div>
      </div>
    </Card>
  );
}

export default CdiDataCard;
