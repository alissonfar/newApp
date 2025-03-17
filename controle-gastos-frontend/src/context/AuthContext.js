import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [emailVerificado, setEmailVerificado] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    const carregarPerfil = async () => {
      if (token) {
        try {
          setCarregando(true);
          const response = await api.get('/usuarios/perfil');
          setUsuario(response.data);
          setEmailVerificado(response.data.emailVerificado || false);
        } catch (error) {
          console.error('Erro ao carregar perfil:', error);
          setToken('');
          setUsuario(null);
          setEmailVerificado(false);
        } finally {
          setCarregando(false);
        }
      } else {
        setUsuario(null);
        setEmailVerificado(false);
        setCarregando(false);
      }
    };

    carregarPerfil();
  }, [token]);

  const atualizarAutenticacao = (novoToken, novoUsuario) => {
    setToken(novoToken);
    setUsuario(novoUsuario);
    setEmailVerificado(novoUsuario?.emailVerificado || false);
  };

  const atualizarStatusEmail = (status) => {
    setEmailVerificado(status);
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      setToken, 
      usuario, 
      setUsuario,
      atualizarAutenticacao,
      carregando,
      emailVerificado,
      atualizarStatusEmail
    }}>
      {children}
    </AuthContext.Provider>
  );
}
