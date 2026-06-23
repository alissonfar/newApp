---
type: session
status: active
created: 2026-06-23
tags: [design-system, modernizacao-visual, frontend, mui, tailwind, glassmorphism, dark-mode, planejamento]
---

# Sessão: Modernização visual — Design doc

## Pré-requisitos

- **Node.js 20+** (já temos, validado pelo projeto)
- **Python 3.12+** (já temos, validado para `ui-ux-pro-max`)
- **MongoDB rodando** com replica set (já temos via `docker-compose up -d`)
- **IBM Plex Sans** via Google Fonts OU `@fontsource/ibm-plex-sans` (decidir na execução — auto-hospedagem evita requests externos)
- **Ferramenta de validação de contraste**: usar [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) ou similar durante validação de tokens

## Objetivo

Unificar o design system do **Controle de Gastos** com identidade **glassmorphism/soft**, suporte a **light + dark mode**, **MUI como base** de componentes (com tema unificado), **Tailwind como utilitário pontual** sem `important: true`. Escopo focado em **tokens + componentes `shared/` + 3 telas-chave** (Home, NovaTransacaoForm, Relatorio).

## Contexto e motivação

### Estado atual (achados da exploração)

- **MUI 6.4 instalado mas sem `ThemeProvider` configurado** — único arquivo de tema existente é `components/PDF/theme.js` (do React-PDF, não do MUI). Componentes MUI rodam com tema default.
- **Tailwind 4 com `important: true`** — força `!important` em todas as classes, gerando guerra de especificidade com o MUI. Configuração incomum.
- **~70 arquivos CSS locais** espalhados por `pages/` e `components/`, com **variáveis CSS duplicadas e conflitantes**:
  - `--cor-primaria` aparece com **3 valores diferentes** no projeto:
    - `index.css`: `#2563eb`
    - `MainLayout.css`: `#2c5282`
    - `Home.css` e outros: `#3b82f6`
  - Variáveis `--fonte-titulos`, `--fonte-corpo`, `--cor-texto-principal` referenciadas em vários lugares, definidas em apenas alguns.
- **Design system incipiente** em `src/components/shared/` (Card, Button, Badge, EmptyState, SectionHeader, SegmentedControl, Pagination, BulkActionBar, IconRenderer, ActionDropdown, PeriodQuickFilter, SubcontaSelect) com prefixo `ds-` no CSS, mas **uso é inconsistente** entre páginas.
- **Identidade visual atual:** azul (`#2c5282`/`#3b82f6`) no menu lateral + cards com borda + sombra suave + hover `translateY(-2px)`. Cara "funcional mas genérica", sem identidade forte.
- **MUI Icons + React Icons** usados juntos (inconsistência menor, tolerável).

### Decisões de planejamento (validadas com o usuário)

| Pergunta | Resposta |
|---|---|
| Identidade visual | **Glassmorphism / soft** |
| Dark mode | **Light + dark, dois temas pareados** |
| Tailwind vs MUI | **MUI é base, Tailwind é utilitário pontual** |
| Escopo | **Tokens + shared + 2-3 telas-chave** (Home, NovaTransacaoForm, Relatorio) |
| Menu lateral | **Glass no menu, fundo visível atrás** (precisa estender gradiente até a borda esquerda) |
| Toggle de tema | **No menu lateral, embaixo do nome do usuário** |
| Faseamento | **Manter 6 fases conforme proposto** |
| Compatibilidade | **Manter variáveis antigas como alias** para tokens novos |

## Design system base (gerado via `ui-ux-pro-max`)

