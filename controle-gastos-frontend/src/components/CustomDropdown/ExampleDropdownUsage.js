// src/components/ExampleDropdownUsage.js
import React, { useState } from 'react';
import CustomDropdown from './CustomDropdown';

const ExampleDropdownUsage = () => {
  const options = [
    { value: 'opcao1', label: 'Opção 1' },
    { value: 'opcao2', label: 'Opção 2' },
    { value: 'opcao3', label: 'Opção 3' },
  ];

  const [selectedOption, setSelectedOption] = useState(null);

  return (
    <div style={{ maxWidth: '300px', margin: '20px auto' }}>
      <h3>Exemplo de Dropdown</h3>
      <CustomDropdown
        options={options}
        value={selectedOption}
        onChange={setSelectedOption}
        placeholder="Selecione uma opção"
      />
      <p>Selecionado: {selectedOption ? selectedOption.label : 'Nenhuma'}</p>
    </div>
  );
};

export default ExampleDropdownUsage;
