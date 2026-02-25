import React from 'react';
import UserList from './UserList';
import BackupManagement from './BackupManagement';
import './AdminDashboard.css';

function AdminDashboard() {
  return (
    <div className="admin-dashboard-container">
      <h1>Painel de Administração</h1>
      <div className="admin-content">
        <section className="user-management-section">
          <h2>Gerenciamento de Usuários</h2>
          <UserList />
        </section>
        <BackupManagement />
      </div>
    </div>
  );
}

export default AdminDashboard; 