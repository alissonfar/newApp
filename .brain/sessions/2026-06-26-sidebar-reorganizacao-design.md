---
type: session
status: active
created: 2026-06-26
tags: [sidebar, design, modernizacao, visual, refactor, layout]
---

# Design: Reorganização e modernização da Sidebar

> **Sessão de planejamento.** Define o que muda na `MainLayout` (estrutura de menu + visual + CSS).
> Não é implementação — após aprovação, o plano é delegado ao `newapp-executor`.

## TL;DR

Reorganizar a sidebar em **4 seções com cabeçalhos visíveis** (Home em destaque no topo, depois Relatórios & Insights, Registrar & Consultar, Patrimônio & Compartilhado, Configurações), reduzir o CSS de **957 → ~250 linhas**, introduzir um **modo rail (72px)** colapsável, **trocar a biblioteca de ícones de Font Awesome pra Material Icons (MUI)**, e aplicar tipografia e micro-interações de app moderno. Nenhuma feature é removida.

## Contexto lido do vault

- **Stack:** React 19 + CRACO + Tailwind 4 (important:false) + MUI 6 + Emotion. Tema em `src/theme/tokens.css` (variáveis `--cg-*`) + `muiTheme.js` + `GlobalStyles.js`. Glassmorphism sobre gradiente vibrante.
- **ADRs críticos a respeitar:** ADR-006 (estrutura de tokens), ADR-007 (MUI como fonte de verdade), ADR-008 (glassmorphism exige gradiente vibrante), ADR-009 (Tailwind `important:false`), ADR-011 (split `GlobalStyles` + `MuiCssBaseline` por bug Emotion+stylis), ADR-012 (cores presas em wrappers globais — `var(--cg-color-*)` + `!important` em `App.css [data-theme="dark"]`).
- **Decisão do user nesta sessão:**
  - Objetivo: **reduzir poluição visual + modernizar** (sem cortar features)
  - Uso real: 15/17 destinos ativos; só "Modelos de Relatório" e "Insights" são ocasionais
  - Reagrupamento aprovado: **C — Home à parte + 3 agrupamentos funcionais** (+ Configurações no rodapé)
  - Estilo visual aprovado: **C — Híbrido: larga por padrão + opção de colapsar para rail (72px)**
  - **Biblioteca de ícones aprovada: Material Icons (MUI)** — `@mui/icons-material` já está instalado; troca de import sem dependência nova. Geometria profissional, padrão em produtos como Linear/Notion/Vercel.

## Diagnóstico da sidebar atual

**Arquivo:** `controle-gastos-frontend/src/components/Layout/MainLayout.js` (382 linhas) + `MainLayout.css` (957 linhas).

**Estrutura atual** (de `MainLayout.js:74-121`):
- 5 itens soltos no nível raiz: Home, Relatórios, Modelos de Relatório, Insights, Tags
- 3 grupos com submenu: Transações (3), Empréstimos (2), Patrimônio (8 ⚠️)
- 1 item solto: Contas Conjuntas
- 1 item condicional: Admin (se `usuario.role === 'admin'`)

**Problemas concretos observados:**

1. **Poluição visual do 1º glance:** 5 itens raiz sem agrupamento + 4 grupos com submenu + 1 item solto = 10 "blocos" pra processar visualmente.
2. **Patrimônio com 8 subitens:** maior poluidor. Quando expandido, ocupa >50% da altura.
3. **Itens semanticamente próximos ficam longe:** "Tags" (raiz) e "Importação em Massa" (dentro de Transações) são do mesmo domínio (cadastros auxiliares), mas estão separados.
4. **CSS inchado:** `MainLayout.css` tem 957 linhas. Regras duplicadas (`.main-content` definida 2x, uma comentada), `!important` espalhado, `@media` redundantes (1024px e 992px definem basicamente a mesma coisa), comentários `/* REMOVIDO */` e `/* ... (Resto do arquivo CSS original, se houver) ...` indicando que o arquivo é um Frankenstein de iterações.
5. **Falta "respiração" entre seções:** sem headers, sem divisores, tudo tem o mesmo peso visual.
6. **Modo colapsado é pobre:** mostra só ícones centrados (72px), sem tooltip explicando o que é cada um.
7. **Mobile drawer funcional mas com regras `!important` forçadas:** `.main-content { margin-left: 0 !important; width: 100% !important; padding-top: 60px !important }` é frágil.
8. **Tipografia sem hierarquia:** tudo em 0.9375rem / 0.875rem / 0.95rem, sem distinção semântica entre "label de seção" e "item de menu".

