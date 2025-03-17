import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

function PrivateRoute({ children, requireEmailVerification = true }) {
  const { token, emailVerificado, carregando } = useContext(AuthContext);

  if (carregando) {
    return null; // ou um componente de loading
  }

  // Se não estiver autenticado, redireciona para a página de login
  if (!token) {
    return <Navigate to="/login" />;
  }

  // Se a rota requer verificação de email e o email não está verificado
  if (requireEmailVerification && !emailVerificado) {
    return <Navigate to="/email-nao-verificado" />;
  }

  return children;
}

export default PrivateRoute;
