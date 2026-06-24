---
type: playbook
status: active
created: 2026-06-23
tags: [playbook, tema, dark-mode, debug, css-variable, -webkit-text-fill-color, !important]
---

# Playbook: Debug de cores presas em dark mode

> **Quando usar este playbook:** o usuário reportou que "ao trocar o tema (dark/light), parte da UI não muda de cor sem dar F5", ou "algum texto/cards/tabela ficou com cor estranha que não combina com o tema".

## TL;DR (decisão em 5 segundos)

**1. O sintoma é cor presa mesmo após toggle sem reload?**
- **Sim** → provavelmente bug do tipo ADR-012. Vá direto para o passo 3.
- **Não** (cor está errada em ambos os temas, mas é sempre a mesma) → é CSS legacy. Migrar para token.

**2. O elemento tem CSS variable (`var(--cg-color-*)`) no JSX inline?**
- **Sim** → provavelmente o token não está respondendo. Verifique `tokens.css` e se a regra `[data-theme="dark"]` está atualizada.
- **Não** → substituir por CSS variable. Vá para o passo 4.

**3. Inspeção rápida (DevTools):**
- Selecione o elemento bugado
- Aba `Computed` → veja `color` e `-webkit-text-fill-color`
- Se ambos estão setados para o mesmo valor em light E dark (não muda ao trocar) → **confirmado bug do tipo ADR-012**
- Vá para o passo 5.

**4. Background preso (não é cor):**
- Procure no JSX `style={{ background: '#XXX' }}` ou `backgroundColor: '#XXX'`
- Substitua por `var(--cg-color-XXX-bg)` (criar o token em `tokens.css` se não existir)
- Adicione override em `[data-theme="dark"]` se precisar de cor diferente em dark

**5. Cor presa (texto, borda, ou outros):**
- NÃO tente mudar o wrapper que aplica a cor (geralmente é MUI Typography, Tailwind, etc)
- Adicione em `App.css` dentro de `[data-theme="dark"]`:
  ```css
  /* padrão para cor de texto */
  color: var(--cg-color-text-primary) !important;
  -webkit-text-fill-color: var(--cg-color-text-primary) !important;
  
  /* padrão para borda */
  border: 1px solid var(--cg-color-border) !important;
  border-color: var(--cg-color-border) !important;
  
  /* padrão para background */
  background: var(--cg-color-surface-elevated) !important;
  background-color: var(--cg-color-surface-elevated) !important;
  ```
- Use o seletor mais específico possível (ex: `.checkbox-label input[type="checkbox"]`, `thead th`, `.status-card`)

**6. Validação obrigatória (SEM RELOAD):**
- `getComputedStyle(element).color` muda quando toggle de tema é clicado?
- Light mode continua com a cor original (não regrediu)?
- Outras páginas com o mesmo elemento não regrediram?

**7. Se ainda preso:**
- O seletor está correto? (mais específico acima pode estar ganhando)
- A CSS variable existe? (`getComputedStyle(document.documentElement).getPropertyValue('--cg-color-text-primary')`)
- O `[data-theme="dark"]` está aplicado no `<html>`? (verificar aba Elements do DevTools)
- Aumentar especificidade do seletor OU adicionar mais um nível de `!important` (raro)

## Mapa de decisões

```
Elemento tem cor errada em dark/light
│
├─ Cor muda ao trocar tema SEM reload?
│  │
│  ├─ SIM (cor reage, mas está errada em algum dos temas)
│  │  └─ Cor hardcoded no JSX inline ou CSS legado
│  │     → Migrar para var(--cg-color-*)
│  │
│  └─ NÃO (cor presa, só muda com F5)
│     └─ Bug do tipo ADR-012
│        → Adicionar regra em App.css [data-theme="dark"] com !important
│
├─ É cor de texto (color / -webkit-text-fill-color)?
│  └─ Use: var(--cg-color-text-primary) ou var(--cg-color-text-muted)
│
├─ É background?
│  └─ Use: var(--cg-color-surface-elevated) ou var(--cg-color-thead-bg)
│
├─ É borda?
│  └─ Use: var(--cg-color-border)
│
└─ É cor de hover/focus/active state?
   └─ Pode precisar de &:hover, &:focus em CSS com :root[data-theme="dark"]
```

