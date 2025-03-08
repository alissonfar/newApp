import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
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
      atualizarAutenticacao 
    }}>
      {children}
    </AuthContext.Provider>
  );
}