## A proposta

### 1. Estrutura de informação nova (5 blocos)

```
┌─────────────────────────────────────┐
│ [LOGO]  Controle de Gastos    [⟲]   │  ← Header (sempre visível)
├─────────────────────────────────────┤
│                                     │
│  ◉ Home                             │  ← BLOCO 1: Home (destaque, sem header)
│                                     │
│  ─── RELATÓRIOS & INSIGHTS ───      │  ← Header de seção
│  📊 Relatórios                      │
│  💡 Insights                        │
│  📄 Modelos de Relatório            │
│                                     │
│  ─── REGISTRAR & CONSULTAR ───      │
│  ✍️ Transações                  ▾   │  ← Submenu (Importação, Recebimentos, Histórico)
│  🏷️ Tags                            │
│                                     │
│  ─── PATRIMÔNIO & COMPARTILHADO ──  │
│  💰 Patrimônio                  ▾   │  ← Submenu (8 itens, inclui Open Finance)
│  🤝 Empréstimos                 ▾   │  ← Submenu (Lista + Pessoas)
│  👥 Contas Conjuntas                │
│                                     │
├─────────────────────────────────────┤
│  ─── CONFIGURAÇÕES ───              │  ← Header de seção (rodapé, sutil)
│  👤 Meu Perfil                      │
│  ❓ Como Utilizar                   │
│  🌗 [toggle dark mode]              │
│  ─────────                          │
│  🚪 Sair                            │
│  [Avatar] Alisson [▾]               │  ← User card (mantém comportamento atual)
└─────────────────────────────────────┘
```

**Total: 15 destinos** (mesma quantidade atual, mas agrupados semanticamente).

**Nota sobre "Configurações":** Os 3 itens (Meu Perfil, Como Utilizar, ThemeToggle) saem do dropdown de perfil e ganham espaço próprio no rodapé. O dropdown atual some. Isso resolve o problema "estou logado, como troco o tema sem expandir o avatar?".

**Admin:** continua condicional (`usuario.role === 'admin'`), vai pro final do bloco "Configurações" como um item extra.

### 2. Visual — Tokens novos a criar

| Token | Valor light | Valor dark | Uso |
|---|---|---|---|
| `--cg-menu-section-label` | `rgba(255,255,255,0.5)` | herdar | Cor dos headers de seção |
| `--cg-menu-section-label-size` | `0.6875rem` | — | Tamanho micro (11px) |
| `--cg-menu-section-label-weight` | `600` | — | Semi-bold |
| `--cg-menu-section-label-spacing` | `0.08em` | — | Letter-spacing |
| `--cg-menu-section-divider` | `rgba(255,255,255,0.08)` | herdar | Linha horizontal sob header |
| `--cg-menu-item-size` | `0.9375rem` | — | Tamanho padrão do label |
| `--cg-menu-item-size-rail` | `0.75rem` | — | Tamanho quando rail+tooltip |
| `--cg-menu-section-gap` | `24px` | — | Espaço entre seções |
| `--cg-menu-item-gap` | `4px` | — | Espaço entre itens da mesma seção |
| `--cg-menu-active-bar` | `3px` | — | Largura da borda lateral do item ativo |
| `--cg-menu-rail-width` | `72px` | — | Largura do modo colapsado |
| `--cg-menu-expanded-width` | `260px` | — | Largura padrão (atual 280 → 260) |
| `--cg-menu-transition` | `200ms cubic-bezier(0.4, 0, 0.2, 1)` | — | Mesma easing do projeto |
| `--cg-menu-tooltip-bg` | `rgba(15,23,42,0.96)` | herdar | Fundo do tooltip no rail |
| `--cg-menu-tooltip-text` | `#ffffff` | herdar | Texto do tooltip |

