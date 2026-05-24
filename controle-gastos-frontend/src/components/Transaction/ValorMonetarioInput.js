import React, { forwardRef } from 'react';

const ValorMonetarioInput = forwardRef(({ value, onChange, showWarning, label = 'Valor Total:', tabIndex = 4, name }, ref) => {
  return (
    <div className="form-section">
      <label>{label}</label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={onChange}
        required
        ref={ref}
        tabIndex={tabIndex}
        name={name}
        style={showWarning ? { borderColor: '#ff9800', borderWidth: '2px' } : {}}
      />
      {showWarning && (
        <div style={{
          color: '#ff9800',
          fontSize: '12px',
          marginTop: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          ⚠️ Soma dos pagamentos diferente do valor total
        </div>
      )}
    </div>
  );
});

export default React.memo(ValorMonetarioInput);
