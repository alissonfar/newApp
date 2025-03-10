import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

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
        } catch (error) {
          console.error('Erro ao carregar perfil:', error);
          setToken('');
          setUsuario(null);
        } finally {
          setCarregando(false);
        }
      } else {
        setUsuario(null);
        setCarregando(false);
      }
    };

    carregarPerfil();
  }, [token]);

  const atualizarAutenticacao = (novoToken, novoUsuario) => {
    setToken(novoToken);
    setUsuario(novoUsuario);
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      setToken, 
      usuario, 
      setUsuario,
      atualizarAutenticacao,
      carregando
    }}>
      {children}
    </AuthContext.Provider>
  );
}