- **Estilo:** Glassmorphism (frosted glass, `backdrop-filter: blur(15px)`, borda translúcida `rgba(255,255,255,0.2)`, camadas)
- **Tipografia:** IBM Plex Sans (financial, trustworthy, professional, banking, serious) — Google Fonts
- **Paleta light (referência):** primary `#18181B`, CTA `#2563EB`, background `#FAFAFA`, text `#09090B` (monocromático + azul)
- **Paleta dark (referência):** OLED-friendly (deep black `#000000`, dark grey `#121212`, midnight blue `#0A0E27`), texto `#FFFFFF`/`#E0E0E0`
- **Efeitos:** backdrop-blur 10-20px, borda sutil 1px, light reflection, microanimações 150-300ms
- **Acessibilidade:** contraste mínimo 4.5:1 (texto normal), 3:1 (texto grande e elementos UI), foco visível, `prefers-reduced-motion` respeitado

## Arquitetura proposta

### Estrutura de pastas (novo)

```
controle-gastos-frontend/src/theme/
├── tokens.js              # fonte de verdade em JS (cores, tipografia, espaçamentos, radii, sombras, glass, gradients, motion)
├── tokens.css             # gera CSS variables a partir de tokens.js
├── muiTheme.js            # createTheme() MUI light + dark, consome tokens.js
├── GlobalStyles.js        # Emotion global styles (backdrop-blur helpers, scrollbar, prefers-reduced-motion)
└── README.md              # como usar tokens em qualquer componente
```

### Categorias de tokens (`tokens.js`)

| Categoria | Campos principais |
|---|---|
| `color` | `primary`, `primaryHover`, `secondary`, `background`, `surface`, `textPrimary`, `textSecondary`, `textMuted`, `border`, `success`, `error`, `warning`, `info` (cada um com light e dark) |
| `glass` | `blur` (15px), `opacityLight` (0.15), `opacityMedium` (0.25), `border` (rgba(255,255,255,0.2)), `surface` (cor base translúcida) |
| `gradient` | `background` light e dark (gradiente vibrante) |
| `radius` | `sm` (6px), `md` (12px), `lg` (16px), `xl` (24px), `full` (9999px) |
| `spacing` | escala `4`, `8`, `12`, `16`, `24`, `32`, `48`, `64` |
| `shadow` | `sm`, `md`, `lg`, `glow` (azul sutil para CTAs principais) |
| `font` | `family` (IBM Plex Sans, fallback sistema), `weights` (300, 400, 500, 600, 700), `sizes` (xs/sm/base/lg/xl/2xl/3xl) |
| `motion` | `fast` (150ms), `base` (200ms), `slow` (300ms), `easing` (`cubic-bezier(0.4, 0, 0.2, 1)`) |

### Por que `tokens.js` + `tokens.css`?

O tema MUI tem **acesso direto** aos valores JS (sem precisar parsear CSS) e o CSS global consome as mesmas variáveis. **Sem dessincronização**.

### Tailwind: `important: false` + config alinhado

- Remove `important: true` do `tailwind.config.js`
- Configura `tailwind.config.js` para usar `tokens.js` como base (cores, espaçamentos, radii)
- Utilitários como `bg-primary`, `rounded-lg`, `p-4` continuam funcionando, mas **não brigam** mais com MUI

### Tema MUI (`muiTheme.js`)

Exporta `lightTheme` e `darkTheme`, ambos `createTheme()` lendo de `tokens.js`.

**Sobrescritas no `components`:**

| Componente MUI | Estilo aplicado |
|---|---|
| `MuiButton` | `textTransform: none`, `borderRadius: tokens.radius.md`, `disableElevation: true` default |
| `MuiPaper`, `MuiCard` | `backdropFilter: blur(15px)`, fundo translúcido, borda sutil 1px |
| `MuiAppBar` | Glass |
| `MuiTextField` | `borderRadius: tokens.radius.md`, foco com anel azul (substitui outline default) |
| `MuiDialog` | Overlay mais escuro, papel do dialog é glass |
| `MuiMenu` | Glass |
| `MuiTooltip` | Fundo escuro translúcido |
| `MuiSwitch`, `MuiCheckbox` | Cores alinhadas com `tokens.color` |
| `MuiTab`, `MuiTabs` | Indicador animado, ativo com glass + borda azul |

