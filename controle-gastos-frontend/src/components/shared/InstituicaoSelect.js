import React, { useMemo } from 'react';
import Select from 'react-select';
import './SubcontaSelect.css';

const InstituicaoSelect = ({
  instituicoes = [],
  value,
  onChange,
  placeholder = 'Selecione a instituição',
  allowEmpty = false,
  disabled = false,
  className = '',
}) => {
  const options = useMemo(
    () =>
      instituicoes.map((inst) => ({
        value: inst._id,
        label: inst.nome,
        instituicao: inst,
      })),
    [instituicoes]
  );

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const formatOptionLabel = (option) => {
    const cor = option.instituicao?.cor || 'var(--cor-primaria)';
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
    ? [{ value: '', label: 'Selecione...', instituicao: null }, ...options]
    : options;

  return (
    <Select
      className={`subconta-select instituicao-select ${className}`.trim()}
      options={selectOptions}
      value={selectedOption || (allowEmpty ? { value: '', label: 'Selecione...', instituicao: null } : null)}
      onChange={(opt) => onChange(opt?.value ?? '')}
      placeholder={placeholder}
      formatOptionLabel={formatOptionLabel}
      isClearable={allowEmpty}
      isDisabled={disabled}
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

export default InstituicaoSelect;