**Tipografia:**
- Section label: **IBM Plex Sans 11px, weight 600, letter-spacing 0.08em, UPPERCASE** (via `text-transform: uppercase`)
- Item label: 15px (0.9375rem), weight 500
- Item ativo: weight 600 + borda lateral 3px na cor `--cg-menu-text`
- Subitem: 14px, weight 500, padding-left maior pra dar hierarquia visual (pai > filho)

**Micro-interações:**
- Hover em item: `background-color` anima de transparente → `--cg-menu-hover` em 150ms
- Item ativo: borda esquerda com `transform: scaleY(0) → scaleY(1)` no carregamento (entrada)
- Submenu: `max-height` + `opacity` em 200ms (mais suave que o display:none atual)
- Modo rail: chevron do botão colapsar gira 180° (já tem, manter)
- Avatar no user card: scale 1.05 no hover (já tem, manter)
- Click no item: ripple sutil via `:active { background-color: var(--cg-menu-active-bg) }` por 100ms

### 3. Estrutura de componentes

**Hoje:** `MainLayout.js` é um **monolito de 382 linhas** que mistura definição de menu, estado de submenu, estado de perfil, lógica de media query, JSX da sidebar, JSX do header, JSX do conteúdo.

**Proposta (refatorar mas sem mudar arquivos novos além de 2):**

| Arquivo | Responsabilidade | LOC estimadas |
|---|---|---|
| `MainLayout.js` (modificado) | Orquestra. Lê contexto, calcula estado de menu, renderiza layout. **Importa e usa os 2 novos.** | ~180 |
| `MainLayout.css` (reescrito) | Apenas estilos base (largura, padding, posicionamento, animações core). Sem cores hardcoded. | ~250 |
| `SidebarMenu.js` (NOVO) | Componente da sidebar. Recebe `menuStructure` (array) e `currentPath`. Renderiza seções, submenus, estado ativo. | ~150 |
| `SidebarMenu.css` (NOVO) | Estilos visuais: section labels, items, submenus, active bar, hover, tooltip do rail. | ~180 |
| `UserMenuFooter.js` (NOVO) | Componente do rodapé: avatar, Configurações (4 itens), Admin condicional, Logout. | ~80 |
| `UserMenuFooter.css` (NOVO) | Estilos do rodapé. | ~70 |

**Benefícios:**
- Sidebar vira "dado" (array de objetos), não JSX hardcoded. Adicionar/mover item futuro = mudar 1 objeto.
- User card do rodapé vira componente isolado (testável, reusável).
- `MainLayout.js` volta a ser sobre **layout** (Header + Sidebar + Content), não sobre o que tem **dentro** da sidebar.

**Estrutura de dados da menuStructure:**