**Resultado:** qualquer página que importar `Button` do MUI (em vez do `Button` do `shared/`) já fica consistente. O usuário tem **uma escolha** — usar MUI direto ou `shared/`. Os dois ficam alinhados.

## Componentes `shared/` — upgrade e novos

### Componentes existentes (upgrade para família glass)

| Componente | Upgrade |
|---|---|
| `Card` | Variante `glass` (fundo translúcido + `backdrop-filter: blur(15px)` + borda sutil). Variantes: `default`, `glass`, `elevated`, `outlined` |
| `Button` | Adiciona variante `glass`. Adiciona `loading` state. Padroniza `startIcon`/`endIcon` |
| `Badge` | Variantes `glass` e `dot` (bolinha sem texto) |
| `EmptyState` | Padroniza uso de ilustração SVG opcional |
| `SectionHeader` | Adiciona variante com `action` à direita (botão) |
| `SegmentedControl` | Ativo com glass + borda azul |
| `Pagination` | Padroniza botões com `Button` |
| `BulkActionBar` | Usa `Card` glass como base |
| `IconRenderer` | Garante suporte a `react-icons` e `mui-icons` |
| `ActionDropdown` | Refatora para usar MUI `Menu` por baixo (mantém API) |
| `SubcontaSelect` | Refatora para usar MUI `Select` ou `Autocomplete` |
| `PeriodQuickFilter` | Usa `Button` variantes |
| `ConfirmacaoToast` | Mantém (alinhado com tema) |
| `InstituicaoSelect` | Mantém (alinhado com tema) |

### Novos componentes (criados nesta fase)

| Componente | O que faz | Por que precisa existir |
|---|---|---|
| `ThemeToggle` | Botão sol/lua que troca light↔dark. Persiste em `localStorage` (chave `cg:theme`) | Decidido pelo usuário — fica no menu lateral abaixo do nome |
| `GradientBackground` | Componente que renderiza o gradiente vibrante atrás de tudo (vai no `MainLayout`) | Glass só funciona com cor vibrante por baixo |
| `StatCard` | Card de KPI (label, valor, variação %) | Substitui os 3 `glass-card` da Home (Recebíveis/Gastos/Saldo) por API consistente |
| `TransactionRow` | Linha de transação (ícone, descrição, data, valor, ações) | Hoje tem `.transacao-card` no Home.css, `.transaction-card` no Transaction.css, etc. Cada página reinventa. Vamos unificar |
| `DataTable` | Wrapper sobre tabela que dá `borderless`/`striped`/`glass` | Várias páginas (Relatorio, Transacoes) têm tabela. Hoje cada uma reimplementa |
| `Modal` | Wrapper de MUI Dialog com estilo glass | O `ModalTransacao.js` existe mas tem CSS próprio. Vamos alinhar |

### Convenção de nomenclatura

Todos os componentes do `shared/` exportam **variantes como prop**, não classes CSS. Exemplo:

```jsx
<Card variant="glass" elevation="md" />
<Button variant="primary" size="md" loading={...} startIcon={<Plus />} />
<Badge variant="success" size="sm" />
```

Nada de `className="ds-card ds-card--glass"`. A lógica fica no componente. Isso elimina inconsistência entre páginas.

## Telas-chave refatoradas (Fase 6)

| Tela | O que muda |
|---|---|
| **Home** | Remove `home-container` com fundo cinza. Embrulha em `GradientBackground`. Substitui os 3 `glass-card` por `StatCard`. Substitui a tabela de transações custom por `TransactionRow` + `DataTable`. Cada seção vira `Card` glass |
| **NovaTransacaoForm** | Tabs (`TabPrincipal`, `TabPagamentos`, `TabAvancado`) ganham estilo glass. Inputs do MUI (`TextField`, `Select`) herdam tema. Botões de submit padronizados |
| **Relatorio** | Header de filtros vira `SectionHeader` com `action` (botão "Exportar PDF"). Tabela de transações vira `DataTable`. Cards de resumo viram `StatCard` |

