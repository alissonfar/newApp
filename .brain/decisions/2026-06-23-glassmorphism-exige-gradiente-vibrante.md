---
type: decision
status: active
created: 2026-06-23
tags: [layout, glassmorphism, gradient, design-system]
---

# ADR-008: Glassmorphism em `MainLayout` exige gradiente vibrante visível atrás

## Contexto

Glassmorphism é uma estética baseada em `backdrop-filter: blur()` com fundos translúcidos. Para o efeito funcionar visualmente, é **obrigatório** ter algo visualmente interessante atrás do vidro (cores vibrantes, gradientes, formas). Sem isso, o efeito é imperceptível — o vidro borra o que está atrás, mas se atrás for branco chapado, não há diferença visível.

A modernização visual adotou glassmorphism. Mas o app tinha:
- Fundo do body cinza claro (`#f8f9fa` ou `#f5f7fa`)
- Menu lateral azul sólido (`#2c5282`) sem nada vibrante atrás
- `.main-content` com `background-color: #f8fafc` cobrindo o body

Resultado: o `backdrop-filter` do menu lateral não tinha nada para borrar visivelmente.

## Decisão

**Glassmorphism só funciona com gradiente vibrante visível atrás. Adotamos 3 medidas:**

1. **`GlobalStyles.js` aplica gradiente no `<body>`** (Fase 1.3):
   ```javascript
   body: {
     background: tokens.gradient[mode],  // light: azul→violeta→rosa
     backgroundAttachment: 'fixed',        // gradiente não rola com scroll
     minHeight: '100vh',
   }
   ```
   Garante gradiente em **toda rota** (incluindo `/login` e `/registro` que não passam pelo `MainLayout`).

2. **`MuiCssBaseline.body` é `transparent`** (Fase 2 — fix arquitetural):
   Sem isso, o CssBaseline pinta o body com cor sólida e esconde o gradiente.

3. **`<GradientBackground>` no `MainLayout` adiciona 2 orbs de profundidade** (`radial-gradient` borrados) atrás do conteúdo autenticado. Z-index 0 (não -1) para que o `backdrop-filter` do menu lateral capture os orbs como conteúdo borrado.

4. **`.main-content` é `transparent`** para o gradiente do body aparecer atrás dos cards de conteúdo.

5. **Mobile (≤768px) tem fallback:** menu vira opaco `rgba(15,23,42,0.96)` e `backdrop-filter: none` por questão de performance.

## Consequências

- **Pró:**
  - Efeito glass visível e funcional em todas as rotas autenticadas
  - Login/registro também ganham gradiente (via body)
  - Mobile não sofre com performance
- **Contra:**
  - Páginas que sobrescrevem o `body` ou `.main-content` com cor sólida quebram o efeito (precisam ser transparentes)
  - Risco de inconsistência se algum dev adicionar um `background-color: white` em algum container grande
- **Mitigação:**
  - Documentado no `GlobalStyles.js` e no design doc
  - Smoke test visual em cada nova página: gradiente visível atrás dos cards

## Relacionado

- ADR-006 (estrutura de tokens — o `gradient` está em `tokens.js`)
- Design doc seção "Glassmorphism"
