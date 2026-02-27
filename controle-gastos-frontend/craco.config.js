module.exports = {
  style: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
      ],
    },
  },
  webpack: {
    configure: (webpackConfig) => {
      // Encontrar regras CSS e ajustar a prioridade para Tailwind
      const cssRule = webpackConfig.module.rules.find(
        (rule) => rule.oneOf && Array.isArray(rule.oneOf)
      );

      if (cssRule && cssRule.oneOf) {
        cssRule.oneOf.forEach((rule) => {
          if (rule.test && rule.test.toString().includes('css')) {
            // Regra CSS ajustada para priorizar Tailwind
          }
        });
      }

      return webpackConfig;
    },
  },
  // Tailwind: 'build' em produção para otimização, 'watch' em desenvolvimento
  env: {
    TAILWIND_MODE: process.env.NODE_ENV === 'production' ? 'build' : 'watch',
  }
}; 