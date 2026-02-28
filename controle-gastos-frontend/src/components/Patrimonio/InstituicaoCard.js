import React from 'react';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import Button from '../shared/Button';
import ActionDropdown from '../shared/ActionDropdown';
import SubcontaItem from './SubcontaItem';
import EmptyState from '../shared/EmptyState';
import './InstituicaoCard.css';

const TIPOS_LABEL = {
  banco_digital: 'Banco Digital',
  banco_tradicional: 'Banco Tradicional',
  carteira_digital: 'Carteira Digital',
  corretora: 'Corretora',
};

const InstituicaoCard = ({
  instituicao,
  subcontas,
  totalConsolidado,
  formatarMoeda,
  estaDesatualizada,
  progressoMeta,
  onNavigateSubconta,
  onAdicionarSubconta,
  onEditarInstituicao,
  onExcluirInstituicao,
  onEditarSubconta,
  onExcluirSubconta,
}) => {
  const cor = instituicao.cor || 'var(--cor-primaria)';
  const tipoLabel = TIPOS_LABEL[instituicao.tipo] || instituicao.tipo;

  const dropdownItems = [
    { label: 'Editar', icon: <FaEdit size={12} />, onClick: () => onEditarInstituicao?.(instituicao) },
    { label: 'Excluir', icon: <FaTrash size={12} />, onClick: () => onExcluirInstituicao?.(instituicao._id), variant: 'danger' },
  ].filter((i) => i.onClick);

  return (
    <div
      className="instituicao-card"
      style={{ borderLeftColor: cor }}
    >
      <div className="instituicao-card__header">
        <div className="instituicao-card__info">
          <h3 className="instituicao-card__nome">{instituicao.nome}</h3>
          <span className="instituicao-card__tipo">{tipoLabel}</span>
          <span className="instituicao-card__total">{formatarMoeda(totalConsolidado)}</span>
        </div>
        <div className="instituicao-card__actions">
          <ActionDropdown items={dropdownItems} ariaLabel="Ações da instituição" />
          <Button
            variant="success"
            size="sm"
            icon={<FaPlus size={12} />}
            onClick={() => onAdicionarSubconta?.(instituicao)}
          >
            Subconta
          </Button>
        </div>
      </div>
      <ul className="instituicao-card__subcontas">
        {subcontas.length === 0 ? (
          <li className="instituicao-card__empty">
            <EmptyState message='Nenhuma subconta. Clique em "Subconta" para adicionar.' />
          </li>
        ) : (
          subcontas.map((sc) => (
            <SubcontaItem
              key={sc._id}
              subconta={sc}
              formatarMoeda={formatarMoeda}
              estaDesatualizada={estaDesatualizada}
              progressoMeta={progressoMeta}
              onNavigate={onNavigateSubconta}
              onEditar={onEditarSubconta}
              onExcluir={onExcluirSubconta}
            />
          ))
        )}
      </ul>
    </div>
  );
};

export default InstituicaoCard;
