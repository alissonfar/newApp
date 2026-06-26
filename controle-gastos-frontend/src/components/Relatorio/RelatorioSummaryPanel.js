// src/components/Relatorio/RelatorioSummaryPanel.js
// Card de resumo (3 StatCards + bloco de Informações Gerais).
// Extraído do Relatorio.js para reutilização e legibilidade.
import React from 'react';
import { FaArrowDown, FaArrowUp, FaPiggyBank } from 'react-icons/fa';
import { formatarMoeda } from '../../utils/format';
import Card, { CardHeader, CardContent } from '../shared/Card';
import SectionHeader from '../shared/SectionHeader';
import StatCard from '../shared/StatCard';

/**
 * Painel de resumo (3 StatCards no topo + bloco de Informações Gerais).
 *
 * @param {object} summary - Objeto vindo do backend / calcular a partir de `rows`
 *   { totalTransactions, totalValue, totalPeople, averagePerPerson,
 *     totalGastos, totalRecebiveis, netValue }
 * @param {string} title - Título da seção (default: "Resumo dos Resultados")
 * @param {string} subtitle - Subtítulo da seção
 * @param {string} className - Classes extras pro container
 */
const RelatorioSummaryPanel = ({
  summary,
  title = 'Resumo dos Resultados',
  subtitle = 'Visão geral do período filtrado',
  className = ''
}) => {
  const safe = summary || {
    totalTransactions: 0,
    totalValue: '0.00',
    totalPeople: 0,
    averagePerPerson: '0.00',
    totalGastos: '0.00',
    totalRecebiveis: '0.00',
    netValue: '0.00'
  };

  return (
    <Card variant="glass" padding="md" className={`relatorio-summary-panel ${className}`.trim()}>
      <CardHeader>
        <SectionHeader
          title={title}
          subtitle={subtitle}
        />
      </CardHeader>
      <CardContent>
        {/* 3 StatCards no topo (Recebíveis / Gastos / Saldo) */}
        <div className="cg-relatorio__stat-grid">
          <StatCard
            label="Recebíveis"
            value={formatarMoeda(safe.totalRecebiveis)}
            icon={<FaArrowUp />}
            accentColor="var(--cg-color-success)"
          />
          <StatCard
            label="Gastos"
            value={formatarMoeda(safe.totalGastos)}
            icon={<FaArrowDown />}
            accentColor="var(--cg-color-error)"
          />
          <StatCard
            label="Saldo"
            value={formatarMoeda(safe.netValue)}
            icon={<FaPiggyBank />}
            accentColor={parseFloat(safe.netValue) >= 0 ? 'var(--cg-color-info)' : 'var(--cg-color-error)'}
          />
        </div>

        {/* Bloco 1: informações gerais (mantido como lista compacta) */}
        <div className="summary-section">
          <h4>Informações Gerais</h4>
          <div className="summary-item">
            <span>Total de "Transações" (Pagamentos):</span>
            <span><strong>{safe.totalTransactions}</strong></span>
          </div>
          <div className="summary-item">
            <span>Total em Valor:</span>
            <span><strong>{formatarMoeda(safe.totalValue)}</strong></span>
          </div>
          <div className="summary-item">
            <span>Número de Pessoas:</span>
            <span><strong>{safe.totalPeople}</strong></span>
          </div>
          <div className="summary-item">
            <span>Média por Pessoa:</span>
            <span><strong>{formatarMoeda(safe.averagePerPerson)}</strong></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RelatorioSummaryPanel;
