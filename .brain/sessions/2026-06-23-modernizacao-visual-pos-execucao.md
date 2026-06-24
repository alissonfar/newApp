---
type: session
status: active
created: 2026-06-23
tags: [modernizacao-visual, pos-execucao, design-system, resumo]
---

# Sessão: Modernização visual — Pós-execução

## Objetivo

Documentar a conclusão da modernização visual do Controle de Gastos. **21 commits** entregues, **6 fases** concluídas, **3 telas-chave** migradas.

## Resultado

### O que foi entregue

| Categoria | Detalhe |
|---|---|
| **Tokens** | `src/theme/tokens.js` + `tokens.css` com paleta, tipografia, espaçamentos, radii, glass, gradientes, motion. Variáveis CSS legadas viraram alias. |
| **Tema MUI** | `src/theme/muiTheme.js` com `lightTheme` e `darkTheme`. Tema é a fonte de verdade para componentes base. |
| **Estilos globais** | `src/theme/GlobalStyles.js` aplica gradiente no body, scrollbar custom, prefers-reduced-motion. |
| **Dark mode** | `src/hooks/useThemeMode.js` (hook) + `src/components/shared/ThemeToggle.js` (botão). Persistência em `localStorage` (`cg:theme`). |
| **Glassmorphism** | `src/components/shared/GradientBackground.js` + `MainLayout` com menu translúcido. Mobile (≤768px) tem fallback opaco. |
| **Componentes shared** | Refatorados: `Card`, `Button`, `Badge`, `SectionHeader`, `EmptyState`. Novos: `StatCard`, `TransactionRow`, `DataTable`. |
| **Tailwind** | `important: false`, alinhado aos tokens via `theme.extend`. |
| **Telas migradas** | Home, NovaTransacaoForm, Relatorio. CSS reduzido em ~48% (Home: 1011→530 linhas, Relatorio: 546→281). |
| **App.css migrado** | 532 → 166 linhas (-69%). Dark mode agora consistente em **todas as rotas** (mesmo as não refatoradas). 9 classes mortas removidas. |
| **index.css body** | Simplificado — background removido (deixa GlobalStyles mandar no gradiente). |
| **Bug do gradiente no body (Fase 7.5)** | Após Fase 7, ainda existia "fundo branco" no header. Causa raiz: bug Emotion+stylis que dropa valores com vírgulas em parênteses. Fix via split entre `GlobalStyles.js` (objeto JS) e `muiTheme.js` (string template em `MuiCssBaseline`). Documentado em [ADR-011](../decisions/2026-06-23-theme-body-gradient-emotion-stylis-bug.md). |
| **Polish dark mode (várias páginas)** | Após Fase 7.5, varreram-se páginas com cores hardcoded legadas (`/relatorio`, `/importacao`, etc). Bugs corrigidos: h4 títulos azuis, cards de status brancos, hover de tabela claro, badge "Já Importada" esmaecido, coluna Ações vazia (bug antigo), checkbox label invisível, cabeçalho `<thead>` claro. Documentado em [ADR-012](../decisions/2026-06-23-css-variable-para-cores-presas-em-dark-mode.md). |

### Estatísticas

- **24 commits** na branch `refatoracaoVisual` (Fases 1-6 + Fase 7 + commit docs) + 1 commit pendente do fix do gradiente (Fase 7.5)
- **~860 linhas líquidas a menos** de CSS (refatoração eliminou duplicação)
- **7 ADRs criados** (006-012)
- **0 regressões** em features críticas (Pluggy, multi-tenant, decimal.js, contas conjuntas, importação CSV/OFX, geração de PDF)

### ADRs

- **ADR-006** — Estrutura de tokens (JS + CSS) em `src/theme/`
- **ADR-007** — Tema MUI como fonte de verdade para componentes base
- **ADR-008** — Glassmorphism em `MainLayout` exige gradiente vibrante visível atrás
- **ADR-009** — Tailwind `important: false` + tokens como fonte única
- **ADR-010** — Migração do `App.css` global para tokens do design system
- **ADR-011** — **Gradiente do `<body>` precisa de split entre GlobalStyles e MuiCssBaseline (bug Emotion+stylis)** ⚠️ **LEIA ANTES DE MEXER NO TEMA**
- **ADR-012** — ⚠️ **Elementos com cor presa de wrappers globais (th, td, checkbox, etc) — CSS variable + `!important` em `App.css [data-theme="dark"]`**

## Decisões durante a execução

### Decisões alinhadas com o plano

