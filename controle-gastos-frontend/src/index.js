// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
// IBM Plex Sans (auto-hospedado via @fontsource)
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import 'react-calendar/dist/Calendar.css';
import App from './App';
// Importação CSS do projeto colocada por último para ter prioridade
import './theme/tokens.css';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
