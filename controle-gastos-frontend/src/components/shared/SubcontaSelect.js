import React, { useMemo } from 'react';
import Select from 'react-select';
import './SubcontaSelect.css';

const TIPOS_LABEL = {
  corrente: 'Corrente',
  rendimento_automatico: 'Rendimento Automático',
  caixinha: 'Caixinha',
  investimento_fixo: 'Investimento Fixo',
};

const formatLabel = (sc, showTipo = false) => {
  const inst = sc.instituicao?.nome || 'Inst';
  const tipo = showTipo ? ` (${TIPOS_LABEL[sc.tipo] || sc.tipo})` : '';
  return `${inst} - ${sc.nome}${tipo}`;
};

const SubcontaSelect = ({
  subcontas = [],
  value,
  onChange,
  placeholder = 'Selecione a subconta',
  filterTipos,
  showTipo = false,
  allowEmpty = false,
  className = '',
  tabIndex,
}) => {
  const options = useMemo(() => {
    let list = subcontas;
    if (filterTipos && Array.isArray(filterTipos)) {
      list = list.filter((sc) => filterTipos.includes(sc.tipo));
    }
    return list.map((sc) => ({
      value: sc._id,
      label: formatLabel(sc, showTipo),
      subconta: sc,
    }));
  }, [subcontas, filterTipos, showTipo]);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const formatOptionLabel = (option) => {
    const cor = option.subconta?.instituicao?.cor || 'var(--cor-primaria)';
    return (
      <div className="subconta-select-option">
        <span
          className="subconta-select-indicator"
          style={{ backgroundColor: cor }}
          aria-hidden
        />
        <span>{option.label}</span>
      </div>
    );
  };

  const selectOptions = allowEmpty
    ? [{ value: '', label: 'Nenhuma', subconta: null }, ...options]
    : options;

  return (
    <Select
      className={`subconta-select ${className}`.trim()}
      tabIndex={tabIndex}
      options={selectOptions}
      value={selectedOption || (allowEmpty ? { value: '', label: 'Nenhuma', subconta: null } : null)}
      onChange={(opt) => onChange(opt?.value ?? '')}
      placeholder={placeholder}
      formatOptionLabel={formatOptionLabel}
      isClearable={allowEmpty}
      styles={{
        control: (base, state) => ({
          ...base,
          borderColor: state.isFocused ? 'var(--cor-primaria)' : 'var(--cor-borda, #ddd)',
          boxShadow: state.isFocused ? '0 0 0 1px var(--cor-primaria)' : 'none',
          minHeight: '38px',
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isFocused ? 'var(--cor-fundo-hover, #f5f5f5)' : base.backgroundColor,
          color: state.isFocused ? 'var(--cor-texto)' : base.color,
        }),
        menu: (base) => ({ ...base, zIndex: 9999 }),
      }}
    />
  );
};

export default SubcontaSelect;