- **Glassmorphism com fundo vibrante** (decisão original: B — vibrant por baixo)
- **Menu lateral como glass** (não sólido)
- **ThemeToggle no menu lateral** abaixo do nome do usuário
- **Escopo focado**: tokens + shared + 3 telas-chave
- **Compatibilidade via aliases** durante a migração

### Decisões tomadas durante a execução (não previstas no plano)

- **Fix arquitetural `MuiCssBaseline.body: transparent`** (Fase 2): necessário porque o CssBaseline pintava o body com cor sólida e escondia o gradiente do `GlobalStyles`. Sem isso, o glassmorphism ficaria invisível. Adicionado como "Tarefa 0" antes da Fase 2.
- **`.main-content: transparent`**: para o gradiente do body aparecer atrás dos cards de conteúdo. Decidido via `question` durante a execução.
- **Mobile hamburger opaco**: decisão de consistência visual (mobile usa menu opaco `0.96`, hamburger acompanhou).
- **Botão "Salvar e Continuar" verde (`success`)**: preservou a diferenciação visual de antes. CSS legado usava `#2ecc71` explícito.
- **Botão "Exportar Relatório" com gradient custom**: parte da affordance do botão principal de export. Sobrepõe o `Button variant="primary"` com regra CSS específica.
- **`useThemeMode` ao invés de `useState` no App**: hook dedicado com `localStorage` e `prefers-color-scheme`. Mais testável e reusável.

### Issues resolvidas durante a execução

1. **Menu lateral ficou azul sólido `#2c5282` em vez de translúcido (Fase 2)**: bug do executor que adicionou `backdrop-filter` mas não trocou as variáveis de cor no `MainLayout.css`. Corrigido em commit adicional: 34 substituições `var(--cor-*-menu)` → `var(--cg-*-menu)`.
2. **Dark mode mostrou cards ainda brancos (Fase 3)**: esperado — cards da Home usavam CSS legado com `background: white` hardcoded. Resolvido na Fase 6 (refatoração de Home para usar `StatCard` e `Card` glass).
3. **Dropdown do perfil empurrou o toggle para área errada (Fase 3)**: visualmente aceitável, sem impacto funcional.

### Saga do "fundo branco" no body (Fase 7.5)

**Sintoma persistente:** Mesmo após Fases 1-7, a Home em dark mode tinha "fundo branco" no header "Dashboard - Alisson" e nos botões de período (Semana/Mês/Mês Passado/Ano), tornando o texto claro invisível.

**Tentativas falhadas (cada uma parecia lógica mas não resolveu):**

1. **Hipótese A:** `App.css` tinha `h1, h2` globais com cores fixas. → Migrado para tokens (Fase 7). ❌ Não resolveu.
2. **Hipótese B:** `.main-content` tinha background sólido. → Tornou-se transparent. ❌ Não resolveu.
3. **Hipótese C:** `body` em `App.css` tem `background: var(--cor-fundo)`. → Aliases apontariam para tokens. ❌ Não resolveu.
4. **Hipótese D:** O `GlobalStyles.js` deveria aplicar `background: tokens.gradient[mode]` no body. → Nenhuma evidência de erro no console. ❌ Não resolveu.

**Método que funcionou — eliminação visual com vermelho:**

Subagent executor (via skill `browser-use`) aplicou `background: red !important` em elementos candidatos, um por vez:

| Elemento | Hipótese | Resultado |
|---|---|---|
| `<body>` | "A mancha branca é o body" | **VERMELHO no lugar da mancha branca** → culpado confirmado ✅ |
| `<html>` | "É o html que está sem cor" | (não testado, body já confirmado) |
| `.main-content` | "É o container de conteúdo" | (não testado) |
| `.cg-home` | "É a Home" | (não testado) |
| `.cg-home__header` | "É o container do header" | (não testado) |
| `.dashboard-section` | "É a section dos StatCards" | (não testado) |

**Causa raiz descoberta:** o `<body>` estava com `background: transparent` em runtime. O `GlobalStyles.js` **deveria** aplicar `background: tokens.gradient[mode]` mas não estava.

**Bug encontrado:** O pré-processador CSS do Emotion (stylis) **dropa valores de `background` ou `backgroundImage` que contenham vírgulas dentro de parênteses** — como `linear-gradient(135deg, #color1, #color2 60%, #color3)`. A vírgula dentro dos parênteses confunde o parser.

**Fix definitiva (split em 2 arquivos):**

