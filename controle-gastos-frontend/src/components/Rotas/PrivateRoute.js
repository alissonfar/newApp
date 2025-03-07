import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

function PrivateRoute({ children }) {
  const { token } = useContext(AuthContext);
  // Se não estiver autenticado, redireciona para a página de login
  if (!token) {
    return <Navigate to="/login" />;
  }
  return children;
}

export default PrivateRoute;
