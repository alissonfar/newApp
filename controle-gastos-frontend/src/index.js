// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import 'react-calendar/dist/Calendar.css';
import App from './App';
// Importação CSS do projeto colocada por último para ter prioridade
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
