---
type: decision
status: active
created: 2026-06-23
tags: [theme, css, inline-style, css-variable, tabela, thead, tbody, th, td, -webkit-text-fill-color, bug-pattern, design-system]
---

# ADR-012: Elementos com `color` / `-webkit-text-fill-color` herdado de wrappers globais NÃO respondem ao tema — usar CSS variable com `!important` em `App.css [data-theme="dark"]`

## Contexto

Em junho/2026, durante a modernização visual, descobrimos que vários elementos que deveriam reagir ao dark/light mode ficavam com cor presa (não respondiam ao toggle sem reload). O sintoma típico:

- Usuário clica no toggle dark/light
- Cards, botões, textos comuns mudam corretamente
- **Mas certos elementos (cabeçalho de tabela, corpo de tabela, alguns inputs custom) permanecem com cor fixa**
- Para reagir, era preciso dar F5 (reload)

## O padrão que descobrimos

O problema **NÃO é** sobre o token ou o `data-theme` em si. Esses funcionam. O problema é que **alguns elementos têm `color` (e/ou `-webkit-text-fill-color`) aplicado por um wrapper acima do escopo CSS padrão**, fora do cascade do `App.css`. Exemplos que encontramos:

- `<thead>` com `style={{ background: '#f1f5f9' }}` em `RevisaoMetadadosImportacao.js` — o background é inline JSX, mas a cor do `<th>` filho vinha de algum wrapper global (provavelmente MUI/Tailwind tipografia)
- `<th>` com `color: rgb(248, 250, 252)` em AMBOS os temas — `0 regras CSS combinando` no `getMatchedStylesForNode`, mas a cor era aplicada mesmo assim
- O mesmo `<th>` tinha `-webkit-text-fill-color: rgb(248, 250, 252)` em AMBOS os temas — `-webkit-text-fill-color` é uma propriedade que sobrescreve `color` em browsers WebKit/Blink, frequentemente setada por classes de tipografia (`.text-fill-*`, MUI `<Typography>`, Tailwind, etc.)

## Sintomas típicos (para diagnóstico rápido)

Se o usuário reportar que:
- "O texto fica branco/transparente em dark mas deveria ficar preto"
- "Preciso dar F5 para a cor mudar"
- "O toggle não muda essa parte"

E se ao inspecionar via DevTools você ver:
- `color` do elemento é igual em light e dark (não muda)
- `-webkit-text-fill-color` está setado (mesmo que pareça redundante com `color`)
- `getMatchedStylesForNode` retorna 0 regras CSS para esse elemento

Então é ESTE bug.

## A solução (o que SEMPRE fazer)

**Adicionar regra no `App.css` dentro do bloco `[data-theme="dark"] { ... }`** com `!important` em ambos `color` e `-webkit-text-fill-color`, usando CSS variable reativa.

```css
[data-theme="dark"] {
  /* Regra para tabelas (cabeçalho + corpo) */
  thead th,
  th,
  td {
    color: var(--cg-color-text-primary) !important;
    -webkit-text-fill-color: var(--cg-color-text-primary) !important;
  }

  /* Regra para inputs nativos (checkbox, radio) */
  .checkbox-label input[type="checkbox"] {
    background-color: var(--cg-color-surface-elevated) !important;
    border: 1px solid var(--cg-color-border) !important;
  }

  /* ... etc, conforme novos elementos forem identificados */
}
```

### Por que essa abordagem funciona

1. **CSS variable é reativa:** `var(--cg-color-text-primary)` muda automaticamente quando o `[data-theme="dark"]` é aplicado/removido no `<html>`. O navegador resolve em tempo de execução.

2. **`!important` quebra o lock:** algum wrapper acima está aplicando `color` (e/ou `-webkit-text-fill-color`) sem `!important` no cascade do `App.css`. Usando `!important` aqui, a regra do `App.css` vence, sobrescrevendo o wrapper.

3. **Sem reload:** nada disso depende de React re-renderizar. O navegador aplica a mudança na hora que `data-theme` muda.

### Por que NÃO fazer

- ❌ **NÃO** mexer no JSX trocando inline `style` por classe — isso não resolve, porque a cor presa vem de wrapper global acima, não do JSX
- ❌ **NÃO** tentar mudar o wrapper que aplica a cor (geralmente é uma lib de tipografia MUI/Tailwind que mexe em mil lugares)
- ❌ **NÃO** tentar "consertar a causa raiz" removendo o `-webkit-text-fill-color` global — pode quebrar outros lugares
- ❌ **NÃO** usar `useEffect`/`useState` para forçar re-render — é gambiarra, vai falhar em casos onde o estado do tema não está acoplado ao componente

## Como diagnosticar se o próximo agente encontrar este padrão

1. **Confirmar que o sintoma é o mesmo:** toggle de tema não muda a cor daquele elemento específico, sem reload

2. **Inspecionar via DevTools:**
   - Selecionar o elemento bugado
   - Aba `Computed` → ver `color` e `-webkit-text-fill-color`
   - Trocar tema sem reload
   - Ver se `color` muda (deveria mudar se for token reativo)
   - Se não muda → é este bug

