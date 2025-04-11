// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Home from './pages/Home/Home';
import Relatorio from './pages/Relatorio/Relatorio';
import Transacoes from './pages/Transacoes/Transacoes';
import NovaImportacaoPage from './pages/ImportacaoMassa/NovaImportacaoPage';
import GerenciamentoImportacoesPage from './pages/ImportacaoMassa/GerenciamentoImportacoesPage';
import DetalhesImportacaoPage from './pages/ImportacaoMassa/DetalhesImportacaoPage';
import Insights from './pages/Insights/Insights';
import Tags from './pages/Tags/Tags';
import Login from './pages/Login/Login';
import Registro from './pages/Registro/Registro';
import Profile from './pages/Profile/Profile';
import HowToUse from './pages/HowToUse/HowToUse';
import Regras from './pages/Regras';
import VerificarEmail from './pages/VerificarEmail/VerificarEmail';
import EmailNaoVerificado from './pages/EmailNaoVerificado/EmailNaoVerificado';
import EsqueciSenha from './pages/EsqueciSenha/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha/RedefinirSenha';
import AdminDashboard from './pages/Admin/AdminDashboard';
import EverestRoute from './EverestRoute';
import EverestPage from './pages/Everest/EverestPage';

import MainLayout from './components/Layout/MainLayout';
import PrivateRoute from './components/Rotas/PrivateRoute';
import AdminRoute from './AdminRoute';
import { AuthProvider } from './context/AuthContext';
import { ImportacaoProvider } from './contexts/ImportacaoContext';
import { DataProvider } from './context/DataContext';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <Router>
          <ImportacaoProvider>
            <Routes>
              {/* Rotas Públicas (sem MainLayout) */}
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/verificar-email/:token" element={<VerificarEmail />} />
              <Route path="/email-nao-verificado" element={<EmailNaoVerificado />} />
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />

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
                path="/importacao"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <GerenciamentoImportacoesPage />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/importacao/nova"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <NovaImportacaoPage />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/importacao/:id"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <DetalhesImportacaoPage />
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
              <Route
                path="/como-utilizar"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <HowToUse />
                    </MainLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/regras"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <Regras />
                    </MainLayout>
                  </PrivateRoute>
                }
              />

              {/* Rota de Administração - Estrutura Correta com Layout Route */}
              <Route element={<AdminRoute />}> {/* Elemento pai que aplica a proteção */}
                <Route 
                  path="/admin" 
                  element={ /* Elemento filho renderizado pelo Outlet do AdminRoute */
                    /* RESTAURANDO: Conteúdo original da página admin */
                    /* <div>Página Admin - Teste Direto Outlet v2</div> */ 
                     <MainLayout> 
                      <AdminDashboard />
                    </MainLayout> 
                  }
                />
                {/* Outras rotas que exigem admin podem ser aninhadas aqui */}
              </Route>

              {/* Rota Everest (requer role everest) */}
              <Route element={<EverestRoute />}> {/* Aplica a proteção EverestRoute */}
                <Route 
                  path="/everest" 
                  element={ /* Conteúdo renderizado pelo Outlet do EverestRoute */
                    <MainLayout> 
                      <EverestPage /> { /* Página placeholder dentro do layout */}
                    </MainLayout> 
                  }
                />
                {/* Outras rotas que exigem 'everest' podem ser aninhadas aqui */}
              </Route>
            </Routes>

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
          </ImportacaoProvider>
        </Router>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
