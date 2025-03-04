import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaHome, FaChartLine, FaLightbulb, FaWallet, FaTags } from 'react-icons/fa';
import myLogo from '../../assets/logo.png';
import './MainLayout.css';

const MainLayout = ({ children }) => {
  const location = useLocation();

  const menuItems = [
    { name: 'Home', path: '/', icon: <FaHome /> },
    { name: 'Relatórios', path: '/relatorio', icon: <FaChartLine /> },
    { name: 'Insights', path: '/insights', icon: <FaLightbulb /> },
    { name: 'Transações', path: '/transacoes', icon: <FaWallet /> },
    { name: 'Gerenciar Tags', path: '/tags', icon: <FaTags /> },
  ];

  return (
    <div className="main-layout">
      <aside className="side-menu">
        <div className="menu-top">
          <div className="logo">
            {/* Logo Genérico (Placeholder) */}
            <img
              src={myLogo}
              alt="Logo"
            />
            <span className="system-name">Controle de Gastos</span>
          </div>

          <nav className="menu-items">
            <ul>
              {menuItems.map(item => (
                <li
                  key={item.path}
                  className={location.pathname === item.path ? 'active' : ''}
                >
                  <Link to={item.path}>
                    <span className="menu-icon">{item.icon}</span>
                    <span className="menu-text">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="menu-footer">
          <div className="user-info">
            <img
              src={myLogo}
              alt="Avatar do usuário"
              className="avatar"
            />
            <span className="user-name">Alisson</span>
          </div>
          <div className="user-actions">
            <Link to="/profile">Configurações</Link>
            <Link to="/logout">Sair</Link>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