## Plano de execução (6 fases)

Cada fase produz algo **visualmente usável e funcional**. Se a gente parar no meio, o app continua funcionando. Sem "big bang".

### Fase 1 — Fundação de tokens (1-2 commits)

- Criar `src/theme/tokens.js`, `tokens.css`, `muiTheme.js`
- Adicionar `ThemeProvider` no `App.js` (light como default)
- Adicionar aliases das variáveis antigas em `tokens.css` (compatibilidade)
- **Nenhuma página muda de cara** ainda — só o tema MUI default vira "com cara"
- *Validação:* `npm run build` passa, app renderiza, contraste OK, smoke test no `/login` e `/`

### Fase 2 — `GradientBackground` + `MainLayout` glass (1-2 commits)

- Adicionar `GradientBackground` no `MainLayout`, atrás de tudo
- Menu lateral vira glass (fundo translúcido, blur, borda sutil)
- Conteúdo da página ganha `padding` necessário para o gradiente aparecer nas bordas
- *Validação:* menu legível, contraste OK, gradiente visível atrás, hover states funcionam

### Fase 3 — `ThemeToggle` + dark mode (1-2 commits)

- Adicionar `ThemeToggle` no menu lateral (perto do perfil, abaixo do nome)
- Persistência em `localStorage` (chave `cg:theme`)
- Hook `useTheme()` que envolve `App.js` em `ThemeProvider` com `mode` controlado
- Detecção inicial via `prefers-color-scheme`
- *Validação:* toggle funciona, dark mode tem contraste 4.5:1 em todas combinações testadas, F5 mantém a escolha, login/registro também respondem ao tema

### Fase 4 — Refatorar `components/shared/` (3-5 commits)

- Atualizar `Card`, `Button`, `Badge` para família glass
- Criar `StatCard`, `TransactionRow`, `DataTable`, `Modal` (glass)
- Atualizar `SectionHeader` com `action` prop
- `ActionDropdown` e `SubcontaSelect` passam a usar MUI por baixo
- *Validação:* cada componente renderiza em light E dark, sem regressão nas páginas que já usam (`Home.js` é a principal)

### Fase 5 — Tailwind sem `important: true` (1 commit)

- Atualizar `tailwind.config.js`: `important: false`, ler tokens de `tokens.js`
- Smoke test: nenhum layout quebrou (Tailwind sem `!important` agora respeita ordem CSS natural)
- *Validação:* `npm run build` passa, nenhuma página quebrou visualmente, smoke test nas 3 telas-chave

### Fase 6 — Telas-chave (3-5 commits)

- 6.1: Home (substitui `home-container` por `GradientBackground` + `Card` glass + `StatCard` + `TransactionRow`)
- 6.2: NovaTransacaoForm (tabs + inputs MUI herdam tema)
- 6.3: Relatorio (filtros + tabela)
- *Validação:* cada tela renderiza em light e dark, funcionalidades críticas (importação Pluggy, multi-tenant, decimal.js) intactas, smoke test completo de criar/editar/excluir transação

## Compatibilidade durante a migração

Páginas que **não** estão na fase 6 continuam usando `--cor-*` antigo. **Plano:**

