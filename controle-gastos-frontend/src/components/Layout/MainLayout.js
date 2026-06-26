// src/components/Layout/MainLayout.js
// Orquestrador do layout: Header + Sidebar (SidebarMenu) + Footer (UserMenuFooter) + MainContent.
// A sidebar é "dado" via menuStructure; a lógica de menu vive em SidebarMenu.
// A lógica de perfil/avatar/logout vive em UserMenuFooter.
//
// Reduzido de 382 → ~150 linhas. Detalhes em:
// - SidebarMenu.js — renderiza items, submenus, sections, tooltip do rail
// - UserMenuFooter.js — renderiza avatar + Configurações + Admin + Logout
// - menuStructure.js — array declarativo de nodes
// - menuUtils.js — helpers de active state

import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import myLogo from '../../assets/logo.png';
import { AuthContext } from '../../context/AuthContext';
import BreadcrumbsNav from '../navigation/BreadcrumbsNav';
import GradientBackground from '../shared/GradientBackground';
import SidebarMenu from './SidebarMenu';
import UserMenuFooter from './UserMenuFooter';
import { menuStructure } from './menuStructure';
import './MainLayout.css';

const SIDEBAR_COLLAPSED_KEY = 'cg:sidebar-collapsed';

// Hook para detectar o tamanho da tela
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const documentChangeHandler = (e) => setMatches(e.matches);

    const addHandler = () => {
      try {
        mediaQueryList.addEventListener('change', documentChangeHandler);
      } catch (e) {
        mediaQueryList.addListener(documentChangeHandler);
      }
    };
    const removeHandler = () => {
      try {
        mediaQueryList.removeEventListener('change', documentChangeHandler);
      } catch (e) {
        mediaQueryList.removeListener(documentChangeHandler);
      }
    };

    addHandler();
    return removeHandler;
  }, [query]);

  return matches;
};

const MainLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, usuario, setToken, setUsuario } = useContext(AuthContext);

  // === ESTADO DE LAYOUT ===
  // isMenuCollapsed: persistido em localStorage (chave cg:sidebar-collapsed)
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 992px)');

  // Persiste estado de collapse no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isMenuCollapsed));
    } catch {
      // localStorage indisponível — silencioso
    }
  }, [isMenuCollapsed]);

  // === CALLBACKS ===
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUsuario(null);
    navigate('/login');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLinkClick = () => {
    if (isMobile) closeMobileMenu();
  };

  const handleToggleClick = () => {
    if (isMobile) {
      setIsMobileMenuOpen((open) => !open);
    } else {
      setIsMenuCollapsed((collapsed) => !collapsed);
    }
  };

  // Sincroniza estados quando redimensiona entre mobile/desktop
  useEffect(() => {
    if (!isMobile && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
    if (isMobile && isMenuCollapsed) {
      setIsMenuCollapsed(false);
    }
  }, [isMobile, isMobileMenuOpen, isMenuCollapsed]);

  // === AUTH CHECK ===
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/registro';
  if (!token || isAuthPage) {
    return <main className="main-content">{children}</main>;
  }

  // === CLASSES CSS ===
  const sideMenuClasses = [
    'side-menu',
    isMobile ? 'mobile' : 'desktop',
    isMobile
      ? isMobileMenuOpen
        ? 'mobile-menu-open'
        : ''
      : isMenuCollapsed
      ? 'collapsed'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const mainContentClasses = [
    'main-content',
    !isMobile ? (isMenuCollapsed ? 'expanded' : '') : 'mobile-menu-padding',
  ]
    .filter(Boolean)
    .join(' ');

  const showFullText = !isMenuCollapsed || isMobile;

  return (
    <div className="main-layout">
      <GradientBackground mode="light" />

      {/* Backdrop mobile (fecha drawer ao clicar fora) */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="mobile-menu-backdrop mobile-menu-backdrop-open"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Botão hamburger mobile (fora do aside) */}
      {isMobile && !isMobileMenuOpen && (
        <button
          type="button"
          className="main-menu-toggle main-menu-toggle-mobile main-menu-toggle-hamburger"
          onClick={handleToggleClick}
          aria-label="Abrir menu"
        >
          <MenuIcon fontSize="small" />
        </button>
      )}

      <aside className={sideMenuClasses}>
        {/* Botão X (mobile, dentro do aside) */}
        {isMobile && isMobileMenuOpen && (
          <button
            type="button"
            className="main-menu-toggle main-menu-toggle-mobile main-menu-toggle-close"
            onClick={handleToggleClick}
            aria-label="Fechar menu"
          >
            <CloseIcon fontSize="small" />
          </button>
        )}

        <div className="menu-top">
          <div className={`logo ${isMobile ? 'mobile-padding' : ''}`}>
            <img src={myLogo} alt="Logo" />
            {showFullText && <span className="system-name">Controle de Gastos</span>}
          </div>

          <div className="menu-items">
            <SidebarMenu
              menuStructure={menuStructure}
              currentPath={location.pathname}
              isCollapsed={isMenuCollapsed}
              isMobile={isMobile}
              onLinkClick={handleLinkClick}
            />
          </div>
        </div>

        <UserMenuFooter
          usuario={usuario}
          isCollapsed={isMenuCollapsed}
          isMobile={isMobile}
          isMobileMenuOpen={isMobileMenuOpen}
          onLinkClick={handleLinkClick}
          onLogout={handleLogout}
        />
      </aside>

      {/* Botão de toggle desktop (fora do aside) */}
      {!isMobile && (
        <button
          type="button"
          className="main-menu-toggle main-menu-toggle-desktop"
          onClick={handleToggleClick}
          aria-label={isMenuCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronLeftIcon fontSize="small" />
        </button>
      )}

      <main className={mainContentClasses}>
        <BreadcrumbsNav />
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
