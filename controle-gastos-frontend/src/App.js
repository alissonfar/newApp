// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MainLayout from './components/Layout/MainLayout';
import Home from './pages/Home/Home';
import Relatorio from './pages/Relatorio/Relatorio';
import Transacoes from './pages/Transacoes/Transacoes';
import Insights from './pages/Insights/Insights';
import Tags from './pages/Tags/Tags';
import './App.css';

function App() {
  return (
    <>
      {/* Router para navegação */}
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

      {/* ToastContainer para exibir os toasts globalmente */}
      <ToastContainer
        position="top-right"   // Posição na tela (top-right, top-center, etc.)
        autoClose={3000}       // Tempo em ms para fechar automaticamente (3s)
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}            // Se precisar de suporte para idiomas RTL, defina como true
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"          // "light" ou "dark" (ou personalizado)
      />
    </>
  );
}

export default App;