```js
const menuStructure = [
  { type: 'item', name: 'Home', path: '/', icon: FaHome },
  {
    type: 'section',
    label: 'Relatórios & Insights',
    items: [
      { type: 'item', name: 'Relatórios', path: '/relatorio', icon: FaChartLine },
      { type: 'item', name: 'Insights', path: '/insights', icon: FaLightbulb },
      { type: 'item', name: 'Modelos de Relatório', path: '/modelos-relatorio', icon: FaFileAlt },
    ],
  },
  {
    type: 'section',
    label: 'Registrar & Consultar',
    items: [
      { type: 'submenu', name: 'Transações', icon: FaWallet, key: 'transacoes', items: [
        { name: 'Importação em Massa', path: '/importacao', icon: FaFileImport },
        { name: 'Recebimentos', path: '/recebimentos/novo', icon: FaHandHoldingUsd },
        { name: 'Histórico de Recebimentos', path: '/recebimentos/historico', icon: FaHistory },
      ]},
      { type: 'item', name: 'Tags', path: '/tags', icon: FaTags },
    ],
  },
  {
    type: 'section',
    label: 'Patrimônio & Compartilhado',
    items: [
      { type: 'submenu', name: 'Patrimônio', icon: FaPiggyBank, key: 'patrimonio', items: [
        { name: 'Resumo', path: '/patrimonio', icon: FaPiggyBank },
        { name: 'Contas', path: '/patrimonio/contas', icon: FaBuilding },
        { name: 'Simulador de Rendimentos', path: '/patrimonio/simulador', icon: FaCalculator },
        { name: 'Evolução', path: '/patrimonio/evolucao', icon: FaChartArea },
        { name: 'Patrimônio Histórico', path: '/patrimonio/historico', icon: FaCalendarAlt },
        { name: 'Importar OFX', path: '/patrimonio/importacoes-ofx', icon: FaFileImport },
        { name: 'Transferências', path: '/patrimonio/transferencias', icon: FaExchangeAlt },
        { name: 'Open Finance', path: '/pluggy', icon: FaPlug },
      ]},
      { type: 'submenu', name: 'Empréstimos', icon: FaHandshake, key: 'emprestimos', items: [
        { name: 'Lista de Empréstimos', path: '/emprestimos', icon: FaHandshake },
        { name: 'Pessoas', path: '/pessoas', icon: FaAddressBook },
      ]},
      { type: 'item', name: 'Contas Conjuntas', path: '/conjunto', icon: FaUsers },
    ],
  },
];
```

**Detalhe importante:** "Open Finance" vira item direto **dentro do submenu Patrimônio** (mantém o caminho lógico: Pluggy é o canal de importação do Open Finance do Patrimônio) — não é mais item duplicado no nível raiz. Isso resolve a redundância que o user pode ter percebido.

### 3.1 Mapeamento de ícones (Font Awesome → Material Icons)

**Decisão:** trocar `react-icons/fa` por `@mui/icons-material` para todos os ícones da sidebar. MUI já está instalado (`@mui/icons-material@^6.4.7`), então é só trocar os imports.

| Item | Atual (`Fa*`) | Novo (`@mui/icons-material`) |
|---|---|---|
| Home | `FaHome` | `HomeIcon` |
| Relatórios | `FaChartLine` | `ShowChartIcon` |
| Modelos de Relatório | `FaFileAlt` | `DescriptionIcon` |
| Insights | `FaLightbulb` | `LightbulbIcon` |
| Transações (pai) | `FaWallet` | `AccountBalanceWalletIcon` |
| Importação em Massa | `FaFileImport` | `FileUploadIcon` |
| Recebimentos | `FaHandHoldingUsd` | `PaidIcon` |
| Histórico de Recebimentos | `FaHistory` | `HistoryIcon` |
| Tags | `FaTags` | `LocalOfferIcon` |
| Patrimônio (pai) | `FaPiggyBank` | `SavingsIcon` |
| Resumo | `FaPiggyBank` | `DashboardIcon` |
| Contas | `FaBuilding` | `AccountBalanceIcon` |
| Simulador de Rendimentos | `FaCalculator` | `CalculateIcon` |
| Evolução | `FaChartArea` | `AreaChartIcon` |
| Patrimônio Histórico | `FaCalendarAlt` | `CalendarMonthIcon` |
| Importar OFX | `FaFileImport` | `FileDownloadIcon` |
| Transferências | `FaExchangeAlt` | `SwapHorizIcon` |
| Open Finance | `FaPlug` | `HubIcon` (rede/conectividade — combina com Open Finance) |
| Empréstimos (pai) | `FaHandshake` | `HandshakeIcon` |
| Lista de Empréstimos | `FaHandshake` | `ListAltIcon` |
| Pessoas | `FaAddressBook` | `ContactsIcon` |
| Contas Conjuntas | `FaUsers` | `GroupIcon` |
| Meu Perfil | `FaUser` | `AccountCircleIcon` |
| Como Utilizar | `FaQuestionCircle` | `HelpOutlineIcon` |
| Sair | `FaSignOutAlt` | `LogoutIcon` |
| Admin | `FaUserShield` | `AdminPanelSettingsIcon` |
| Toggle (submenu) | `FaChevronDown` / `FaChevronRight` | `ExpandMoreIcon` / `ChevronRightIcon` |
| Toggle (colapsar sidebar) | `FaChevronLeft` | `ChevronLeftIcon` |
| Mobile (abrir) | `FaBars` | `MenuIcon` |
| Mobile (fechar) | `FaTimes` | `CloseIcon` |

