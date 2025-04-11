import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

function EverestRoute() {
  const { usuario, token, carregando } = useContext(AuthContext);

  if (carregando) {
    // Exibe um indicador de carregamento enquanto verifica a autenticação e o perfil
    return <div>Verificando acesso...</div>; 
  }

  // Redireciona para a Home se não houver token ou se o usuário NÃO tiver a role 'everest' OU 'admin'
  const isAuthorized = usuario?.role === 'everest' || usuario?.role === 'admin';

  if (!token || !isAuthorized) {
    console.warn(`Acesso negado à rota Everest para usuário com role '${usuario?.role || 'undefined'}'. Redirecionando...`);
    return <Navigate to="/" replace />;
  }

  // Se o usuário for 'everest' OU 'admin', permite o acesso à rota filha
  return <Outlet />;
}

export default EverestRoute; 