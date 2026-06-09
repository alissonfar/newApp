import React from 'react';
import Button from './Button';
import './Pagination.css';

const Pagination = ({ page, totalPages, totalRecords, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="ds-pagination">
      <Button
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </Button>
      <span className="ds-pagination__info">
        Página {page} de {totalPages}
        {totalRecords != null && (
          <span className="ds-pagination__total"> ({totalRecords} registros)</span>
        )}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Próxima
      </Button>
    </div>
  );
};

export default Pagination;
