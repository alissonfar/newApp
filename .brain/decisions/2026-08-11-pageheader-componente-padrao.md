---
type: decision
status: active
created: 2026-08-11
tags: [layout, ui, design-system, pageheader, icones, frontend]
related:
  - .brain/context/layout-largura-e-pageheader.md
  - docs/superpowers/specs/2026-08-11-pageheader-padronizacao-design.md
---

# ADR-024: `PageHeader` — componente único de cabeçalho de página, não estender `SectionHeader`

## Contexto

Um levantamento em 26+ rotas encontrou cabeçalhos de página totalmente inconsistentes: metade usava `<h1>`, metade `<h2>`; cores hardcoded (`#333`, azul `#1976d2`) misturadas com variáveis de tema; alinhamento centralizado em 2 páginas (Modelos de Relatório, Nova Importação) contra esquerda no resto; só 2 páginas (Pluggy, Patrimônio) tinham ícone, e mesmo essas usavam `react-icons/fa` em vez do `@mui/icons-material` já usado pela sidebar para a mesma rota. O usuário pediu que o padrão visual de `/pluggy` (título grande + ícone + subtítulo, próximo da sidebar) virasse o padrão único do app.

Já existia um componente compartilhado, `SectionHeader` (`src/components/shared/SectionHeader.js`), usado em 13 lugares — mas como título de **card/seção interna** (`h2`, 1.125rem, ícone azul `--cg-color-primary`), não como cabeçalho principal de página.

## Opções consideradas

- **Estender `SectionHeader` com uma variante `size="large"`:** rejeitada — misturaria dois propósitos visuais distintos (título de card vs. título de página) num componente só, com risco de efeito colateral nos 13 usos existentes ao ajustar a lógica condicional de tamanho.
- **Novo componente `PageHeader` dedicado (escolhida):** zero risco para o `SectionHeader` existente, API enxuta e propósito único.

## Decisão

### Componente

`src/components/shared/PageHeader.js` + `.css`. API: `{ icon, title, subtitle, action }`.

```jsx
<PageHeader
  icon={<HubIcon />}
  title="Open Finance"
  subtitle="Sincronize automaticamente transações..."
  action={<Button>...</Button>}
/>
```

- `title`: `<h1>`, `font-size: clamp(1.5rem, 4vw, 2.5rem)`, `font-weight: 700`, `color: var(--cg-color-text-primary)` — nunca hardcoded.
- `icon`: opcional, herda `currentColor` (mesma cor do título — **não** usa o azul de destaque `--cg-color-primary` que o `SectionHeader` usa; o padrão de referência `/pluggy` não tinha ícone colorido).
- `subtitle`: opcional, `<p>`, `var(--cg-color-text-secondary)`.
- `action`: opcional, alinhado à direita do título na mesma linha (`justify-content: space-between`).

`SectionHeader` não foi tocado — continua servindo aos 13 usos de título de seção/card interna. Duas exceções: `Relatorio.js` e `ContasFixas.js`/`PendenciasContasFixas.js` usavam `SectionHeader` **indevidamente** como cabeçalho principal de página (não de card) — essas migraram para `PageHeader`.

### Regra de ícone: sempre o mesmo da sidebar

Cada `PageHeader` usa o componente `@mui/icons-material` já mapeado pra rota em `src/components/Layout/menuStructure.js` — não `react-icons/fa` (biblioteca usada na maioria das páginas antes). Sub-páginas de detalhe sem entrada própria na sidebar (ex: detalhe de um empréstimo específico, `/emprestimos/:id`) herdam o ícone da seção/página-mãe mais próxima (nesse caso, `HandshakeIcon` de `/emprestimos`).

4 rotas não têm nenhuma entrada em `menuStructure.js` (acessadas via menu do usuário, não pela sidebar): `/tags/inativos`, `/profile`, `/como-utilizar`, `/admin`. Para essas, o ícone foi escolhido manualmente e confirmado com o usuário: `PersonIcon` (perfil), `HelpOutlineIcon` (como utilizar, substituindo o antigo `FaInfoCircle`), `AdminPanelSettingsIcon` (admin), `LocalOfferIcon` herdado (tags inativos).

### Efeito colateral tratado: banner do "Como Utilizar"

`HowToUse.css` tinha um `.how-to-use-header` com fundo gradiente roxo + texto branco centralizado — um "banner" único no app, incompatível com o texto escuro padrão do `PageHeader`. Removido nesta migração (não estava na spec original — decisão tomada durante a execução) para não deixar texto escuro ilegível sobre fundo roxo.

## Consequências

- Pró: toda página agora usa a mesma identidade visual, incluindo o mesmo ícone que a sidebar já usa para aquela rota — reforça a relação rota↔ícone.
- Pró: elimina ~15 regras CSS órfãs de título por página (cores hardcoded, `font-size` fixo) — cada uma removida junto da migração do arquivo correspondente.
- Contra: introduziu import de `@mui/icons-material` em várias páginas que antes só usavam `react-icons/fa` — duas bibliotecas de ícone continuam coexistindo no projeto (decisão consciente, não um novo débito: `react-icons` continua em uso extensivo fora de headers).
- Achado durante a execução, fora do escopo original: 3 arquivos de página (`Transacoes.js`, `GerenciarImportacoes.js`, `ImportacaoEmMassa.js`) não são roteados em nenhum lugar de `App.js` — código morto, não migrados, candidatos a remoção separada (ver [contexto](../context/layout-largura-e-pageheader.md)).
