import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FaSpinner, FaEye, FaCog } from 'react-icons/fa';
import UserDetailsModal from './UserDetailsModal';
import AdminUserActionsModal from './AdminUserActionsModal';
import './UserList.css';

function UserList() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(null);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState(null);

  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [selectedUserForActions, setSelectedUserForActions] = useState(null);

  useEffect(() => {
    carregarUsuarios(paginaAtual);
  }, [paginaAtual]);

  const carregarUsuarios = async (pagina) => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/usuarios?pagina=${pagina}&limite=10&select=nome,email,role,createdAt,status,emailVerificado`); 
      setUsuarios(response.data.usuarios);
      setTotalPaginas(response.data.totalPaginas);
      setPaginaAtual(response.data.paginaAtual);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error('Erro ao carregar lista de usuários.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (userId) => {
    setLoadingDetails(userId);
    try {
      const response = await api.get(`/admin/usuarios/${userId}`);
      setSelectedUserForDetails(response.data); 
      setIsDetailsModalOpen(true);
    } catch (error) {
      console.error("Erro ao buscar detalhes do usuário:", error);
      toast.error('Erro ao buscar detalhes do usuário.');
    } finally {
      setLoadingDetails(null);
    }
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedUserForDetails(null);
  };

  const handleOpenActionsModal = (user) => {
    setSelectedUserForActions(user);
    setIsActionsModalOpen(true);
  };

  const handleCloseActionsModal = () => {
    setIsActionsModalOpen(false);
    setSelectedUserForActions(null);
  };

  const handleActionSuccess = (message, actionType) => {
    if (actionType !== 'reset') {
      handleCloseActionsModal();
    }
    toast.success(message);
    if (actionType === 'verify') {
      carregarUsuarios(paginaAtual);
    }
  };

  const irParaPaginaAnterior = () => {
    if (paginaAtual > 1) {
      setPaginaAtual(paginaAtual - 1);
    }
  };

  const irParaProximaPagina = () => {
    if (paginaAtual < totalPaginas) {
      setPaginaAtual(paginaAtual + 1);
    }
  };

  return (
    <div className="user-list-container">
      {loading ? (
        <div className="loading-spinner"><FaSpinner className="spinner" /> Carregando...</div>
      ) : (
        <>
          <table className="user-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Data Cadastro</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario._id}>
                  <td>{usuario.nome}</td>
                  <td>{usuario.email}</td>
                  <td><span className={`role-badge role-${usuario.role}`}>{usuario.role}</span></td>
                  <td><span className={`status-badge status-${usuario.status}`}>{usuario.status}</span></td>
                  <td>{new Date(usuario.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="actions-cell">
                    <button 
                      className="action-button view-button"
                      onClick={() => handleViewDetails(usuario._id)}
                      disabled={loadingDetails === usuario._id}
                      title="Ver Detalhes"
                    >
                      {loadingDetails === usuario._id ? <FaSpinner className="spinner-small" /> : <FaEye />}
                    </button>
                    <button 
                      className="action-button manage-button"
                      onClick={() => handleOpenActionsModal(usuario)}
                      title="Gerenciar Ações"
                    >
                      <FaCog />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {totalPaginas > 1 && (
             <div className="pagination-controls">
               <button onClick={irParaPaginaAnterior} disabled={paginaAtual === 1}>
                 Anterior
               </button>
               <span>Página {paginaAtual} de {totalPaginas}</span>
               <button onClick={irParaProximaPagina} disabled={paginaAtual === totalPaginas}>
                 Próxima
               </button>
            </div>
           )}
        </>
      )}

      {isDetailsModalOpen && selectedUserForDetails && (
        <UserDetailsModal 
          usuario={selectedUserForDetails} 
          onClose={handleCloseDetailsModal} 
        />
      )}

      {isActionsModalOpen && selectedUserForActions && (
        <AdminUserActionsModal
          usuario={selectedUserForActions}
          onClose={handleCloseActionsModal}
          onActionSuccess={handleActionSuccess}
        />
      )}
    </div>
  );
}

export default UserList; 