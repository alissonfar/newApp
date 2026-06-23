// src/theme/GlobalStyles.js
import { GlobalStyles as MuiGlobalStyles } from '@mui/material';
import tokens from './tokens.js';

const GlobalStyles = (mode) => (
  <MuiGlobalStyles
    styles={{
      '*': { boxSizing: 'border-box' },
      body: {
        fontFamily: tokens.font.family,
        background: tokens.gradient[mode],
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
        margin: 0,
      },
      '::-webkit-scrollbar': { width: 10, height: 10 },
      '::-webkit-scrollbar-track': { background: 'transparent' },
      '::-webkit-scrollbar-thumb': {
        background: mode === 'light' ? 'rgba(15, 23, 42, 0.18)' : 'rgba(248, 250, 252, 0.18)',
        borderRadius: tokens.radius.full,
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: mode === 'light' ? 'rgba(15, 23, 42, 0.32)' : 'rgba(248, 250, 252, 0.32)',
      },
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': {
          animationDuration: '0.01ms !important',
          transitionDuration: '0.01ms !important',
        },
      },
    }}
  />
);

export default GlobalStyles;
