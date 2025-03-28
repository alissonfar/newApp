import React from 'react';

const icones = [
  'folder', 'tag', 'home', 'shopping-cart', 'car', 'food', 
  'health', 'education', 'entertainment', 'travel', 'work', 
  'gift', 'money', 'credit-card', 'savings', 'bill'
];

const IconSelector = ({ value, onChange, className }) => {
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {icones.map(icone => (
        <option key={icone} value={icone}>
          {icone.charAt(0).toUpperCase() + icone.slice(1).replace('-', ' ')}
        </option>
      ))}
    </select>
  );
};

export default IconSelector; 