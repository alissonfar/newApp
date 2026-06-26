// src/components/Layout/UserMenuFooter.js
// Rodapé da sidebar: avatar do usuário com dropdown (Perfil / Como Utilizar /
// Tema / Admin / Sair).
//
// Comportamento idêntico ao MainLayout.js original (pré-refatoração), mas
// isolado neste componente. Avatar é botão que alterna o dropdown; cliques
// fora fecham o dropdown (useEffect de click outside).
//
// No modo rail, mostra só o avatar centralizado — o dropdown fica escondido
// (não cabe em 72px).

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import myLogo from '../../assets/logo.png';
import ThemeToggle from '../shared/ThemeToggle';
import './UserMenuFooter.css';

const UserMenuFooter = ({
  usuario = null,
  isCollapsed = false,
  isMobile = false,
  isMobileMenuOpen = false,
  onLinkClick = () => {},
  onLogout = () => {},
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const footerRef = useRef(null);

  const showLabels = !isCollapsed || isMobile;
  const showUserInfo = !isCollapsed || (isMobile && isMobileMenuOpen);

  // Fecha dropdown ao clicar fora do footer
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileOpen && footerRef.current && !footerRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  // Fecha dropdown ao trocar de rota (link click)
  const handleLinkClick = () => {
    setProfileOpen(false);
    onLinkClick();
  };

  const handleAvatarClick = () => {
    setProfileOpen((open) => !open);
  };

  return (
    <div className="user-menu-footer" ref={footerRef}>
      {/* === AVATAR DO USUÁRIO (botão que abre dropdown) === */}
      {showUserInfo && (
        <button
          type="button"
          className="user-menu-avatar-row"
          onClick={handleAvatarClick}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
        >
          <img src={myLogo} alt="Avatar do usuário" className="user-menu-avatar" />
          <span className="user-menu-name">{usuario ? usuario.nome : 'Usuário'}</span>
          <ExpandMoreIcon
            className={`user-menu-arrow ${profileOpen ? 'open' : ''}`}
            fontSize="small"
          />
        </button>
      )}
      {!showUserInfo && (
        <div className="user-menu-avatar-row user-menu-avatar-center">
          <img src={myLogo} alt="Avatar do usuário" className="user-menu-avatar" />
          <span className="sidebar-rail-tooltip" role="tooltip">
            {usuario ? usuario.nome : 'Usuário'}
          </span>
        </div>
      )}

      {/* === DROPDOWN DE PERFIL === */}
      {profileOpen && showUserInfo && (
        <div className="profile-dropdown" role="menu">
          <Link
            to="/profile"
            className="profile-link"
            onClick={handleLinkClick}
            role="menuitem"
          >
            <HelpOutlineIcon fontSize="small" />
            <span>Meu Perfil</span>
          </Link>
          <Link
            to="/como-utilizar"
            className="profile-link"
            onClick={handleLinkClick}
            role="menuitem"
          >
            <HelpOutlineIcon fontSize="small" />
            <span>Como Utilizar</span>
          </Link>
          <div className="profile-dropdown-toggle-wrapper" role="menuitem">
            <ThemeToggle />
          </div>
          <hr className="profile-dropdown-divider" />
          {usuario?.role === 'admin' && (
            <Link
              to="/admin"
              className="profile-link"
              onClick={handleLinkClick}
              role="menuitem"
            >
              <AdminPanelSettingsIcon fontSize="small" />
              <span>Administração</span>
            </Link>
          )}
          <button
            type="button"
            className="profile-link logout-btn"
            onClick={() => {
              setProfileOpen(false);
              onLogout();
            }}
            role="menuitem"
          >
            <LogoutIcon fontSize="small" />
            <span>Sair</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenuFooter;
