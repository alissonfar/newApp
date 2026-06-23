// src/components/shared/ThemeToggle.js
// Botão sol/lua que alterna entre tema claro e escuro.
// Usa o hook useThemeMode para ler o estado atual e alternar.
// Os dois ícones (FaSun e FaMoon) ficam empilhados; o CSS anima
// qual deles está visível com rotação + scale.

import React from 'react';
import { useThemeMode } from '../../hooks/useThemeMode.js';
import { FaSun, FaMoon } from 'react-icons/fa';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { mode, toggle } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <button
      type="button"
      className="cg-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Trocar para tema claro' : 'Trocar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      <span className={`cg-theme-toggle__icon ${isDark ? 'cg-theme-toggle__icon--visible' : ''}`}>
        <FaMoon />
      </span>
      <span className={`cg-theme-toggle__icon ${!isDark ? 'cg-theme-toggle__icon--visible' : ''}`}>
        <FaSun />
      </span>
    </button>
  );
};

export default ThemeToggle;
