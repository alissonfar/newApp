// src/theme/tokens.js
// Fonte de verdade para cores, tipografia, espaçamentos e tokens visuais.
// Lido por tokens.css (gerado manualmente — manter sincronizado) e por muiTheme.js.

const tokens = {
  color: {
    light: {
      primary: '#2563EB',
      primaryHover: '#1d4ed8',
      primaryMuted: 'rgba(37, 99, 235, 0.08)',
      secondary: '#18181B',
      background: '#FAFAFA',
      surface: 'rgba(255, 255, 255, 0.65)',
      surfaceElevated: 'rgba(255, 255, 255, 0.85)',
      textPrimary: '#09090B',
      textSecondary: '#3F3F46',
      textMuted: '#71717A',
      border: 'rgba(15, 23, 42, 0.08)',
      borderStrong: 'rgba(15, 23, 42, 0.16)',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    },
    dark: {
      primary: '#60a5fa',
      primaryHover: '#93c5fd',
      primaryMuted: 'rgba(96, 165, 250, 0.15)',
      secondary: '#E4E4E7',
      background: '#0A0E27',
      surface: 'rgba(15, 23, 42, 0.55)',
      surfaceElevated: 'rgba(15, 23, 42, 0.75)',
      textPrimary: '#F8FAFC',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      border: 'rgba(248, 250, 252, 0.08)',
      borderStrong: 'rgba(248, 250, 252, 0.16)',
      success: '#34d399',
      error: '#f87171',
      warning: '#fbbf24',
      info: '#60a5fa',
    },
  },

  glass: {
    blur: '15px',
    blurStrong: '24px',
    opacityLight: '0.55',
    opacityMedium: '0.75',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderDark: '1px solid rgba(255, 255, 255, 0.08)',
  },

  gradient: {
    light: 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 45%, #fce7f3 100%)',
    dark: 'linear-gradient(135deg, #0a0e27 0%, #1e1b4b 60%, #312e81 100%)',
  },

  radius: {
    sm: '6px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    base: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },

  shadow: {
    sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 4px 12px rgba(15, 23, 42, 0.08)',
    lg: '0 12px 32px rgba(15, 23, 42, 0.12)',
    glow: '0 0 0 4px rgba(37, 99, 235, 0.15)',
  },

  font: {
    family: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '2rem',
    },
  },

  motion: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

export default tokens;
