import React from 'react';
import './MetaProgressBar.css';

const MetaProgressBar = ({ percentual, className = '' }) => {
  if (percentual == null) return null;
  const pct = Math.min(100, Math.max(0, percentual));
  return (
    <div className={`meta-progress-bar ${className}`.trim()}>
      <div className="meta-progress-bar__track">
        <div
          className="meta-progress-bar__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="meta-progress-bar__label">{pct.toFixed(0)}% da meta</span>
    </div>
  );
};

export default MetaProgressBar;
