import React from 'react';
import UserList from './UserList'; // Componente para listar usuários
import './AdminDashboard.css'; // Arquivo CSS para estilos

function AdminDashboard() {
  return (
    <div className="admin-dashboard-container">
      <h1>Painel de Administração</h1>
      <div className="admin-content">
        <section className="user-management-section">
          <h2>Gerenciamento de Usuários</h2>
          <UserList />
        </section>
        {/* Outras seções de administração podem ser adicionadas aqui no futuro */}
      </div>
    </div>
  );
}

export default AdminDashboard; 