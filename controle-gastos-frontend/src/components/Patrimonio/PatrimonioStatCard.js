import React from 'react';
import { FaPiggyBank, FaChartLine, FaBuilding, FaChartPie } from 'react-icons/fa';
import Card from '../shared/Card';
import Badge from '../shared/Badge';
import './PatrimonioStatCard.css';

const ICONE_MAP = {
  piggybank: FaPiggyBank,
  chartline: FaChartLine,
  building: FaBuilding,
  chartpie: FaChartPie,
};

const PatrimonioStatCard = ({
  label,
  valor,
  icon = 'piggybank',
  badge,
  corBorda,
  className = '',
}) => {
  const IconComponent = typeof icon === 'string' ? ICONE_MAP[icon] || FaPiggyBank : icon;

  return (
    <Card
      className={`patrimonio-stat-card ${className}`.trim()}
      style={corBorda ? { borderLeft: `4px solid ${corBorda}` } : undefined}
    >
      <div className="patrimonio-stat-card__inner">
        <div className="patrimonio-stat-card__icon" style={corBorda ? { color: corBorda } : undefined}>
          {typeof IconComponent === 'function' ? <IconComponent size={28} /> : IconComponent}
        </div>
        <div className="patrimonio-stat-card__content">
          <h3 className="patrimonio-stat-card__label">{label}</h3>
          <p className="patrimonio-stat-card__valor">{valor}</p>
          {badge && (
            <Badge variant={badge.variant || 'neutral'} className="patrimonio-stat-card__badge">
              {badge.label}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};

export default PatrimonioStatCard;
