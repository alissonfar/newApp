// Sistema de design para relatórios PDF
// Paleta de cores (primary mantém o azul original do relatório)
export const colors = {
  primary: '#2980b9',
  primaryLight: '#eff6ff',
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    700: '#334155',
    900: '#0f172a',
  },
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  white: '#ffffff',
};

// Hierarquia tipográfica
export const typography = {
  h1: { fontSize: 24, fontWeight: 700 },
  h2: { fontSize: 12, fontWeight: 600 },
  h3: { fontSize: 11, fontWeight: 600 },
  body: { fontSize: 10 },
  small: { fontSize: 9 },
  caption: { fontSize: 8 },
};

// Espaçamento
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
