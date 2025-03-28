import React from 'react';
import './ColorPicker.css';

const cores = [
  '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
  '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b'
];

const ColorPicker = ({ value, onChange, className }) => {
  return (
    <div className="color-picker-container">
      <div 
        className="color-preview"
        style={{ backgroundColor: value || '#666' }}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`color-select ${className || ''}`}
        style={{ 
          backgroundColor: value,
          color: value ? (isLightColor(value) ? '#000' : '#fff') : '#000'
        }}
      >
        <option value="">Selecione uma cor</option>
        {cores.map(cor => (
          <option 
            key={cor} 
            value={cor}
            style={{ 
              backgroundColor: cor,
              color: isLightColor(cor) ? '#000' : '#fff'
            }}
          >
            {cor}
          </option>
        ))}
      </select>
    </div>
  );
};

// Função auxiliar para determinar se uma cor é clara ou escura
const isLightColor = (color) => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return brightness > 128;
};

export default ColorPicker; 