**Notas sobre a escolha de cada ícone:**
- `SavingsIcon` em vez de `PiggyBank` — versão MUI do porquinho, mas tem variantes; se a forma do MUI não agradar, fallback é `MonetizationOnIcon` (cifrão) ou `AccountBalanceIcon`.
- `HubIcon` pra Open Finance (em vez de `ElectricalServicesIcon`) — representa rede/conectividade, semanticamente mais próximo de "Open Finance = rede de instituições financeiras conectadas".
- `AccountBalanceWalletIcon` pra Transações (em vez de `WalletIcon`) — versão mais "completa" da carteira, com a aba em cima.
- `HandshakeIcon` é direto no MUI e bate com o `FaHandshake`.

**Importação recomendada (named imports com tree-shaking):**
```js
// ❌ Antes (ruim pra tree-shaking)
import { FaHome, FaChartLine, ... } from 'react-icons/fa';

// ✅ Depois (bom pra tree-shaking)
import HomeIcon from '@mui/icons-material/Home';
import ShowChartIcon from '@mui/icons-material/ShowChart';
// etc.
```
Vantagem: cada ícone vira uma entrada de bundle só, sem trazer a Fa inteira. Importante pro tamanho do bundle.

### 4. Modo rail (colapsado)

**Hoje:** 72px, só ícones centrados, sem dica de item ativo, sem tooltip.

**Proposta:**
- Largura: 72px (mantém)
- Logo: só o ícone centralizado (mantém)
- Itens: só ícones centralizados, **com tooltip no hover** mostrando o nome completo
- Item ativo: borda lateral colorida (visível mesmo sem texto)
- Botão de colapsar: posicionado na parte de baixo da sidebar (não no topo), ícone muda `chevron-left ↔ chevron-right` (já existe, manter)
- Section labels: **escondidos** quando rail (não cabe)

**Tooltip:**
- Aparece à direita do item, 200ms após hover
- Fundo `--cg-menu-tooltip-bg`, texto branco, padding 6px 12px, border-radius 6px, sombra `var(--cg-shadow-md)`
- Se hover em item com submenu, tooltip mostra **só o nome do pai** (submenu abre como fly-out, ver opcional abaixo)

**Opcional (NÃO nesta sessão):** Submenu como fly-out no modo rail. Decidir depois se vale o trabalho — implementação mais complexa (calcular posição absoluta, gerenciar estado de qual submenu está aberto, etc).

### 5. Mobile

**Hoje:** Drawer deslizante com regras `!important` forçadas.

**Proposta:**
- Mantém drawer (funciona, é o padrão mobile)
- Remove os `!important` reorganizando a cascata CSS (especificidade natural via `.side-menu.mobile.mobile-menu-open` já é alta o suficiente)
- Adapta seção "Configurações" pra ser a única seção visível no rodapé mobile (sem header de seção pra economizar espaço)
- User card some no mobile (drawer é só navegação — perfil fica no header/topbar, fora do escopo desta sessão)

