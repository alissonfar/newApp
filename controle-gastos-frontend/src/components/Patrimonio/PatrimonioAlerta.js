import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import './PatrimonioAlerta.css';

const PatrimonioAlerta = ({ subcontasDesatualizadas, onNavigateSubconta }) => (
  <div className="patrimonio-alerta">
    <FaExclamationTriangle className="patrimonio-alerta__icon" aria-hidden />
    <div className="patrimonio-alerta__content">
      <strong>Subcontas desatualizadas</strong>
      <p>As seguintes subcontas não tiveram o saldo confirmado nos últimos 7 dias:</p>
      <ul>
        {subcontasDesatualizadas.map((s) => (
          <li key={s._id}>
            <button
              type="button"
              className="patrimonio-alerta__link"
              onClick={() => onNavigateSubconta?.(`/patrimonio/contas/${s._id}`)}
            >
              {s.instituicao} - {s.nome}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default PatrimonioAlerta;
