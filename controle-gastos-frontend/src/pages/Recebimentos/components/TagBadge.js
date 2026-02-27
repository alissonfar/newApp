import React from 'react';
import IconRenderer from '../../../components/shared/IconRenderer';

const TagBadge = ({ tag, size = 14 }) => {
  if (!tag) return null;
  const cor = tag.cor || '#64748b';
  const icone = tag.icone || 'tag';
  return (
    <span
      className="tag-badge-recebimentos"
      style={{
        backgroundColor: `${cor}20`,
        color: cor,
        border: `1px solid ${cor}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.85rem',
        margin: '2px',
        whiteSpace: 'nowrap'
      }}
    >
      <IconRenderer nome={icone} size={size} cor={cor} />
      <span>{tag.nome}</span>
    </span>
  );
};

export default TagBadge;
