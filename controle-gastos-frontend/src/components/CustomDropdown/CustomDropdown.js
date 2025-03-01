// src/components/CustomDropdown.js
import React from 'react';
import Select from 'react-select';

// Estilos customizados para o React-Select
const customStyles = {
  control: (provided, state) => ({
    ...provided,
    border: state.isFocused ? '1px solid var(--cor-primaria)' : '1px solid #ccc',
    boxShadow: state.isFocused ? '0 0 0 1px var(--cor-primaria)' : 'none',
    borderRadius: '4px',
    padding: '4px',
    minHeight: '38px',
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 9999,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? 'var(--cor-primaria)' : '#fff',
    color: state.isFocused ? '#fff' : '#333',
    cursor: 'pointer',
  }),
};

const CustomDropdown = ({
  options,
  value,
  onChange,
  isMulti = false,
  placeholder = 'Selecione...',
}) => {
  return (
    <Select
      options={options}
      value={value}
      onChange={onChange}
      isMulti={isMulti}
      placeholder={placeholder}
      styles={customStyles}
    />
  );
};

export default CustomDropdown;
