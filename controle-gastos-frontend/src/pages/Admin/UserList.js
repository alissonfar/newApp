import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FaKey, FaSpinner, FaEye } from 'react-icons/fa'; // Removidos Edit e TrashAlt por enquanto
import UserDetailsModal from './UserDetailsModal'; // Importa o modal
import './UserList.css'; // Arquivo CSS para estilos

function UserList() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(null); // ID do usuário cujos detalhes estão carregando
  const [loadingReset, setLoadingReset] = useState(null); // ID do usuário cuja senha está sendo resetada
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  // Estado para o modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    carregarUsuarios(paginaAtual);
  }, [paginaAtual]);

  const carregarUsuarios = async (pagina) => {
    setLoading(true);
    try {
      // Seleciona campos essenciais para a lista inicial
      const response = await api.get(`/admin/usuarios?pagina=${pagina}&limite=10&select=nome,email,role,createdAt,status`); 
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

  const handleResetSenha = async (userId, userName) => {
    if (!window.confirm(`Tem certeza que deseja resetar a senha do usuário ${userName}?`)) {
      return;
    }
    setLoadingReset(userId);
    try {
      const response = await api.post(`/admin/usuarios/${userId}/resetar-senha`);
      toast.success(response.data.mensagem);
      alert(`Senha temporária para ${userName}: ${response.data.senhaTemporaria}\n\nPor favor, anote e informe ao usuário. Esta senha não será exibida novamente.`);
    } catch (error) {
      console.error("Erro ao resetar senha:", error);
      toast.error(error.response?.data?.erro || 'Erro ao resetar senha do usuário.');
    } finally {
      setLoadingReset(null);
    }
  };

  // Função para buscar detalhes e abrir o modal
  const handleViewDetails = async (userId) => {
    setLoadingDetails(userId);
    try {
      const response = await api.get(`/admin/usuarios/${userId}`);
      setSelectedUser(response.data); // Armazena os dados completos
      setIsModalOpen(true); // Abre o modal
    } catch (error) {
      console.error("Erro ao buscar detalhes do usuário:", error);
      toast.error('Erro ao buscar detalhes do usuário.');
    } finally {
      setLoadingDetails(null);
    }
  };

  // Função para fechar o modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  // --- Funções de paginação ---
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
  // -----------------------------

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
                      className="action-button reset-button"
                      onClick={() => handleResetSenha(usuario._id, usuario.nome)}
                      disabled={loadingReset === usuario._id}
                      title="Resetar Senha"
                    >
                      {loadingReset === usuario._id ? <FaSpinner className="spinner-small" /> : <FaKey />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Paginação */}
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

      {/* Renderiza o modal condicionalmente */}
      {isModalOpen && (
        <UserDetailsModal usuario={selectedUser} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default UserList; 