- Manter `--cor-primaria`, `--cor-fundo`, `--cor-texto`, etc no `tokens.css` (alias para os novos tokens)
- Quem usa `className="bg-blue-600"` direto continua funcionando
- Quem usa `var(--cor-primaria)` continua funcionando
- Vai gerar **CSS duplicado** durante a transição, mas é temporário
- Comentário `/* TODO: migrar para tokens.js */` nos pontos críticos pra rastreio
- Cada refatoração de página remove as variáveis antigas usadas naquele arquivo

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Glassmorphism pesado em devices fracos (mobile) | Usar `backdrop-filter` apenas em `@media (prefers-reduced-motion: no-preference)` E em viewports > 768px. Mobile recebe versão "opaca leve" (fundo branco/cinza claro + borda) |
| Contraste insuficiente em dark mode | **Testar TODOS os pares** (texto sobre fundo, primary sobre surface) com ferramenta. Falhou contraste = ajusta token, não página |
| Quebrar funcionalidades críticas (Pluggy, multi-tenant, decimal.js) | **Não tocamos em nenhuma lógica de negócio**. Só tema/componentes visuais. `npm run build` + smoke test manual nas features críticas após fase 6 |
| Inconsistência entre páginas refatoradas e não-refatoradas | Aceitar por um tempo. Comunicar com você antes de cada fase. Você decide se quer acelerar mais páginas |
| Migração do `MainLayout` quebrar o layout (menu lateral é o esqueleto de toda página) | Fase 2 isolada, com smoke test em todas as rotas privadas antes de avançar |
| IBM Plex Sans adicionar peso ao bundle | Subsetar pesos (apenas 400, 500, 600, 700) e usar `font-display: swap`. Avaliar auto-hospedagem via `fontsource` se impacto for grande |
| Tokens JS vs CSS variables divergirem durante manutenção | **Decisão:** na fase 1, manter dois arquivos paralelos (`tokens.js` + `tokens.css`) sincronizados manualmente via comentário `/* ATUALIZAR TAMBÉM EM tokens.js */` no topo de `tokens.css`. Considerar gerar automaticamente em fase futura se virar fardo. Documentado no `theme/README.md` |

## O que **NÃO** está no escopo

- Migração para outra lib de UI (shadcn, Radix) — fora
- Refatorar o fluxo de autenticação (login, registro) — fora
- Redesign do `NovaTransacaoForm` no nível de UX (reorganizar tabs) — só estilo
- Adicionar animações complexas (framer-motion, etc) — microanimações só via CSS
- Internacionalização (i18n) — fora
- PWA / offline — fora
- Refatorar o `App.css` legado (tem regras mortas) — fora, pode ser fase 7 se sobrar fôlego

## ADRs a criar (quando começar a execução)

- **ADR-006: Estrutura de tokens (JS + CSS) e localização em `src/theme/`**
- **ADR-007: Tema MUI como fonte de verdade para componentes base**
- **ADR-008: Glassmorphism em `MainLayout` exige gradiente vibrante visível atrás**
- **ADR-009: Tailwind `important: false` + tokens como fonte única**

## Critérios de aceite da fase 6 (entrega final)

- [ ] Home, NovaTransacaoForm e Relatorio renderizam corretamente em **light e dark**
- [ ] Toggle de tema funciona e persiste em `localStorage`
- [ ] Todas as variáveis CSS antigas (`--cor-*`) foram removidas das páginas refatoradas
- [ ] Contraste mínimo 4.5:1 em texto e 3:1 em elementos UI (validado em light e dark)
- [ ] `npm run build` passa sem warnings novos
- [ ] Funcionalidades críticas intactas: importar transação Pluggy, importar CSV/OFX, multi-tenant, decimal.js nos cálculos
- [ ] Mobile (≤768px) recebe fallback "opaco leve" sem `backdrop-filter` pesado
- [ ] Nenhum emoji usado como ícone (já é padrão, manter)

## Próximos passos

1. Você revisa este design doc
2. Se aprovado, eu invoco a skill `writing-plans` para criar o plano de implementação detalhado (passo a passo com critérios de aceite por commit)
3. Você aprova o plano
4. Você delega para `newapp-executor` aplicar fase por fase (opcionalmente posso começar via delegação se você pedir)

## Aprendizados

- O projeto tem **fundações sólidas** (multi-tenant, decimal.js, integrações Pluggy) e o frontend só precisa de um guarda-roupa novo.
- A maior parte do "desconforto visual" atual vem de **falta de tema MUI** (default cinza/roxo) e de **variáveis CSS duplicadas com valores divergentes** (3 azuis diferentes!).
- O design system incipiente em `components/shared/` mostra que Alisson já pensou nisso — só não foi completado. A modernização **estende** o que existe, não substitui.
