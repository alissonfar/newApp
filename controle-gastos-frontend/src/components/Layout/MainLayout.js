// src/components/Layout/MainLayout.js
import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaChartLine, FaLightbulb, FaWallet, FaTags, FaBars, FaChevronLeft, FaQuestionCircle, FaCog, FaFileImport, FaClipboardList, FaChevronDown, FaChevronRight, FaUser, FaSignOutAlt, FaUserShield, FaTimes } from 'react-icons/fa';
import myLogo from '../../assets/logo.png';
import { AuthContext } from '../../context/AuthContext';
import './MainLayout.css';

// Hook para detectar o tamanho da tela
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const documentChangeHandler = (e) => setMatches(e.matches);

    // Atualizar o estado quando a media query mudar
    try {
        mediaQueryList.addEventListener('change', documentChangeHandler);
    } catch (e) {
      // Fallback para navegadores mais antigos
      mediaQueryList.addListener(documentChangeHandler);
    }


    // Cleanup listener na desmontagem
    return () => {
        try {
            mediaQueryList.removeEventListener('change', documentChangeHandler);
        } catch (e) {
            // Fallback para navegadores mais antigos
            mediaQueryList.removeListener(documentChangeHandler);
        }
    };
  }, [query]);

  return matches;
};

const MainLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, usuario, setToken, setUsuario } = useContext(AuthContext);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 992px)');
  
  // Estado para controlar quais submenus estão expandidos
  const [expandedMenus, setExpandedMenus] = useState({
    transacoes: true // Inicialmente expandido
  });

  // Toggle para expandir/colapsar submenus
  const toggleSubmenu = (key, event) => {
    event.preventDefault(); // Previne a navegação do link
    setExpandedMenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Função para verificar se um item está ativo
  const isActive = (path) => {
    return location.pathname === path;
  };

  // Função para verificar se o item pai deve ser destacado
  const isParentActive = (submenuPaths) => {
    return submenuPaths.some(path => location.pathname === path);
  };

  // Menu lateral
  const menuItems = [
    { name: 'Home', path: '/', icon: <FaHome /> },
    { name: 'Relatórios', path: '/relatorio', icon: <FaChartLine /> },
    { name: 'Insights', path: '/insights', icon: <FaLightbulb /> },
    { 
      name: 'Transações', 
      path: null, 
      icon: <FaWallet />,
      hasSubmenu: true,
      key: 'transacoes',
      submenu: [
        { name: 'Listar Transações', path: '/transacoes', icon: <FaClipboardList />, isSubItem: true },
        { name: 'Importação em Massa', path: '/importacao', icon: <FaFileImport />, isSubItem: true }
      ]
    },
    { name: 'Gerenciar Tags', path: '/tags', icon: <FaTags /> },
    { name: 'Regras de Automação', path: '/regras', icon: <FaCog /> },
  ];

  // Controle de exibição do menu de perfil
  const [profileOpen, setProfileOpen] = useState(false);
  const handleProfileToggle = () => {
    setProfileOpen(!profileOpen);
  };

  // Função de logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUsuario(null);
    navigate('/login');
  };

  // Função para fechar o menu mobile
  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Função para lidar com clique nos links do menu (fecha mobile)
  const handleMenuLinkClick = () => {
    if (isMobile) {
      closeMobileMenu();
    }
    // Se precisar de lógica adicional para links, adicione aqui
  };

  // Função de Toggle principal (controla ambos os estados mobile/desktop)
  const handleToggleClick = () => {
    if (isMobile) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    } else {
      setIsMenuCollapsed(!isMenuCollapsed);
    }
  };

  // Fecha menu mobile se redimensionar para desktop
  useEffect(() => {
    if (!isMobile && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
    // Fecha o menu colapsado se redimensionar para mobile
    if (isMobile && isMenuCollapsed) {
        setIsMenuCollapsed(false); // Garante que o menu não fique colapsado no mobile
    }
  }, [isMobile, isMobileMenuOpen, isMenuCollapsed]);

  // Adicionar handler para fechar o menu ao clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      const menuFooter = document.querySelector('.menu-footer');
      if (profileOpen && menuFooter && !menuFooter.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  // Verifica se está em /login ou /registro ou não há token
  const isAuthPage = location.pathname === '/login' || location.pathname === '/registro';
  if (!token || isAuthPage) {
    // Se estiver em /login ou /registro (ou sem token), não exibe o menu lateral
    return (
      <main className="main-content">
        {children}
      </main>
    );
  }

  // Determina as classes CSS para o menu lateral
  const sideMenuClasses = [
    'side-menu',
    isMobile ? 'mobile' : 'desktop',
    isMobile ? (isMobileMenuOpen ? 'mobile-menu-open' : '') : (isMenuCollapsed ? 'collapsed' : ''),
  ].filter(Boolean).join(' ');

  // Determina as classes CSS para o conteúdo principal
  const mainContentClasses = [
    'main-content',
    // Aplica 'expanded' no desktop quando colapsado
    // Aplica 'mobile-menu-padding' no mobile sempre (para botão fixo)
    !isMobile ? (isMenuCollapsed ? 'expanded' : '') : 'mobile-menu-padding',
  ].filter(Boolean).join(' ');

  // Se o usuário estiver autenticado, exibe o layout completo
  return (
    <div className="main-layout">
      {/* Backdrop para fechar menu mobile */}
      {isMobile && isMobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={closeMobileMenu}></div>
      )}

      {/* BOTÕES DE TOGGLE CONDICIONAIS */}

      {/* Botão Hamburger (Mobile - Menu Fechado - FORA do Aside) */}
      {isMobile && !isMobileMenuOpen && (
        <button
          className="main-menu-toggle mobile-hamburger-toggle"
          onClick={handleToggleClick}
          title="Abrir menu"
        >
          <FaBars />
        </button>
      )}

      {/* INVERTENDO ORDEM: Aside ANTES do botão Desktop */}
      <aside className={sideMenuClasses}>
          {/* Botão Fechar 'X' (Mobile - Menu Aberto - DENTRO do Aside) */}
          {isMobile && isMobileMenuOpen && (
             <button
                className="main-menu-toggle mobile-close-toggle"
                onClick={handleToggleClick}
                title="Fechar menu"
             >
                <FaTimes />
             </button>
          )}

        <div className="menu-top">
           {/* Adiciona padding interno no topo APENAS se for mobile para o botão 'X' */}
           <div className={`logo ${isMobile ? 'mobile-padding' : ''}`}>
              <img src={myLogo} alt="Logo" />
               {/* Oculta nome se colapsado no desktop OU se for mobile (independente de aberto/fechado) */}
              {/*!isMenuCollapsed && !isMobile && <span className="system-name">Controle de Gastos</span>*/}
               {/* Mostra nome se não colapsado E não for mobile */}
              {!isMenuCollapsed && !isMobile && <span className="system-name">Controle de Gastos</span>}
               {/* OU se for mobile E o menu estiver aberto */}
              {isMobile && isMobileMenuOpen && <span className="system-name">Controle de Gastos</span>}
           </div>

           <nav className="menu-items">
             <ul>
              {menuItems.map(item => (
                <li
                  key={item.path || item.key}
                  className={`${item.hasSubmenu && isParentActive(item.submenu.map(subItem => subItem.path)) ? 'active' : (location.pathname === item.path ? 'active' : '')} ${item.hasSubmenu ? 'has-submenu' : ''}`}
                >
                  {item.hasSubmenu ? (
                    <>
                      <a href="#" 
                        onClick={(e) => toggleSubmenu(item.key, e)}
                        className="menu-item with-submenu"
                      >
                        <span className="menu-icon">{item.icon}</span>
                         {/* Oculta texto se colapsado no desktop */}
                        {(!isMenuCollapsed || isMobile) && (
                          <>
                            <span className="menu-text">{item.name}</span>
                            <span className="submenu-arrow">
                              {expandedMenus[item.key] ? <FaChevronDown /> : <FaChevronRight />}
                            </span>
                          </>
                        )}
                      </a>
                      {/* Mostra submenu se expandido E (não colapsado OU for mobile) */}
                      {expandedMenus[item.key] && (!isMenuCollapsed || isMobile) && (
                        <ul className="submenu">
                          {item.submenu.map(subItem => (
                            <li key={subItem.path} className={location.pathname === subItem.path ? 'active' : ''}>
                              <Link to={subItem.path} className={`menu-item sub-item ${location.pathname === subItem.path ? 'active-item' : ''}`} onClick={handleMenuLinkClick}>
                                <span className="menu-icon">{subItem.icon}</span>
                                <span className="menu-text">{subItem.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link to={item.path} className="menu-item" onClick={handleMenuLinkClick}>
                      <span className="menu-icon">{item.icon}</span>
                       {/* Oculta texto se colapsado no desktop */}
                      {(!isMenuCollapsed || isMobile) && <span className="menu-text">{item.name}</span>}
                    </Link>
                  )}
                </li>
              ))}
              
              {/* Admin Link */}
              {usuario?.role === 'admin' && (
                <li className={`${location.pathname === '/admin' ? 'active' : ''}`}>
                   <Link to="/admin" className="menu-item" onClick={handleMenuLinkClick}>
                     <span className="menu-icon"><FaUserShield /></span>
                      {/* Oculta texto se colapsado no desktop */}
                     {(!isMenuCollapsed || isMobile) && <span className="menu-text">Administração</span>}
                   </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <div className="menu-footer">
          <div className="user-info" onClick={handleProfileToggle}>
             {/* Sempre mostra avatar se não colapsado no desktop, ou se for mobile */}
             {(!isMenuCollapsed || isMobile) && <img src={myLogo} alt="Avatar do usuário" className="avatar" />}
             {/* Mostra nome/seta apenas se não colapsado desktop OU se mobile E menu aberto */}
             {(!isMenuCollapsed || (isMobile && isMobileMenuOpen)) && (
              <>
                <span className="user-name">
                  {usuario ? usuario.nome : 'Usuário'}
                </span>
                {/* Seta só no desktop não colapsado */}
                 {!isMenuCollapsed && !isMobile && <FaChevronDown className={`profile-arrow ${profileOpen ? 'open' : ''}`} />}
              </>
            )}
          </div>

          {/* Dropdown de perfil - mostra se profileOpen E (não colapsado desktop OU mobile) */}
          {profileOpen && (!isMenuCollapsed || isMobile) && (
            <div className="profile-dropdown">
              {/* ... links do dropdown com handleMenuLinkClick ... */}
              <Link to="/profile" className="profile-link" onClick={handleMenuLinkClick}>
                <FaUser />
                Meu Perfil
              </Link>
              <Link to="/como-utilizar" className="profile-link" onClick={handleMenuLinkClick}>
                <FaQuestionCircle />
                Como Utilizar
              </Link>
              <button onClick={handleLogout} className="profile-link logout-btn">
                <FaSignOutAlt />
                Sair
              </button>
            </div>
          )}
        </div>
      </aside>

       {/* Botão Desktop (Renderizado DEPOIS do Aside) */}
       {!isMobile && (
         <button
            className="main-menu-toggle desktop-toggle"
            onClick={handleToggleClick}
            title={isMenuCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <FaChevronLeft />
          </button>
      )}

      <main className={mainContentClasses}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
