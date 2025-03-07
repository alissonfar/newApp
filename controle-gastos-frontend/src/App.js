// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Home from './pages/Home/Home';
import Relatorio from './pages/Relatorio/Relatorio';
import Transacoes from './pages/Transacoes/Transacoes';
import Insights from './pages/Insights/Insights';
import Tags from './pages/Tags/Tags';
import Login from './pages/Login/Login';
import Registro from './pages/Registro/Registro';
import Profile from './pages/Profile/Profile';

import MainLayout from './components/Layout/MainLayout';
import PrivateRoute from './components/Rotas/PrivateRoute';
import { AuthProvider } from './context/AuthContext';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Rotas Públicas (sem MainLayout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />

          {/* Rotas Privadas: usam <PrivateRoute> e envolvem o conteúdo em <MainLayout> */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout>
                  <Home />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/relatorio"
            element={
              <PrivateRoute>
                <MainLayout>
                  <Relatorio />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/transacoes"
            element={
              <PrivateRoute>
                <MainLayout>
                  <Transacoes />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/insights"
            element={
              <PrivateRoute>
                <MainLayout>
                  <Insights />
                </MainLayout>
              </PrivateRoute>
            }
          />
          <Route
            path="/tags"
            element={
              <PrivateRoute>
                <MainLayout>
                  <Tags />
                </MainLayout>
              </PrivateRoute>
            }
          />

<Route
  path="/profile"
  element={
    <PrivateRoute>
      <MainLayout>
        <Profile />
      </MainLayout>
    </PrivateRoute>
  }
/>

          {/* Opcional: rota para tratar caminhos inexistentes */}
          {/* <Route path="*" element={<Navigate to="/login" replace />} /> */}
        </Routes>
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
