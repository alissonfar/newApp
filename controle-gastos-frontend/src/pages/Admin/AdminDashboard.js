import React from 'react';
import UserList from './UserList';
import BackupManagement from './BackupManagement';
import PageHeader from '../../components/shared/PageHeader';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import './AdminDashboard.css';

function AdminDashboard() {
  return (
    <div className="admin-dashboard-container">
      <PageHeader icon={<AdminPanelSettingsIcon />} title="Painel de Administração" />
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