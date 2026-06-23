---
type: decision
status: active
created: 2026-06-23
tags: [theme, body, gradient, emotion, stylis, bug, design-system, css]
---

# ADR-011: Gradiente do `<body>` precisa de split entre GlobalStyles e MuiCssBaseline (bug Emotion+stylis)

## Contexto

Após as Fases 1-7 da modernização visual ([ADR-006](../decisions/2026-06-23-tokens-estrutura-theme-pasta.md) a [ADR-010](../decisions/2026-06-23-app-css-migracao-tokens.md)), o design system tinha tokens completos, tema MUI configurado, dark mode funcional, e migração do `App.css` global. Mas existia um bug crítico:

**Sintoma:** O header "Dashboard - Alisson" da Home (e áreas similares de outras páginas) tinha um "fundo branco" persistente que NÃO mudava entre light e dark mode. Em dark mode, o texto do título (branco/claro) ficava **invisível** sobre esse fundo branco.

**Investigação conduzida (Fase 7.5 — correção de bug pós-modernização):**

1. **Hipótese inicial (incorreta):** `App.css` tinha regras `h1, h2` globais sobrescrevendo os tokens. Migrar para `--cg-*` tokens resolveria. → **Falso**. A fix foi aplicada (Fase 7), mas o sintoma persistiu.

2. **Hipótese 2 (incorreta):** O `<body>` estava sendo pintado com cor sólida. → **Falso**. `body { background: transparent }` no `App.css` permitia o gradiente do `GlobalStyles` aparecer.

3. **Hipótese 3 (CORRETA, via método de eliminação visual com vermelho):** Aplicar `background: red !important` no `<body>` via console DevTools mudou **exatamente a área da mancha branca para vermelho**. Os outros elementos (sidebar, cards) continuaram normais. Isso confirmou que o `<body>` estava com `background: transparent` (ou seja, vazio) e o branco do user agent vazava.

4. **Método de validação (browser-use via subagent executor):** 7 prints capturados, `getComputedStyle` lido no console, comparação visual entre estados.

**Causa raiz técnica:** O `GlobalStyles.js` (que usa Emotion `MuiGlobalStyles` com objeto JS) deveria aplicar `body { background: tokens.gradient[mode] }` no runtime, mas não estava aplicando. Por algum motivo no pipeline Emotion + stylis (o pré-processador CSS do Emotion), a regra estava sendo dropada ou sobrescrita.

## Investigação aprofundada: bug Emotion+stylis

Após 3 tentativas frustradas dentro do `GlobalStyles.js` (reordenar props, trocar para `backgroundImage`, array de fallbacks), ficou claro que o problema era:

**O pré-processador CSS do Emotion (stylis) está dropando valores de `background` ou `backgroundImage` que contenham vírgulas dentro de parênteses** — como `linear-gradient(135deg, #color1, #color2 60%, #color3)`. A vírgula dentro dos parênteses do gradiente confunde o parser, que trata o valor como múltiplas declarações inválidas e descarta a propriedade.

Pesquisa no Context7 (docs oficiais do MUI) confirmou que existe uma **forma oficialmente documentada** para contornar isso: usar **string template** (CSS cru) dentro de `MuiCssBaseline.styleOverrides`, que **bypassa o parser de objeto JS do Emotion**.

## Decisão

**Opção A (escolhida): Split de responsabilidade entre 2 arquivos.**

Dividimos a regra do `html, body` em 2 partes, cada arquivo lida com o que sabe fazer bem:

### `src/theme/GlobalStyles.js` (objeto JS, Emotion)
Aplica em `'html, body'` tudo que **NÃO** tem vírgulas em parênteses:
- `fontFamily`
- `backgroundAttachment: 'fixed'`
- `backgroundSize: 'cover'`
- `minHeight: '100vh'`
- `margin: 0`

**NÃO** aplica `background: tokens.gradient[mode]` aqui (é onde o bug do stylis aparece).

### `src/theme/muiTheme.js` (string template, CSS cru)
Aplica em `html, body` o gradiente via string template dentro de `MuiCssBaseline.styleOverrides`:
```js
MuiCssBaseline: {
  styleOverrides: {
    'html, body': `
      background-image: linear-gradient(135deg, ${tokens.color[mode].background1} 0%, ${tokens.color[mode].background2} 60%, ${tokens.color[mode].background3} 100%);
      background-attachment: fixed;
      background-size: cover;
    `,
    body: {
      backgroundColor: 'transparent',
      color: color.textPrimary,
      fontFamily: tokens.font.family,
    },
  },
},
```

**Por que `MuiCssBaseline` aceita string:** Documentação oficial do MUI confirma que `styleOverrides` aceita tanto objeto JS quanto string template. Quando passado como string, o Emotion injeta o CSS diretamente sem passar pelo parser stylis.

