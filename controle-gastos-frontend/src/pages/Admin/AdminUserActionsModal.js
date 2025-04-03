import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaKey, FaCheckCircle, FaTimes, FaSpinner, FaCopy, FaUserShield, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import api from '../../services/api';
import './AdminUserActionsModal.css'; // Criaremos este CSS depois

// Define os roles e status permitidos fora do componente para referência
const ALLOWED_ROLES = ['comum', 'pro', 'admin']; 
const ALLOWED_STATUSES = ['ativo', 'inativo', 'bloqueado'];

function AdminUserActionsModal({ usuario, onClose, onActionSuccess }) {
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [loadingRole, setLoadingRole] = useState(false); // Estado de loading para Role
  const [loadingStatus, setLoadingStatus] = useState(false); // Estado de loading para Status

  const [tempPassword, setTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);

  // Estados locais para os selects, inicializados com os valores atuais do usuário
  const [selectedRole, setSelectedRole] = useState(usuario?.role || 'comum');
  const [selectedStatus, setSelectedStatus] = useState(usuario?.status || 'ativo');

  // Efeito para atualizar os selects se o usuário prop mudar (embora neste modal, geralmente não muda)
  useEffect(() => {
    setSelectedRole(usuario?.role || 'comum');
    setSelectedStatus(usuario?.status || 'ativo');
  }, [usuario]);

  // Verifica se qualquer ação está em andamento
  const isLoading = loadingReset || loadingVerify || loadingRole || loadingStatus;

  const handleResetPassword = async () => {
    if (isLoading) return;
    setLoadingReset(true);
    setTempPassword('');
    setShowTempPassword(false);
    try {
      const response = await api.post(`/admin/usuarios/${usuario._id}/resetar-senha`);
      const newTempPassword = response.data.senhaTemporaria;
      const successMessage = response.data.mensagem;
      
      setTempPassword(newTempPassword);
      setShowTempPassword(true);
      
      if (onActionSuccess) {
        onActionSuccess(successMessage, 'reset');
      } else {
        toast.success(successMessage);
      }
    } catch (error) {
      toast.error(error.response?.data?.erro || 'Erro ao resetar senha.');
      onClose();
    } finally {
      setLoadingReset(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPassword).then(() => {
      toast.info('Senha temporária copiada!');
    }, (err) => {
      toast.error('Falha ao copiar a senha.');
      console.error('Erro ao copiar para clipboard:', err);
    });
  };

  const handleVerifyEmail = async () => {
    if (isLoading || usuario.emailVerificado) return;
    setLoadingVerify(true);
    try {
      const response = await api.put(`/admin/usuarios/${usuario._id}/verify-email`);
      if (response.data.mensagem === "O email deste usuário já está verificado.") {
        toast.info(response.data.mensagem);
      } else {
          if (onActionSuccess) {
            onActionSuccess(response.data.mensagem, 'verify', response.data.usuario);
          } else {
            toast.success(response.data.mensagem);
          }
      }
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.erro || 'Erro ao verificar email.');
    } finally {
      setLoadingVerify(false);
    }
  };

  // Handler para mudar o Role
  const handleUpdateRole = async () => {
    if (isLoading || selectedRole === usuario.role) return; // Não faz nada se não mudou
    setLoadingRole(true);
    try {
      const response = await api.put(`/admin/usuarios/${usuario._id}/role`, { newRole: selectedRole });
      if (onActionSuccess) {
        onActionSuccess(response.data.mensagem, 'updateRole', response.data.usuario);
      } else {
        toast.success(response.data.mensagem);
      }
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.erro || 'Erro ao atualizar role.');
      // Reverte a seleção local em caso de erro
      setSelectedRole(usuario.role);
    } finally {
      setLoadingRole(false);
    }
  };

  // Handler para mudar o Status
  const handleUpdateStatus = async () => {
    if (isLoading || selectedStatus === usuario.status) return;
    setLoadingStatus(true);
    try {
      const response = await api.put(`/admin/usuarios/${usuario._id}/status`, { newStatus: selectedStatus });
       if (onActionSuccess) {
        onActionSuccess(response.data.mensagem, 'updateStatus', response.data.usuario);
      } else {
        toast.success(response.data.mensagem);
      }
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.erro || 'Erro ao atualizar status.');
      // Reverte a seleção local
      setSelectedStatus(usuario.status);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleClose = () => {
      setTempPassword('');
      setShowTempPassword(false);
      onClose();
  }

  // Verifica se o admin está tentando editar a si mesmo para desabilitar certas ações
  // (Assumindo que `AuthContext` pode ser importado e usado aqui, ou que o ID do admin é passado como prop)
  // Para simplificar e evitar importar AuthContext aqui, faremos a checagem apenas no backend por enquanto.
  const isEditingSelf = false; // Placeholder - idealmente, verificar `authContext.usuario._id === usuario._id`

  return (
    <div className="admin-actions-modal-backdrop">
      <div className="admin-actions-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={handleClose} disabled={isLoading}>
          <FaTimes />
        </button>
        <h2>Ações para {usuario.nome}</h2>
        <p>Email: {usuario.email}</p>

        {showTempPassword && (
          <div className="temp-password-section">
            <p><strong>Senha Temporária:</strong></p>
            <div className="temp-password-display">
              <code>{tempPassword}</code>
              <button onClick={copyToClipboard} title="Copiar Senha">
                <FaCopy />
              </button>
            </div>
            <small>Informe esta senha ao usuário. Ela deverá ser alterada no próximo login.</small>
          </div>
        )}

        {!showTempPassword && (
          <div className="modal-actions-list">
            {/* Botões de Ação Direta */}
            <div className="action-buttons-group">
              <button 
                className="modal-action-button reset-button" 
                onClick={handleResetPassword} 
                disabled={isLoading}
              >
                {loadingReset ? <><FaSpinner className="spinner" /> Resetando...</> : <><FaKey /> Resetar Senha</>}
              </button>

              <button 
                className="modal-action-button verify-button" 
                onClick={handleVerifyEmail} 
                disabled={isLoading || usuario.emailVerificado}
                title={usuario.emailVerificado ? "Email já verificado" : "Marcar email como verificado"}
              >
                {loadingVerify ? <><FaSpinner className="spinner" /> Verificando...</> : <><FaCheckCircle /> {usuario.emailVerificado ? 'Email Verificado' : 'Verificar Email'}</>}
              </button>
            </div>

            {/* Ações com Select */}
            <div className="select-actions-group">
              {/* Alterar Role */}
              <div className="select-action-item">
                <label htmlFor="role-select"><FaUserShield /> Role:</label>
                <select 
                  id="role-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  disabled={isLoading || isEditingSelf} // Desabilita se editando a si mesmo
                  className={selectedRole !== usuario.role ? 'changed' : ''} // Classe se valor mudou
                >
                  {ALLOWED_ROLES.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button 
                  onClick={handleUpdateRole} 
                  disabled={isLoading || selectedRole === usuario.role || isEditingSelf}
                  className="save-select-button"
                >
                  {loadingRole ? <FaSpinner className="spinner-small"/> : 'Salvar Role'}
                </button>
              </div>

              {/* Alterar Status */}
              <div className="select-action-item">
                <label htmlFor="status-select">{selectedStatus === 'ativo' ? <FaToggleOn/> : <FaToggleOff/>} Status:</label>
                <select 
                  id="status-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  disabled={isLoading || isEditingSelf}
                  className={selectedStatus !== usuario.status ? 'changed' : ''}
                >
                   {ALLOWED_STATUSES.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                 <button 
                  onClick={handleUpdateStatus} 
                  disabled={isLoading || selectedStatus === usuario.status || isEditingSelf}
                  className="save-select-button"
                >
                   {loadingStatus ? <FaSpinner className="spinner-small"/> : 'Salvar Status'}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUserActionsModal; 