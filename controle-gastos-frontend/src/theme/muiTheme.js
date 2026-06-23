// src/theme/muiTheme.js
import { createTheme } from '@mui/material/styles';
import tokens from './tokens.js';

const buildTheme = (mode) => {
  const color = tokens.color[mode];

  return createTheme({
    palette: {
      mode,
      primary: {
        main: color.primary,
        dark: color.primaryHover,
        contrastText: mode === 'light' ? '#ffffff' : '#0a0e27',
      },
      secondary: {
        main: color.secondary,
      },
      success: { main: color.success },
      error: { main: color.error },
      warning: { main: color.warning },
      info: { main: color.info },
      background: {
        default: color.background,
        paper: color.surfaceElevated,
      },
      text: {
        primary: color.textPrimary,
        secondary: color.textSecondary,
        disabled: color.textMuted,
      },
      divider: color.border,
    },
    typography: {
      fontFamily: tokens.font.family,
      fontSize: 14,
      h1: { fontWeight: tokens.font.weights.bold, fontSize: tokens.font.sizes['3xl'] },
      h2: { fontWeight: tokens.font.weights.semibold, fontSize: tokens.font.sizes['2xl'] },
      h3: { fontWeight: tokens.font.weights.semibold, fontSize: tokens.font.sizes.xl },
      h4: { fontWeight: tokens.font.weights.medium, fontSize: tokens.font.sizes.lg },
      body1: { fontWeight: tokens.font.weights.normal, fontSize: tokens.font.sizes.base },
      body2: { fontWeight: tokens.font.weights.normal, fontSize: tokens.font.sizes.sm },
      button: { textTransform: 'none', fontWeight: tokens.font.weights.medium },
    },
    shape: {
      borderRadius: parseInt(tokens.radius.md, 10),
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: color.background,
            color: color.textPrimary,
            fontFamily: tokens.font.family,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: false },
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.md,
            textTransform: 'none',
            fontWeight: tokens.font.weights.medium,
            transition: `all ${tokens.motion.base} ${tokens.motion.easing}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: color.surfaceElevated,
            border: `1px solid ${color.border}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: color.surface,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: tokens.glass.border,
            borderRadius: tokens.radius.lg,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: color.surface,
            backdropFilter: `blur(${tokens.glass.blurStrong})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blurStrong})`,
            border: 'none',
            boxShadow: tokens.shadow.sm,
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: tokens.radius.md,
            backgroundColor: color.surfaceElevated,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: color.primary,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: color.primary,
              boxShadow: tokens.shadow.glow,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: color.surfaceElevated,
            backdropFilter: `blur(${tokens.glass.blurStrong})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blurStrong})`,
            border: tokens.glass.border,
            borderRadius: tokens.radius.lg,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: color.surfaceElevated,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: tokens.glass.border,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: mode === 'light' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(248, 250, 252, 0.92)',
            color: mode === 'light' ? '#F8FAFC' : '#0a0e27',
            fontSize: tokens.font.sizes.xs,
            borderRadius: tokens.radius.sm,
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            padding: 8,
          },
          track: {
            borderRadius: 22 / 2,
            backgroundColor: color.borderStrong,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: tokens.font.weights.medium,
          },
        },
      },
    },
  });
};

export const lightTheme = buildTheme('light');
export const darkTheme = buildTheme('dark');