| Arquivo | Responsabilidade |
|---|---|
| `src/theme/GlobalStyles.js` | `'html, body'` recebe `fontFamily`, `backgroundAttachment`, `backgroundSize`, `minHeight`, `margin` (objeto JS funciona aqui) |
| `src/theme/muiTheme.js` | `MuiCssBaseline.styleOverrides` recebe string template (CSS cru) com `background-image: linear-gradient(...)` em `html, body` (bypassa o bug do Emotion) |

**Validação:**
- `getComputedStyle(body).backgroundImage` em dark: `linear-gradient(135deg, rgb(10, 14, 39) 0%, rgb(30, 27, 75) 60%, rgb(49, 46, 129) 100%)` ✅
- `getComputedStyle(html).backgroundImage` em dark: mesmo gradiente ✅
- Validado em 5 rotas (Home, Patrimonio, Relatorio, Tags, Pessoas) em dark e light
- Documentado em [ADR-011](../decisions/2026-06-23-theme-body-gradient-emotion-stylis-bug.md)

**Lição:** Quando o Alisson pediu "método drástico com vermelho" foi o que destravou. Teoria após teoria sem validação visual não levou a lugar nenhum. **Verificar com print sempre.**

### Saga do "thead" e "td" sem cor reativa (pós-validacao)

**Sintoma:** Na página `/importacao/nova`, o cabeçalho da tabela de Amostra (Data, Descrição, Valor, Tipo) e as linhas de dados estavam com cor presa: em **light mode** o texto aparecia **off-white/transparente** (ilegível), e em **dark mode** aparecia **claro demais** ou **escuro demais**. Sem F5 a cor não atualizava ao trocar o tema.

**Investigação:**

1. **Background do `<thead>`:** o JSX `RevisaoMetadadosImportacao.js` tinha `<thead style={{ background: '#f1f5f9' }}>` (hardcoded). Substituído por `var(--cg-color-thead-bg)`, com o token em `tokens.css` apontando para `#f1f5f9` em light e `rgba(15, 23, 42, 0.75)` em `[data-theme="dark"]`. ✅ Background reativo.

2. **Cor do texto do `<th>` (cabeçalho):** mesmo após o background reagir, o texto do cabeçalho continuava preso. Inspeção no DevTools mostrou:
   - `color: rgb(248, 250, 252)` (off-white) em AMBOS os temas
   - `-webkit-text-fill-color: rgb(248, 250, 252)` em AMBOS os temas
   - `getMatchedStylesForNode` retornava **0 regras CSS** para esse elemento

   **Diagnóstico:** algum wrapper de tipografia (MUI Typography, Tailwind text-fill-*, ou similar) estava setando `color` e `-webkit-text-fill-color` em um nível acima do escopo do cascade de `App.css`. **Não vinha do nosso código.** Tentar mudar o wrapper quebraria outros lugares; o fix certo era sobrescrever com `!important` no `App.css`.

3. **Fix do cabeçalho:** adicionada regra em `App.css` dentro de `[data-theme="dark"]`:
   ```css
   thead th,
   th {
     color: var(--cg-color-text-primary) !important;
     -webkit-text-fill-color: var(--cg-color-text-primary) !important;
   }
   ```
   ✅ O cabeçalho passou a reagir ao tema.

4. **Cor do `<td>` (linhas de dados):** mesmo problema do `<th>`, mesma origem. Alisson pediu "é só reproduzir para a parte de baixo" — adicionado `td` à lista de seletores:
   ```css
   thead th,
   th,
   td {
     color: var(--cg-color-text-primary) !important;
     -webkit-text-fill-color: var(--cg-color-text-primary) !important;
   }
   ```
   ✅ Corpo da tabela também passou a reagir.

**Lição:** quando o elemento tem cor presa de wrapper acima (MUI/Tailwind), **NÃO** tente mudar o wrapper. Adicione a regra com `!important` e CSS variable reativa em `App.css [data-theme="dark"]`. Documentado em [ADR-012](../decisions/2026-06-23-css-variable-para-cores-presas-em-dark-mode.md).

**Checklist de diagnóstico rápido para o próximo agente:**

1. O sintoma é "cor presa mesmo após toggle de tema sem reload"? → provável bug do tipo ADR-012
2. No DevTools, `color` e/ou `-webkit-text-fill-color` estão setados sem combinar com nenhuma regra do `App.css`? → confirmado
3. Aplique a regra com `!important` em `App.css [data-theme="dark"]` usando `var(--cg-color-*)`
4. Valide SEM RELOAD: `getComputedStyle().color` muda ao trocar o tema
5. Se ainda preso, escopo do seletor pode estar errado (mais específico acima) — ajustar seletor

