import React from 'react';
import './UserDetailsModal.css';
import { FaTimes, FaUser, FaEnvelope, FaPhone, FaCalendar, FaVenusMars, 
         FaInfoCircle, FaBriefcase, FaBuilding, FaLinkedin, FaTwitter, 
         FaInstagram, FaClock, FaCheckCircle, FaBan, FaDollarSign, 
         FaMoon, FaSun, FaBell, FaUserShield, FaExclamationTriangle } from 'react-icons/fa';

function UserDetailsModal({ usuario, onClose }) {
  if (!usuario) return null;

  // Função auxiliar para formatar datas
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch (e) {
      return 'Data inválida';
    }
  };

  // Função auxiliar para exibir booleanos como Sim/Não
  const formatBoolean = (value) => {
    return value === true ? 'Sim' : (value === false ? 'Não' : 'N/A');
  };

  // Função auxiliar para capitalizar strings (ex: role, genero)
  const capitalize = (str) => {
    if (!str) return 'N/A';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <div className="modal-overlay" onClick={onClose}> {/* Fecha ao clicar fora */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Impede fechar ao clicar dentro */}
        <button className="modal-close-button" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Detalhes do Usuário</h2>
        
        <div className="user-details-grid">
          {/* Informações Pessoais */}
          <div className="detail-item">
            <span className="detail-label"><FaUser /> Nome:</span>
            <span className="detail-value">{usuario.nome || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaEnvelope /> Email:</span>
            <span className="detail-value">{usuario.email || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaCheckCircle /> Email Verificado:</span>
            <span className={`detail-value ${usuario.emailVerificado ? 'text-success' : 'text-warning'}`}>
                {formatBoolean(usuario.emailVerificado)}
                {!usuario.emailVerificado && <FaExclamationTriangle title="Email não verificado" />}    
            </span>
          </div>
           <div className="detail-item">
            <span className="detail-label"><FaUserShield /> Role:</span>
            <span className={`detail-value role-badge role-${usuario.role}`}>{capitalize(usuario.role)}</span>
          </div>
           <div className="detail-item">
            <span className="detail-label"><FaBan /> Status:</span>
            <span className={`detail-value status-badge status-${usuario.status}`}>{capitalize(usuario.status)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaPhone /> Telefone:</span>
            <span className="detail-value">{usuario.telefone || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaCalendar /> Data de Nascimento:</span>
            <span className="detail-value">{usuario.dataNascimento ? new Date(usuario.dataNascimento).toLocaleDateString('pt-BR') : 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaVenusMars /> Gênero:</span>
            <span className="detail-value">{capitalize(usuario.genero)}</span>
          </div>

          {/* Informações Profissionais e Biografia */}
          <div className="detail-item long-text">
            <span className="detail-label"><FaInfoCircle /> Biografia:</span>
            <span className="detail-value">{usuario.biografia || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaBriefcase /> Cargo:</span>
            <span className="detail-value">{usuario.cargo || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaBuilding /> Empresa:</span>
            <span className="detail-value">{usuario.empresa || 'N/A'}</span>
          </div>

          {/* Redes Sociais */}
          <div className="detail-item">
            <span className="detail-label"><FaLinkedin /> LinkedIn:</span>
            <span className="detail-value">{usuario.redesSociais?.linkedin || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaTwitter /> Twitter:</span>
            <span className="detail-value">{usuario.redesSociais?.twitter || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaInstagram /> Instagram:</span>
            <span className="detail-value">{usuario.redesSociais?.instagram || 'N/A'}</span>
          </div>

          {/* Preferências */}
          <div className="detail-item">
            <span className="detail-label"><FaSun />/<FaMoon /> Tema:</span>
            <span className="detail-value">{capitalize(usuario.preferencias?.tema)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaBell /> Notificações Email:</span>
            <span className="detail-value">{formatBoolean(usuario.preferencias?.notificacoes?.email)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaBell /> Notificações Push:</span>
            <span className="detail-value">{formatBoolean(usuario.preferencias?.notificacoes?.push)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaDollarSign /> Moeda Padrão:</span>
            <span className="detail-value">{usuario.preferencias?.moedaPadrao || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaUser /> Proprietário Preferencial:</span>
            <span className="detail-value">{usuario.preferencias?.proprietario || 'N/A'}</span>
          </div>

          {/* Timestamps */}
          <div className="detail-item">
            <span className="detail-label"><FaClock /> Data de Criação:</span>
            <span className="detail-value">{formatDate(usuario.createdAt)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label"><FaClock /> Última Atualização:</span>
            <span className="detail-value">{formatDate(usuario.updatedAt)}</span>
          </div>
           <div className="detail-item">
            <span className="detail-label"><FaClock /> Último Acesso:</span>
            <span className="detail-value">{formatDate(usuario.ultimoAcesso)}</span>
          </div>
        </div>

        {/* Área para futuros botões de ação */}
        {/* <div className="modal-actions">
          <button className="action-button edit-button">Editar Role</button>
          <button className="action-button danger-button">Bloquear Usuário</button>
        </div> */}

      </div>
    </div>
  );
}

export default UserDetailsModal; 