## Lista de tokens disponíveis em `tokens.css`

| Token | Uso típico | Valor light | Valor dark |
|-------|-----------|-------------|------------|
| `--cg-color-text-primary` | Texto principal | preto/cinza-escuro | off-white |
| `--cg-color-text-muted` | Texto secundário | cinza médio | cinza claro |
| `--cg-color-surface-elevated` | Fundo de cards/badges | branco | cinza-escuro |
| `--cg-color-border` | Bordas | cinza-claro | cinza-escuro |
| `--cg-color-thead-bg` | Fundo do `<thead>` | `#f1f5f9` | `rgba(15, 23, 42, 0.75)` |
| `--cg-color-accent-primary` | Cor de destaque (links, ícones) | azul | azul claro |
| `--cg-color-success` | Sucesso | verde | verde claro |
| `--cg-color-error` | Erro | vermelho | vermelho claro |
| `--cg-gradient-body` | Gradiente de fundo do body | light gradient | dark gradient |

> Se o token que você precisa não existir, adicione em `tokens.css` dentro de `:root` e `[data-theme="dark"]`.

## Checklist final antes de declarar o fix pronto

- [ ] `getComputedStyle(element).color` muda quando toggle de tema é clicado (sem reload)
- [ ] `getComputedStyle(element).backgroundColor` muda quando toggle de tema é clicado (sem reload)
- [ ] Light mode continua com a cor original (não regrediu)
- [ ] Outras páginas com o mesmo tipo de elemento não regrediram
- [ ] Smoke test em 2-3 páginas com o mesmo tipo de elemento (tabelas, inputs, etc)
- [ ] Documentar o fix novo (se for caso relevante) em uma sessão `.brain/sessions/` ou ADR

## Quando ESCALAR (parar e perguntar ao usuário)

- Não tenho certeza de qual token CSS variable usar
- O fix pode afetar mais de 3 elementos (pode ser um padrão mais amplo, vale um ADR)
- O usuário pediu "investigue o que tá acontecendo" em vez de "conserta X"
- Há múltiplos elementos bugados (pode ser mais eficiente propor um fix em batch)

## Anti-padrões para EVITAR

```jsx
// ❌ Inline style hardcoded
<thead style={{ background: '#f1f5f9' }}>
<button style={{ background: 'white' }}>

// ❌ useState + useEffect forçando re-render (gambiarra)
const [_, force] = useState(0);
useEffect(() => { ... });

// ❌ Mexer no wrapper que aplica a cor (vai quebrar outros lugares)
//   Ex: tentar mudar MUI Typography internamente

// ❌ Usar style inline com !important
<thead style={{ color: '#fff !important' }}>  // !important em inline não funciona
```

```jsx
// ✅ CSS variable reativa
<thead style={{ background: 'var(--cg-color-thead-bg)' }}>

// ✅ Regra global em App.css com !important (para casos de wrapper acima)
thead th, th, td {
  color: var(--cg-color-text-primary) !important;
  -webkit-text-fill-color: var(--cg-color-text-primary) !important;
}
```

## Referência rápida aos ADRs

- **ADR-006** — Estrutura de tokens
- **ADR-007** — Tema MUI como fonte de verdade
- **ADR-008** — Glassmorphism + gradiente
- **ADR-009** — Tailwind `important: false`
- **ADR-010** — Migração do App.css
- **ADR-011** — Bug Emotion+stylis (gradiente do body)
- **ADR-012** — Cor presa de wrapper global (este playbook)
- Sessão: `2026-06-23-modernizacao-visual-pos-execucao.md`