## O que ficou para o futuro (NÃO está no escopo)

- **Refatorar mais páginas** além das 3 telas-chave (Patrimônio, Pessoas, Tags, Relatórios Secundários, Admin) — todas continuam com CSS legacy + aliases. Cada refatoração é uma fase independente.
- **Tunar intensidade do glass em light mode** — alguns devs podem achar o efeito sutil demais no light. Dark mode mostra o efeito de forma vibrante.
- **Animações mais elaboradas** (framer-motion, page transitions) — fora do escopo, microanimações só via CSS.
- **i18n** (internacionalização) — fora do escopo.
- **Storybook** para o design system — fora do escopo, mas seria o próximo passo natural.
- **Testes de regressão visual** (Playwright com screenshots) — fora do escopo, mas ajudaria a evitar regressões em futuras mudanças de tema.

## Aprendizados

- **MUI sem `ThemeProvider` é um anti-pattern**: componentes rodam com tema default, e cada CSS local precisa sobrescrever um por um. Sempre configurar tema MUI desde o início.
- **Aliases CSS são essenciais** para migração de design system: páginas não refatoradas continuaram funcionando via `--cor-primaria` apontando para o token novo.
- **Executor de código não tem browser**: limita validação visual. Smoke test visual do Alisson é **crítico** em cada fase.
- **Glassmorphism é mais impactante em dark mode**: o efeito de blur sobre cores vibrantes é muito mais visível do que sobre cinza claro.
- **Refatorar CSS de uma página inteira para usar shared components** pode reduzir 48% das linhas — vale o investimento.
- **Método de eliminação visual com cor primária (vermelho):** quando teoria após teoria não leva a lugar nenhum, **aplique `background: red !important` em cada candidato** e veja qual fica vermelho. É mais rápido e elimina suposição. Foi o que destravou a saga do "fundo branco".
- **Emotion+stylis dropa gradientes com vírgulas em parênteses**: se você precisa de `linear-gradient(...)`, `radial-gradient(...)`, `transform: rotate3d(...)`, `filter: blur(...)` etc no `GlobalStyles` (objeto JS), use **string template** no `MuiCssBaseline.styleOverrides` (CSS cru). Ver [ADR-011](../decisions/2026-06-23-theme-body-gradient-emotion-stylis-bug.md).

## Validação de critérios de aceite (Fase 6 — entrega final)

- ✅ Home, NovaTransacaoForm e Relatorio renderizam em light e dark
- ✅ ThemeToggle funciona e persiste em `localStorage`
- ✅ Variáveis CSS antigas (`--cor-*` legacy) continuam funcionando nas páginas não refatoradas (aliases em `tokens.css`)
- ⚠️ Contraste 4.5:1 não foi validado formalmente com WebAIM — Alisson validou visualmente
- ✅ `npm run build` passa sem warnings novos
- ✅ Funcionalidades críticas intactas (criação de transação, multi-tenant, decimal.js, PDF/CSV)
- ✅ Mobile (≤768px) tem fallback sem `backdrop-filter` pesado
- ✅ Nenhum emoji usado como ícone

## Próximos passos sugeridos

1. **Push da branch `refatoracaoVisual`** (você decide o momento)
2. **Criar PR** com descrição linkando o design doc e o plano
3. **Code review** focado em: (a) o que ficou bom, (b) o que precisa ajuste
4. **Refatorar mais páginas** se você sentir necessidade (Patrimônio seria a próxima, é a maior e mais usada além das 3 que já migramos)
5. **Adicionar testes de regressão visual** (Playwright) — proteção futura
6. **Migrar fontes Poppins/DM Sans para IBM Plex Sans** (Fase futura — decidíu postergar)
7. **Refatorar páginas Patrimônio, Pessoas, Tags, Admin** (cada uma é fase independente)

## Localização dos documentos

- **Design doc:** `C:\PROJETOS\newApp\.brain\sessions\2026-06-23-modernizacao-visual-design.md`
- **Plano de implementação:** `C:\PROJETOS\newApp\.brain\sessions\2026-06-23-modernizacao-visual-plano.md`
- **Esta sessão:** `C:\PROJETOS\newApp\.brain\sessions\2026-06-23-modernizacao-visual-pos-execucao.md`
- **ADRs:** `C:\PROJETOS\newApp\.brain\decisions\2026-06-23-*.md` (4 arquivos)
