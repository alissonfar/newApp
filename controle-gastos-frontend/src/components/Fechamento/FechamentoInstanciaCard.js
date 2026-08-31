// src/components/Fechamento/FechamentoInstanciaCard.js
import React from 'react';
import { FaFileDownload, FaLink, FaChevronDown, FaChevronUp, FaCopy } from 'react-icons/fa';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { extrairValorCru, extrairValorModelo, labelValorModelo } from '../../utils/fechamentoResumo';
import './FechamentoInstanciaCard.css';

const STATUS_LABEL = {
  aberto: 'Aberto',
  enviado: 'Enviado',
  aguardando_recebimento: 'Aguardando Recebimento',
  recebido: 'Recebido'
};

const STATUS_ORDER = ['aberto', 'enviado', 'aguardando_recebimento', 'recebido'];

function formatMoeda(valor) {
  const n = parseFloat(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(date) {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const FechamentoInstanciaCard = ({
  instancia,
  expandida,
  detalhe,
  selecionada,
  onToggleSelecao,
  onToggleExpandir,
  onGerarPDF,
  onDuplicar,
  onAvancarStatus,
  onAbrirLinkRecebimento
}) => {
  const pessoa = instancia.cadastro?.pessoa;
  const aggregationType = instancia.cadastro?.modeloRelatorio?.aggregation;
  const valorCru = extrairValorCru(instancia.resumoCru);
  const valorModelo = extrairValorModelo(instancia.resumoModelo, aggregationType);
  const statusAtual = instancia.status;
  const statusIndex = STATUS_ORDER.indexOf(statusAtual);
  const proximoStatusManual = statusAtual === 'aberto'
    ? 'enviado'
    : statusAtual === 'enviado'
      ? 'aguardando_recebimento'
      : null;

  return (
    <Card variant="glass" padding="lg" className="fechamento-card">
      <div className="fechamento-card__top">
        <input
          type="checkbox"
          className="fechamento-card__checkbox"
          checked={selecionada}
          onChange={() => onToggleSelecao(instancia._id)}
        />
        <div className="fechamento-card__identity">
          <p className="fechamento-card__name">{pessoa?.nome || 'Pessoa removida'}</p>
          <p className="fechamento-card__period">
            {formatData(instancia.dataInicio)} – {formatData(instancia.dataFim)} · {instancia.cadastro?.modeloRelatorio?.nome}
          </p>
        </div>
        <span className={`fechamento-status-pill fechamento-status-pill--${statusAtual}`}>
          {STATUS_LABEL[statusAtual]}
        </span>
      </div>

      <div className="fechamento-stepper">
        {STATUS_ORDER.map((s, i) => (
          <div key={s} className={`fechamento-stepper__seg ${i <= statusIndex ? 'done' : ''}`} />
        ))}
      </div>
      <div className="fechamento-stepper__labels">
        {STATUS_ORDER.map((s, i) => (
          <span key={s} className={i === statusIndex ? 'current' : ''}>{STATUS_LABEL[s]}</span>
        ))}
      </div>

      <div className="fechamento-card__totalrow">
        <span className="fechamento-card__txcount">
          {instancia.resumoModelo?.totalRows ?? 0} transações
        </span>
        <div className="fechamento-card__totals">
          <div className="fechamento-card__total-item">
            <span className="fechamento-card__total-label">Cru</span>
            <span className="fechamento-card__total-cru">{formatMoeda(valorCru)}</span>
          </div>
          <div className="fechamento-card__total-item">
            <span className="fechamento-card__total-label">{labelValorModelo(aggregationType)}</span>
            <span className="fechamento-card__total">{formatMoeda(valorModelo)}</span>
          </div>
        </div>
      </div>

      {expandida && (
        <div className="fechamento-detail">
          {detalhe?.loading && <p>Carregando transações...</p>}
          {!detalhe?.loading && (detalhe?.rows?.length ?? 0) === 0 && (
            <p className="fechamento-detail__empty">Nenhuma transação encontrada neste período.</p>
          )}
          {!detalhe?.loading && (detalhe?.rows?.length ?? 0) > 0 && (
            <table className="fechamento-tx-table">
              <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead>
              <tbody>
                {detalhe.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{formatData(row.data)}</td>
                    <td>{row.descricao}</td>
                    <td>{formatMoeda(row.valorPagamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="fechamento-link-box">
            {instancia.settlementId ? (
              <span className="fechamento-link-box__text">
                Linkado à conciliação <b>#{String(instancia.settlementId).slice(-6)}</b>
              </span>
            ) : (
              <>
                <span className="fechamento-link-box__text">Nenhum recebimento linkado ainda</span>
                <Button variant="ghost" size="sm" onClick={() => onAbrirLinkRecebimento(instancia)}>
                  <FaLink /> Linkar Recebimento
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="fechamento-card__actions">
        <Button variant="ghost" size="sm" onClick={() => onToggleExpandir(instancia._id)}>
          {expandida ? <FaChevronUp /> : <FaChevronDown />} {expandida ? 'Recolher' : 'Ver detalhe'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onGerarPDF(instancia)}>
          <FaFileDownload /> Gerar PDF
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDuplicar(instancia._id)}>
          <FaCopy /> Duplicar
        </Button>
        {proximoStatusManual && (
          <Button variant="secondary" size="sm" onClick={() => onAvancarStatus(instancia._id, proximoStatusManual)}>
            Marcar como {STATUS_LABEL[proximoStatusManual]}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default FechamentoInstanciaCard;
