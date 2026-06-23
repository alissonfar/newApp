// src/components/shared/GradientBackground.js
// Componente de fundo com orbs de profundidade para glassmorphism.
// Renderiza-se atrás do conteúdo mas com z-index 0 (não negativo) para
// que o backdrop-filter do menu lateral (z-index 1000) consiga enxergar
// os orbs como conteúdo por trás — efeito glass completo.
// O gradiente base do body vem do GlobalStyles (Fase 1).

import React from 'react';

const GradientBackground = ({ mode = 'light' }) => {
  const accentColor = mode === 'light' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.25)';

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
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
