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
import Login from './pages/Login/Login';         // Página de Login
import PrivateRoute from './components/Rotas/PrivateRoute'; // Rota privada
import Registro from './pages/Registro/Registro';

import { AuthProvider } from './context/AuthContext'; // Contexto de Autenticação

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <MainLayout>
          <Routes>
            {/* Rota pública */}
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            
            {/* Rotas protegidas */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Home />
                </PrivateRoute>
              }
            />
            <Route
              path="/relatorio"
              element={
                <PrivateRoute>
                  <Relatorio />
                </PrivateRoute>
              }
            />
            <Route
              path="/transacoes"
              element={
                <PrivateRoute>
                  <Transacoes />
                </PrivateRoute>
              }
            />
            <Route
              path="/insights"
              element={
                <PrivateRoute>
                  <Insights />
                </PrivateRoute>
              }
            />
            <Route
              path="/tags"
              element={
                <PrivateRoute>
                  <Tags />
                </PrivateRoute>
              }
            />
          </Routes>
        </MainLayout>
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </AuthProvider>
  );
}

export default App;