### 6. Limpeza do CSS

**Hoje:** 957 linhas com:
- `.main-content` definido 2x (uma comentada)
- `.mobile-menu-backdrop` definido 2x (uma vez normal, uma vez vazia)
- `.main-menu-toggle` definido 2x (linha 674 e linha 771 com valores diferentes)
- `@media` quebrado em 2 (1024px e 992px) sem razão aparente
- Comentários `/* ... */` antigos do tipo "REMOVIDO", "ajustar se necessário", "pode precisar de ajustes específicos se o layout quebrar"

**Proposta:**
- `MainLayout.css` reescrito: 250 linhas no máximo, sem regras duplicadas, sem comentários históricos
- Variáveis de cor/movimento/tamanho **sempre** via tokens (`var(--cg-*)`), zero hardcoded
- `@media` consolidado: 1 query para tablet (≤1024px), 1 para mobile (≤768px)
- Sem `!important` exceto onde a regra do ADR-012 exigir (cores presas em wrappers globais — improvável na sidebar)

## Plano de execução (para o `newapp-executor`)

> **Importante:** o executor vai seguir as fases abaixo. Cada fase é testável independentemente.

### Fase 1: Tokens novos (15min)
- Adicionar 14 novos tokens em `src/theme/tokens.css` (seção "Menu — Fase 7")
- Verificar visualmente em light + dark que nada quebrou (sidebar atual usa as mesmas variáveis, sem regressão)

### Fase 2: Criar estrutura de dados (20min)
- Mover `menuItems` de `MainLayout.js` para um arquivo `src/components/Layout/menuStructure.js` (exporta o array)
- Adicionar `type: 'item' | 'submenu' | 'section'` em cada nó
- Trocar todos os imports de ícones de `react-icons/fa` para `@mui/icons-material` (ver seção 3.1)
- Garantir que `isParentActive` ainda funciona (lógica de "pai ativo se filho bate") — extrair para `src/components/Layout/menuUtils.js`

### Fase 3: Criar `SidebarMenu.js` + CSS (45min)
- Recebe props: `menuStructure`, `currentPath`, `isCollapsed`, `isMobile`
- Renderiza as 4 seções com headers
- Renderiza Home em destaque (acima da primeira seção)
- Suporta modo rail (esconde section labels, mostra tooltip)
- Estado interno de submenu: `expandedMenus` (já existe, migra pra cá)
- Click no item fecha drawer mobile (callback do parent)

### Fase 4: Criar `UserMenuFooter.js` + CSS (30min)
- 4 itens fixos: Meu Perfil, Como Utilizar, ThemeToggle, Sair
- Item condicional: Admin (se `usuario.role === 'admin'`)
- Avatar do user no bottom **sem dropdown** (as 3 ações de perfil já estão visíveis acima do avatar como itens da seção Configurações — o avatar é só display)
- Header de seção "Configurações" sutil

### Fase 5: Refatorar `MainLayout.js` (30min)
- Importar `SidebarMenu` e `UserMenuFooter`
- `MainLayout.js` fica só com: contexto, media query, layout (header + sidebar + main)
- Reduzir de 382 → ~180 linhas
- Persistir `isMenuCollapsed` em `localStorage` chave `cg:sidebar-collapsed` (lê no mount, salva no toggle)

### Fase 6: Limpar `MainLayout.css` (30min)
- Reescrever: 250 linhas
- Sem duplicações, sem `!important` desnecessário, `@media` consolidado
- Garantir tokens (zero hardcoded)

### Fase 7: Validação visual (15min)
- Rodar `npm start` (porta 3004)
- Validar com `browser-use`:
  - Light mode: Home em destaque, 4 seções visíveis, item ativo com borda, hover suave
  - Dark mode: tokens reagem (validar `getComputedStyle().color` muda sem reload — regra do ADR-012)
  - Modo colapsado: ícones centralizados, tooltip aparece no hover
  - Mobile (resize 768px): drawer abre/fecha sem `!important`, sem scroll horizontal

