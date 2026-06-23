// src/components/shared/GradientBackground.js
// Componente de fundo com gradiente vibrante + orbs de profundidade.
// Renderiza-se atrás de todo o conteúdo (z-index: -1, position: fixed).
// Necessário para o efeito glassmorphism funcionar: o menu lateral
// translúcido precisa de cor vibrante por trás para o blur fazer sentido.

import React from 'react';
import tokens from '../../theme/tokens.js';

const GradientBackground = ({ mode = 'light' }) => {
  const gradient = tokens.gradient[mode];
  const accentColor = mode === 'light' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.25)';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: gradient,
        pointerEvents: 'none',
      }}
    >
      {/* Orb superior esquerdo - dá profundidade ao canto */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '20%',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />
      {/* Orb inferior direito - equilíbrio visual */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
};

export default GradientBackground;
