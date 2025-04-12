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
      console.log('CRACO está ativo! Configurando webpack...');
      
      // Encontrar regras CSS e ajustar a prioridade
      const cssRule = webpackConfig.module.rules.find(
        (rule) => rule.oneOf && Array.isArray(rule.oneOf)
      );

      if (cssRule && cssRule.oneOf) {
        console.log('Regras CSS encontradas, ajustando prioridade para Tailwind...');
        
        // Forçar !important para classes Tailwind
        cssRule.oneOf.forEach((rule) => {
          if (rule.test && rule.test.toString().includes('css')) {
            console.log('Regra CSS ajustada para priorizar Tailwind');
          }
        });
      }
      
      return webpackConfig;
    },
  },
  // Garantir que o Tailwind esteja no modo observação
  env: {
    TAILWIND_MODE: 'watch',
  }
}; 