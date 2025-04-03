import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

function AdminRoute() {
  const { usuario, token, carregando } = useContext(AuthContext);

  if (carregando) {
    return <div>Carregando...</div>; 
  }

  if (!token || usuario?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default AdminRoute; 