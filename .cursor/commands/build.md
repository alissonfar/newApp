Preciso que você prepare o frontend para produção.

O objetivo é:

Rodar o build completo, identificar TODOS os erros, e realizar as correções necessárias até termos um build 100% funcional e pronto para deploy.

⚠️ Importante:
Não quero correções paliativas ou gambiarras apenas para o build passar.
Quero correções estruturais e seguras.

🎯 OBJETIVO

Executar:

npm run build

ou

next build

(depende do projeto)

E:

Identificar todos os erros

Classificar os erros por tipo

Corrigir com abordagem correta

Validar novamente

Repetir até build limpo

Garantir que a aplicação continue funcional

🔍 PROCESSO OBRIGATÓRIO
1️⃣ Rodar o build e registrar TODOS os erros

Separar por categoria:

❌ TypeScript errors

❌ Erros de tipagem implícita

❌ Imports incorretos

❌ Variáveis não utilizadas

❌ Hooks mal utilizados

❌ Erros de renderização

❌ Problemas de SSR (se Next.js)

❌ Uso de window/localStorage no SSR

❌ Problemas de dependências

❌ Problemas de environment variables

❌ Erros de lint bloqueando build

❌ Problemas de tipagem em API responses

❌ Incompatibilidades com strict mode

2️⃣ Para cada erro

Você deve:

Explicar a causa raiz

Identificar o impacto

Propor a melhor solução

Aplicar correção limpa

Evitar "any" desnecessário

Evitar desabilitar regra de ESLint só para passar

⚠️ Proibido:

Usar // @ts-ignore sem justificativa

Transformar tudo em any

Desativar regras globais

Silenciar erros sem entender causa

3️⃣ Pontos críticos para revisar mesmo se não quebrarem

Mesmo que o build passe, revisar:

🔹 Uso incorreto de useEffect

Dependências faltando

setState durante render

Loops infinitos

🔹 Componentes com render condicional inseguro
🔹 Acesso a dados possivelmente undefined

Exemplo errado:

data.map(...)

Sem validar.

🔹 Problemas de hidratação (Next.js)

Conteúdo diferente server/client

Uso de Date()

Uso de Math.random()

🔹 Variáveis de ambiente

Verificar:

NEXT_PUBLIC_

Uso correto no client/server

4️⃣ Após build limpo

Executar:

Revisão de performance

Verificar warnings

Verificar bundle size

Verificar imports desnecessários

Remover console.logs esquecidos

Garantir tipagem forte nos principais fluxos:

Transações

Parcelamento

Importação

Filtros

Dashboard

🧠 Análise Arquitetural

Durante as correções:

Verifique se existem padrões repetidos errados

Se há código duplicado

Se há tipagem inconsistente entre front e back

Se há funções utilitárias que deveriam ser centralizadas

Se identificar padrão problemático, proponha refatoração controlada.

📦 ENTREGA ESPERADA

Quero que você entregue:

Lista inicial de erros encontrados

Classificação por tipo

Correções aplicadas

Justificativa técnica das correções

Pontos sensíveis encontrados

Melhorias arquiteturais sugeridas

Confirmação final: BUILD OK

Checklist final de produção

🔒 REGRAS IMPORTANTES

Não quebre funcionalidades existentes

Não altere regra de negócio sem justificar

Se algo for arriscado, explique antes

Priorize segurança e consistência

🚀 Objetivo Final

Frontend pronto para:

Deploy em produção

Ambiente com NODE_ENV=production

Sem warnings críticos

Sem erros de tipagem

Sem falhas SSR

Estruturalmente sólido