### Fase 8: Commit estruturado (10min)
- Chamar `newapp-committer` para empacotar em Conventional Commits PT-BR
- Sugestão de commits:
  - `feat(sidebar): adicionar tokens de seção e tipografia`
  - `refactor(sidebar): extrair menuStructure e menuUtils do MainLayout`
  - `feat(sidebar): criar componente SidebarMenu com agrupamento por seções`
  - `feat(sidebar): criar UserMenuFooter com Configurações no rodapé`
  - `refactor(sidebar): simplificar MainLayout para orquestrar layout`
  - `style(sidebar): limpar MainLayout.css (957 → 250 linhas, sem duplicações)`

## Pontos de atenção / Riscos

1. **Dark mode (ADR-012):** qualquer cor nova na sidebar precisa de `var(--cg-color-*)` reativa, NUNCA inline style. Validar com `getComputedStyle().color` que muda sem reload.
2. **Glassmorphism (ADR-008):** sidebar usa `backdrop-filter: blur(24px)`. Garantir que o gradiente vibrante atrás continua visível (especialmente em light mode). Se mudar o bg da sidebar, o orbe/gradiente precisa continuar aparecendo.
3. **Bug mobile do backdrop:** o CSS atual tem `.mobile-menu-backdrop` definido 2x com regras conflitantes. O executor precisa garantir que UMA definição fica e o backdrop aparece quando o drawer abre.
4. **`!important` legado:** o executor não deve sair adicionando `!important` — se a regra antiga usava, é porque havia um conflito de especificidade que precisa ser RESOLVIDO estruturalmente, não com força bruta.
5. **Active state no modo rail:** sem texto, a única pista visual é a borda lateral. Testar que essa borda tem contraste suficiente em ambos os temas.
6. **Submenu do Patrimônio com 8 itens:** mesmo com header de seção, são 8 itens inline. Em telas menores (notebook 13"), pode precisar scroll. O `menu-items` já tem `overflow-y: auto`, validar que o scroll funciona suave.
7. **`expandedMenus` (submenus abertos):** o estado atual perde a expansão quando o user recarrega a página. **Decisão:** **NÃO persistir nesta sessão** — submenus começam fechados (exceto Transações, que volta ao comportamento atual de `expandedMenus.transacoes: true` por default). Persistência de submenu é nice-to-have, fica pra depois.
8. **Acessibilidade:** section headers devem ter `aria-label`. Item ativo deve ter `aria-current="page"`. Submenu trigger deve ter `aria-expanded`. Tooltip do rail precisa de `aria-describedby`.

## Decisões deliberadas (não voltar)

- ✂️ **Nenhuma feature removida.** 15 destinos continuam existindo, 4 grupos com submenu continuam funcionando.
- 🎨 **Glassmorphism mantido** (não é hora de tirar — é a identidade visual do projeto).
- 🌓 **Dark mode é primeira-classe.** Toda regra tem variante em `[data-theme="dark"]`.
- 📐 **Largura padrão 260px** (redução dos atuais 280px pra dar mais espaço pro conteúdo em notebooks).
- 🚪 **Modo rail opcional** (botão de colapsar continua, **estado persistido em `localStorage` chave `cg:sidebar-collapsed`**).
- 🎯 **Ícones: Material Icons (MUI)** em vez de Font Awesome. Já está instalado, sem dependência nova. Geometria mais limpa e profissional.

## Próximo passo

1. **Alisson revisa este design doc** (ler agora)
2. Se aprovar, eu delego ao `newapp-executor` executar **Fase 1 → 8** sequencialmente
3. O executor vai PARAR e perguntar via `question` se travar em qualquer fase
4. `newapp-committer` empacota os commits no final
