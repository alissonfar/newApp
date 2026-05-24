import React from 'react';
import { Tooltip } from '@mui/material';

const DateFieldWithShortcuts = React.memo(({ value, onChange, onToday, onYesterday, tabIndex = 3 }) => {
  return (
    <div className="form-section">
      <label>Data:</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        tabIndex={tabIndex}
      />
      <div className="date-shortcuts">
        <Tooltip title="Alt + H">
          <button type="button" onClick={onToday}>Hoje</button>
        </Tooltip>
        <Tooltip title="Alt + Y">
          <button type="button" onClick={onYesterday}>Ontem</button>
        </Tooltip>
      </div>
    </div>
  );
});

export default DateFieldWithShortcuts;
