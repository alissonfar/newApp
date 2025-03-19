// src/components/Layout/MainLayout.js
import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaChartLine, FaLightbulb, FaWallet, FaTags, FaBars, FaChevronLeft, FaQuestionCircle, FaCog, FaFileImport, FaClipboardList, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import myLogo from '../../assets/logo.png';
import { AuthContext } from '../../context/AuthContext';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, usuario, setToken, setUsuario } = useContext(AuthContext);
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);
  
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
        { name: 'Importação em Massa', path: '/importacao-em-massa', icon: <FaFileImport />, isSubItem: true },
        { name: 'Gerenciar Importações', path: '/gerenciar-importacoes', icon: <FaClipboardList />, isSubItem: true }
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

  // Toggle menu
  const toggleMenu = () => {
    setIsMenuCollapsed(!isMenuCollapsed);
  };

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

  // Se o usuário estiver autenticado e não estiver em /login ou /registro, exibe o layout completo
  return (
    <div className="main-layout">
      <aside className={`side-menu ${isMenuCollapsed ? 'collapsed' : ''}`}>
        <button className="menu-toggle" onClick={toggleMenu} title={isMenuCollapsed ? 'Expandir menu' : 'Recolher menu'}>
          <FaChevronLeft />
        </button>

        <div className="menu-top">
          <div className="logo">
            <img src={myLogo} alt="Logo" />
            {!isMenuCollapsed && <span className="system-name">Controle de Gastos</span>}
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
                        {!isMenuCollapsed && (
                          <>
                            <span className="menu-text">{item.name}</span>
                            <span className="submenu-arrow">
                              {expandedMenus[item.key] ? <FaChevronDown /> : <FaChevronRight />}
                            </span>
                          </>
                        )}
                      </a>
                      {expandedMenus[item.key] && !isMenuCollapsed && (
                        <ul className="submenu">
                          {item.submenu.map(subItem => (
                            <li key={subItem.path} className={location.pathname === subItem.path ? 'active' : ''}>
                              <Link to={subItem.path} className={`menu-item sub-item ${location.pathname === subItem.path ? 'active-item' : ''}`}>
                                <span className="menu-icon">{subItem.icon}</span>
                                <span className="menu-text">{subItem.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link to={item.path} className="menu-item">
                      <span className="menu-icon">{item.icon}</span>
                      {!isMenuCollapsed && <span className="menu-text">{item.name}</span>}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="menu-footer">
          <div className="user-info" onClick={handleProfileToggle}>
            <img src={myLogo} alt="Avatar do usuário" className="avatar" />
            {!isMenuCollapsed && (
              <span className="user-name">
                {usuario ? usuario.nome : 'Usuário'}
              </span>
            )}
          </div>

          {/* Se profileOpen for true, exibe o submenu */}
          {profileOpen && (
            <div className="profile-dropdown">
              <Link to="/profile" className="profile-link">Meu Perfil</Link>
              <Link to="/como-utilizar" className="profile-link">
                <FaQuestionCircle /> Como Utilizar
              </Link>
              <button onClick={handleLogout} className="profile-link logout-btn">Sair</button>
            </div>
          )}
        </div>
      </aside>

      <main className={`main-content ${isMenuCollapsed ? 'expanded' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
