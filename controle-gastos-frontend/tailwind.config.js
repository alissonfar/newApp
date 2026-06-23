// tailwind.config.js
const tokens = require('./src/theme/tokens.js').default;

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  important: false, // agora respeita ordem CSS natural
  theme: {
    extend: {
      colors: {
        primary: tokens.color.light.primary,
        'primary-hover': tokens.color.light.primaryHover,
        secondary: tokens.color.light.secondary,
        background: tokens.color.light.background,
        'text-primary': tokens.color.light.textPrimary,
        'text-secondary': tokens.color.light.textSecondary,
        'text-muted': tokens.color.light.textMuted,
        success: tokens.color.light.success,
        error: tokens.color.light.error,
        warning: tokens.color.light.warning,
        info: tokens.color.light.info,
      },
      borderRadius: {
        sm: tokens.radius.sm,
        md: tokens.radius.md,
        lg: tokens.radius.lg,
        xl: tokens.radius.xl,
        full: tokens.radius.full,
      },
      spacing: {
        xs: tokens.spacing.xs,
        sm: tokens.spacing.sm,
        md: tokens.spacing.md,
        base: tokens.spacing.base,
        lg: tokens.spacing.lg,
        xl: tokens.spacing.xl,
        '2xl': tokens.spacing['2xl'],
        '3xl': tokens.spacing['3xl'],
      },
      fontFamily: {
        sans: tokens.font.family.split(',').map(s => s.trim()),
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
  corePlugins: {
    preflight: true,
  },
};
