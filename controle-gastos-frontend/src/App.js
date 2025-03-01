// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Home from './pages/Home/Home';
import Relatorio from './pages/Relatorio/Relatorio';
import Transacoes from './pages/Transacoes/Transacoes';
import Insights from './pages/Insights/Insights';
import Tags from './pages/Tags/Tags';
import './App.css';

function App() {
  return (
    <Router>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/relatorio" element={<Relatorio />} />
          <Route path="/transacoes" element={<Transacoes />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/tags" element={<Tags />} />
        </Routes>
      </MainLayout>
    </Router>
  );
}

export default App;