3. **Investigar a fonte do "lock":**
   - Aba `Elements` → ir subindo na hierarquia (parent → parent)
   - Em cada nível, ver no painel `Computed` se `color` está setado
   - O nível que seta `color` é onde está o lock (algum wrapper de tipografia, MUI Typography, etc)
   - **NÃO tente mudar essa fonte.** Apenas aplique a regra no `App.css` com `!important` para sobrescrever

4. **Verificar a CSS variable:**
   - No console: `getComputedStyle(document.documentElement).getPropertyValue('--cg-color-text-primary')`
   - Deve mudar quando trocar o tema
   - Se não muda → problema mais profundo (token não está chegando no `:root`), mas isso é raro

5. **Validar SEM RELOAD:** toggle de tema, ver se a cor muda. Se sim, fix funcionou. Se não, investigar mais.

## Onde aplicar (resumo das regras atuais em `App.css`)

```css
[data-theme="dark"] {
  /* Body (ADR-011) */
  /* GlobalStyles ou muiTheme (via string template) */

  /* Tabelas - cabeçalho E corpo (ADR-012) */
  thead th, th, td {
    color: var(--cg-color-text-primary) !important;
    -webkit-text-fill-color: var(--cg-color-text-primary) !important;
  }

  /* Inputs nativos - checkbox, radio, etc (ADR-012) */
  .checkbox-label input[type="checkbox"] {
    background-color: var(--cg-color-surface-elevated) !important;
    border: 1px solid var(--cg-color-border) !important;
  }

  /* Containers com `background: white` hardcoded em JSX inline (ADR-012) */
  /* Exemplo: o <thead style={{background: '#f1f5f9'}}> do RevisaoMetadadosImportacao.js
     → usar var(--cg-color-thead-bg) em tokens.css com override em [data-theme="dark"] */

  /* Status cards (bug específico do ImportacaoMassa) */
  .status-card {
    background: var(--cg-color-surface-elevated) !important;
  }
  .status-badge.ja_importada {
    background-color: var(--cg-color-surface-elevated) !important;
    color: var(--cg-color-text-muted) !important;
  }

  /* E muitos outros casos já documentados nas sessões anteriores */
}
```

## Anti-padrão (o que NÃO fazer)

```jsx
// ❌ ERRADO - só "funciona" no primeiro carregamento
<thead style={{ background: '#f1f5f9' }}>

// ❌ ERRADO - gambiarra que vai falhar
const [forceUpdate, setForceUpdate] = useState(0);
useEffect(() => {
  const interval = setInterval(() => setForceUpdate(n => n + 1), 100);
  return () => clearInterval(interval);
}, []);
```

```jsx
// ✅ CERTO - CSS variable reativa
<thead style={{ background: 'var(--cg-color-thead-bg)' }}>

// ✅ CERTO - regra global no App.css com !important
// Para elementos com cor presa de wrapper acima
thead th, th, td {
  color: var(--cg-color-text-primary) !important;
  -webkit-text-fill-color: var(--cg-color-text-primary) !important;
}
```

## Validação rápida (checklist)

Antes de declarar o fix pronto, SEMPRE validar via browser-use ou DevTools:

1. ☑️ `getComputedStyle(element).color` muda quando toggle de tema é clicado (sem reload)?
2. ☑️ `getComputedStyle(element).backgroundColor` muda quando toggle de tema é clicado (sem reload)?
3. ☑️ Light mode continua com a cor original (não regrediu)?
4. ☑️ Outras páginas com o mesmo elemento não regrediram?
5. ☑️ Smoke test em 2-3 páginas com o mesmo tipo de elemento (tabelas, inputs, etc)?

Se algum desses falhar, o fix está incompleto. Voltar e investigar mais.

## Lição aprendida

Quando um elemento tem cor "presa" (não reage ao tema), o problema quase sempre é:

- **Background preso:** inline `style={{ background: '#XXX' }}` em JSX → substituir por `var(--cg-color-XXX-bg)` em tokens.css
- **Cor presa:** wrapper global de tipografia (MUI/Tailwind) com `color` e/ou `-webkit-text-fill-color` fixo → regra em `App.css` com `!important` e CSS variable

A solução SEMPRE envolve CSS variable. **Nunca** mexer em state React, em useEffect, ou em hacks. **Sempre** passar pelo cascade CSS.

## Relacionado

- ADR-006 (estrutura de tokens — base de tudo)
- ADR-007 (tema MUI como fonte de verdade)
- ADR-008 (glassmorphism + gradiente do body)
- ADR-009 (Tailwind `important: false`)
- ADR-010 (migração do App.css — primeiro round)
- ADR-011 (gradiente do body via split Emotion+stylis — fix anterior)
- **ADR-012 (este)** — elementos com cor presa de wrappers acima
- Sessão: `2026-06-23-modernizacao-visual-pos-execucao.md`