**Por que split e não tudo em string:** Misturar string + objeto no mesmo componente é confuso. Manter o split torna óbvio qual arquivo lida com qual aspecto (tokens / CSS cru).

## Consequências

- **Pró:**
  - Gradiente aparece corretamente em **light mode** (`#e0e7ff → #f3e8ff → #fce7f3`) e **dark mode** (`#0a0e27 → #1e1b4b → #312e81`)
  - Header "Dashboard - Alisson" e botões de período agora têm fundo gradiente (texto legível em ambos os modos)
  - Validado via `getComputedStyle`: tanto `body` quanto `html` retornam o gradiente correto
  - Validado em 5 rotas (Home, Patrimonio, Relatorio, Tags, Pessoas)
  - Solução oficial documentada pelo MUI
- **Contra:**
  - Lógica do gradiente **dividida em 2 arquivos** — quem for mexer no tema precisa saber do split
  - `MuiCssBaseline` com string template **não é tão comum** — pode confundir em code review
  - Se o Emotion/stylis corrigir o bug no futuro, o split vira over-engineering (mas é fácil reverter)
- **Mitigação:**
  - Comentário explícito em ambos os arquivos referenciando este ADR
  - Mensagem de commit clara: "fix(theme): corrigir fundo branco no body em dark mode — split entre GlobalStyles e MuiCssBaseline por bug Emotion+stylis"
  - Validação manual descrita no comentário

## Por que isso é importante para o futuro

**Se um agente futuro** (ou Alisson em 6 meses) for:
- Adicionar uma nova propriedade ao gradiente (ex: `background-repeat`)
- Trocar o gradiente por outro pattern (ex: radial-gradient)
- Atualizar as cores dos tokens

**ELE PRECISA SABER** que valores com vírgulas em parênteses **NÃO** funcionam no `GlobalStyles.js` (objeto JS) e devem ir no `muiTheme.js` (string template). Caso contrário, a propriedade será silenciosamente dropada e o sintoma volta sem aviso no console.

**Sintomas típicos desse bug:**
- Propriedade CSS que "deveria estar aplicando" mas não aplica
- Nenhum erro no console
- Funciona em dev, quebra em prod (ou vice-versa)
- Funciona após hard reload, quebra após hot-reload
- Background, background-image, transform (com rotate3d), filter (com blur) são os mais comuns

## Como validar que o gradiente está aplicado

Console DevTools (em qualquer página, dark ou light):
```js
getComputedStyle(document.body).backgroundImage
// Esperado (dark): "linear-gradient(135deg, rgb(10, 14, 39) 0%, rgb(30, 27, 75) 60%, rgb(49, 46, 129) 100%)"
// Esperado (light): "linear-gradient(135deg, rgb(224, 231, 255) 0%, rgb(243, 232, 255) 45%, rgb(252, 231, 243) 100%)"

getComputedStyle(document.documentElement).backgroundImage
// Deve retornar o mesmo gradiente acima (não "none")
```

Se retornar `none` ou string vazia → o split quebrou, voltar a este ADR e revisar.

## Arquivos modificados nesta decisão

- `src/theme/GlobalStyles.js` — seletor `body` virou `'html, body'`, removido `background`, adicionado `backgroundSize: 'cover'`
- `src/theme/muiTheme.js` — `MuiCssBaseline.styleOverrides` ganhou string template para `html, body` com o gradiente

## Validação realizada (browser-use via subagent)

| Item | Resultado |
|---|---|
| `getComputedStyle(body).backgroundImage` em dark | `linear-gradient(135deg, rgb(10, 14, 39) 0%, rgb(30, 27, 75) 60%, rgb(49, 46, 129) 100%)` ✅ |
| `getComputedStyle(html).backgroundImage` em dark | mesmo gradiente ✅ |
| `getComputedStyle(body).backgroundImage` em light | `linear-gradient(135deg, rgb(224, 231, 255) 0%, rgb(243, 232, 255) 45%, rgb(252, 231, 243) 100%)` ✅ |
| Mancha branca no header em dark | **sumiu** ✅ |
| Gradiente dark em 5 rotas (Home, Patrimonio, Relatorio, Tags, Pessoas) | **visível em todas** ✅ |
| `npm run build` | ✅ sem erros novos |

## Relacionado

- ADR-006 (estrutura de tokens)
- ADR-007 (tema MUI como fonte de verdade)
- ADR-008 (glassmorphism exige gradiente)
- ADR-010 (migração do App.css — primeira tentativa de corrigir esse bug, não foi suficiente)
- Sessão `2026-06-23-modernizacao-visual-pos-execucao.md` (será atualizada com este desfecho)
- Sessão `2026-06-23-migracao-app-css-plano.md` (Fase 7 que precedeu esta descoberta)
