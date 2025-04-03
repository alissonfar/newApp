import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FaKey, FaCheckCircle, FaTimes, FaSpinner, FaCopy } from 'react-icons/fa';
import api from '../../services/api';
import './AdminUserActionsModal.css'; // Criaremos este CSS depois

function AdminUserActionsModal({ usuario, onClose, onActionSuccess }) {
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);

  const handleResetPassword = async () => {
    if (loadingReset || loadingVerify) return;
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
    if (loadingReset || loadingVerify || usuario.emailVerificado) return;
    setLoadingVerify(true);
    try {
      const response = await api.put(`/admin/usuarios/${usuario._id}/verify-email`);
      if (response.data.mensagem === "O email deste usuário já está verificado.") {
        toast.info(response.data.mensagem);
      } else {
          if (onActionSuccess) {
            onActionSuccess(response.data.mensagem, 'verify');
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

  const handleClose = () => {
      setTempPassword('');
      setShowTempPassword(false);
      onClose();
  }

  return (
    <div className="admin-actions-modal-backdrop">
      <div className="admin-actions-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={handleClose} disabled={loadingReset || loadingVerify}>
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
            <button 
              className="modal-action-button reset-button" 
              onClick={handleResetPassword} 
              disabled={loadingReset || loadingVerify}
            >
              {loadingReset ? (
                <><FaSpinner className="spinner" /> Resetando...</>
              ) : (
                <><FaKey /> Resetar Senha</>
              )}
            </button>

            <button 
              className="modal-action-button verify-button" 
              onClick={handleVerifyEmail} 
              disabled={loadingReset || loadingVerify || usuario.emailVerificado}
              title={usuario.emailVerificado ? "Email já verificado" : "Marcar email como verificado"}
            >
              {loadingVerify ? (
                <><FaSpinner className="spinner" /> Verificando...</>
              ) : (
                <><FaCheckCircle /> {usuario.emailVerificado ? 'Email Verificado' : 'Verificar Email'}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUserActionsModal; 