import React from 'react';
import { FaChevronRight, FaExclamationTriangle, FaEdit, FaTrash } from 'react-icons/fa';
import BadgeProposito from './BadgeProposito';
import MetaProgressBar from './MetaProgressBar';
import ActionDropdown from '../shared/ActionDropdown';
import './SubcontaItem.css';

const SubcontaItem = ({
  subconta,
  formatarMoeda,
  estaDesatualizada,
  progressoMeta,
  onNavigate,
  onEditar,
  onExcluir,
}) => {
  const pctMeta = progressoMeta ? progressoMeta(subconta) : null;
  const desatualizada = estaDesatualizada ? estaDesatualizada(subconta) : false;

  const dropdownItems = [
    { label: 'Editar', icon: <FaEdit size={12} />, onClick: () => onEditar?.(subconta) },
    { label: 'Excluir', icon: <FaTrash size={12} />, onClick: () => onExcluir?.(subconta._id), variant: 'danger' },
  ].filter((i) => i.onClick);

  return (
    <li className="subconta-item">
      <div
        className="subconta-item__link"
        onClick={() => onNavigate?.(`/patrimonio/contas/${subconta._id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onNavigate?.(`/patrimonio/contas/${subconta._id}`)}
      >
        <FaChevronRight className="subconta-item__chevron" />
        <span className="subconta-item__nome">{subconta.nome}</span>
        <BadgeProposito proposito={subconta.proposito} className="subconta-item__badge" />
        <span className="subconta-item__saldo">{formatarMoeda(subconta.saldoAtual)}</span>
        {desatualizada && (
          <FaExclamationTriangle
            className="subconta-item__alerta"
            title="Saldo desatualizado"
            aria-label="Saldo desatualizado"
          />
        )}
        <div className="subconta-item__actions" onClick={(e) => e.stopPropagation()}>
          <ActionDropdown items={dropdownItems} ariaLabel="Ações da subconta" />
        </div>
      </div>
      <MetaProgressBar percentual={pctMeta} />
    </li>
  );
};

export default SubcontaItem;
