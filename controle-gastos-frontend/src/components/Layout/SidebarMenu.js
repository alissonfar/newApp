// src/components/Layout/SidebarMenu.js
// Componente da sidebar: renderiza a estrutura declarativa (menuStructure)
// como seções com headers, items e submenus.
//
// Suporta:
// - Modo rail (esconde section labels e textos, mostra ícones centralizados)
// - Estado interno de submenus (expandedMenus)
// - Click fecha drawer mobile (callback onLinkClick)
// - Tooltip no modo rail para explicar cada item
// - Acessibilidade: aria-expanded, aria-current, aria-label nos headers

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { isSubmenuActive } from './menuUtils';
import { defaultExpandedMenus } from './menuStructure';
import './SidebarMenu.css';

const SidebarMenu = ({
  menuStructure,
  currentPath,
  isCollapsed = false,
  isMobile = false,
  onLinkClick = () => {},
}) => {
  // Estado interno: quais submenus estão expandidos.
  // Inicializa com defaults (transacoes: true, outros: false).
  const [expandedMenus, setExpandedMenus] = useState(defaultExpandedMenus);

  const toggleSubmenu = (key) => {
    setExpandedMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Modo rail = texto e section labels escondidos, item ativo com borda lateral visível.
  // No mobile sempre mostra texto (drawer nunca é rail).
  const showLabels = !isCollapsed || isMobile;

  return (
    <nav className="sidebar-menu" aria-label="Menu principal">
      <ul className="sidebar-menu-list">
        {menuStructure.map((node) => {
          // Bloco 1: item raiz (Home) — destaque, sem header de seção
          if (node.type === 'item') {
            return (
              <li key={node.key || node.path} className="sidebar-menu-list-item">
                <Link
                  to={node.path}
                  onClick={onLinkClick}
                  className={`sidebar-item ${
                    currentPath === node.path ? 'sidebar-item-active' : ''
                  }`}
                  aria-current={currentPath === node.path ? 'page' : undefined}
                >
                  <span className="sidebar-item-icon">
                    <node.icon fontSize="small" />
                  </span>
                  {showLabels && <span className="sidebar-item-text">{node.name}</span>}
                  {!showLabels && (
                    <span className="sidebar-rail-tooltip" role="tooltip">
                      {node.name}
                    </span>
                  )}
                </Link>
              </li>
            );
          }

          // Bloco 2..N: seção com header
          if (node.type === 'section') {
            return (
              <li key={node.label} className="sidebar-section">
                {showLabels && (
                  <div className="sidebar-section-header" aria-label={node.label}>
                    <span className="sidebar-section-label">{node.label}</span>
                    <span className="sidebar-section-divider" aria-hidden="true" />
                  </div>
                )}
                <ul className="sidebar-section-items">
                  {node.items.map((item) => {
                    // submenu (pai com filhos)
                    if (item.type === 'submenu') {
                      const isExpanded = !!expandedMenus[item.key];
                      const isActive = isSubmenuActive(item, currentPath);
                      return (
                        <li
                          key={item.key}
                          className={`sidebar-menu-list-item has-submenu ${
                            isActive ? 'sidebar-item-active' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSubmenu(item.key)}
                            className="sidebar-item sidebar-item-with-submenu"
                            aria-expanded={isExpanded}
                          >
                            <span className="sidebar-item-icon">
                              <item.icon fontSize="small" />
                            </span>
                            {showLabels && (
                              <>
                                <span className="sidebar-item-text">{item.name}</span>
                                <span className="sidebar-submenu-arrow">
                                  {isExpanded ? (
                                    <ExpandMoreIcon fontSize="small" />
                                  ) : (
                                    <ChevronRightIcon fontSize="small" />
                                  )}
                                </span>
                              </>
                            )}
                            {!showLabels && (
                              <span className="sidebar-rail-tooltip" role="tooltip">
                                {item.name}
                              </span>
                            )}
                          </button>
                          {isExpanded && showLabels && (
                            <ul className="sidebar-submenu">
                              {item.items.map((child) => {
                                const isChildActive = currentPath === child.path;
                                return (
                                  <li
                                    key={child.key || child.path}
                                    className={`sidebar-submenu-item ${
                                      isChildActive ? 'sidebar-item-active' : ''
                                    }`}
                                  >
                                    <Link
                                      to={child.path}
                                      onClick={onLinkClick}
                                      className="sidebar-item sidebar-item-sub"
                                      aria-current={isChildActive ? 'page' : undefined}
                                    >
                                      <span className="sidebar-item-icon">
                                        <child.icon fontSize="small" />
                                      </span>
                                      <span className="sidebar-item-text">{child.name}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    }
                    // item simples dentro da seção
                    const isItemActive = currentPath === item.path;
                    return (
                      <li
                        key={item.key || item.path}
                        className={`sidebar-menu-list-item ${
                          isItemActive ? 'sidebar-item-active' : ''
                        }`}
                      >
                        <Link
                          to={item.path}
                          onClick={onLinkClick}
                          className="sidebar-item"
                          aria-current={isItemActive ? 'page' : undefined}
                        >
                          <span className="sidebar-item-icon">
                            <item.icon fontSize="small" />
                          </span>
                          {showLabels && <span className="sidebar-item-text">{item.name}</span>}
                          {!showLabels && (
                            <span className="sidebar-rail-tooltip" role="tooltip">
                              {item.name}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          }

          return null;
        })}
      </ul>
    </nav>
  );
};

export default SidebarMenu;
