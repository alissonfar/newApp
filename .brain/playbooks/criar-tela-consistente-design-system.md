---
type: playbook
status: active
created: 2026-08-07
tags: [frontend, design-system, checklist, ui]
related:
  - .brain/decisions/2026-08-07-modal-exige-card-glass-interno.md
  - .brain/decisions/2026-06-23-glassmorphism-exige-gradiente-vibrante.md
  - .brain/decisions/2026-06-23-mui-fonte-verdade-componentes.md
  - .brain/sessions/2026-08-07-conta-fixa-implementacao-e-fix-visual.md
---

# Como criar uma tela nova consistente com o design system (`controle-gastos-frontend`)

## Contexto / por que este playbook existe

Na primeira versão da feature Conta Fixa (2026-08-05), a UI foi implementada com HTML cru — `<input>`/`<select>`/`<label>` sem nenhuma classe CSS, uma `<table>` sem estilo, `window.confirm()` nativo do browser, um `<div>` solto em vez do modal real. **A causa não foi falta de componentes disponíveis** — o design system inteiro (`Card`, `Button`, `SectionHeader`, `Badge`, `EmptyState`, `DataTable`, `ModalTransacao`, `TagSelector`) já existia e cobria 100% do caso de uso. A causa foi não ter verificado o que já existia antes de escrever a tela.

**Regra de ouro: antes de escrever uma tela nova, procure a tela mais parecida que já existe e copie o padrão dela — nunca escreva HTML solto "que funciona" e deixe o estilo pra depois.**

## Checklist — antes de escrever a primeira linha de JSX

1. **Existe uma tela parecida?** Procure por CRUD/forms/listas similares (ex: `Tags`, `Relatorio`, `Subcontas`) e leia o `.js` + `.css` dela primeiro.
2. **Vou abrir um modal?** → use `src/components/Modal/ModalTransacao.js`, e **envolva seu conteúdo num `<Card variant="glass" padding="md">` por dentro** (ver [ADR-018](../decisions/2026-08-07-modal-exige-card-glass-interno.md) — sem isso o modal fica translúcido/vazando o fundo). Se o conteúdo pode passar da altura da tela, adicione o wrapper `.transacao-tab-content` (de `src/components/Transaction/TransacaoTabs.css`) por dentro do `Card` pra ter scroll interno — `.modal-content` tem `overflow: hidden`, sem scroll próprio.
3. **Vou ter campos de formulário (texto, número, select, data, checkbox)?** → `<input>`/`<select>` nativos dentro de um bloco `<div className="form-section">` (classe já definida em `src/components/Transaction/NovaTransacaoForm.css`, importável de qualquer lugar — CSS é global no projeto, não scoped). **Não use `TextField`/`Select` do MUI** — não é o padrão do projeto (MUI aparece só em pontos pontuais: `Tooltip`, `IconButton`, `CircularProgress`).
4. **Vou agrupar campos numa grade?** → `<div className="form-grid">` (2 colunas, mesmo arquivo CSS acima).
5. **Vou ter uma lista/repetição de itens (ex: linhas de pagamento)?** → reaproveite as classes `.pagamento-item` / `.pagamento-item-header` / `.pagamento-campos-principais` / `.btn-adicionar-pagamento` (mesmo CSS) em vez de inventar um card novo.
6. **Vou mostrar uma tabela?** → `src/components/shared/DataTable.js` (motor TanStack Table, linhas em formato card). Props: `columns=[{key,label,align,width}]`, `rows`, `renderCell={(row,col)=>...}` (se passar `renderCell`, ele é chamado pra **toda** coluna — trate todos os `col.key` no seu `switch`), `variant`, `emptyMessage`. **Nunca `<table>` HTML crua.**
7. **Vou mostrar um status (ativo/pausado/erro/etc)?** → `src/components/shared/Badge.js` (`variant`: `default|success|error|warning|info|glass`), não texto solto.
8. **Vou pedir confirmação de uma ação destrutiva (excluir, etc)?** → `Swal.fire({...})` (`import Swal from 'sweetalert2'`) + `toast.success/error(...)` (`import { toast } from 'react-toastify'`) pro resultado. **Nunca `window.confirm`/`window.alert`.** Exemplo real: `src/components/Tag/TagManagement.js`.
9. **Vou usar ícones?** → `react-icons/fa` (`FaEdit`, `FaTrash`, `FaPlus`, `FaPause`, `FaPlay`, `FaCheck`, etc) em botões de ação de lista. `@mui/icons-material` só em contexto MUI específico (Tooltip/IconButton).
10. **Vou adicionar um item de menu?** → `src/components/Layout/menuStructure.js` (estrutura declarativa — `type: 'item'` ou `type: 'submenu'`), nunca hardcode no `Sidebar`.
11. **Vou adicionar uma rota?** → `src/App.js`, seguindo o padrão `<Route path="..." element={<PrivateRoute><MainLayout><SuaPagina /></MainLayout></PrivateRoute>} />`.
12. **Cabeçalho de seção com título/subtítulo/ação?** → `src/components/shared/SectionHeader.js` (`title`, `subtitle`, `icon`, `action`).
13. **Lista vazia?** → `src/components/shared/EmptyState.js` (`message` ou `title`+`description`, `action`), não uma mensagem solta.

## Depois de escrever o código

- Rode `npx eslint <arquivos>` antes de considerar pronto.
- **Teste visualmente no navegador antes de reportar como concluído** — ler o JSX não é suficiente pra pegar problema de estilo/layout. Use o Browser pane e tire ao menos 1 screenshot real por tela nova/alterada visualmente. Isso está no `CLAUDE.md` do projeto, mas a lição desta sessão é: mesmo seguindo os componentes certos, um detalhe de composição (Card `glass` faltando dentro do modal) só apareceu no teste visual, não na leitura do código.
- Ao testar um modal, teste também o **scroll interno** se o formulário tiver mais de ~6 campos — é fácil o conteúdo de baixo ficar inacessível sem aviso (não dá erro, só fica cortado).

## Troubleshooting

- **"O modal/card parece translúcido, dá pra ver o fundo atrás"** → falta o `<Card variant="glass">` interno (ver item 2 e [ADR-018](../decisions/2026-08-07-modal-exige-card-glass-interno.md)).
- **"Um botão fica sozinho numa caixa gigante, muito espaço vazio"** → você está usando `.form-section`/`.form-grid` (dimensionados para formulários densos, com abas) num formulário simples/curto. Considere um layout de largura menor ou agrupar campos relacionados num único bloco com mini-título, em vez de 1 campo por bloco.
- **"Conteúdo abaixo de X não aparece e não dá pra rolar"** → falta o wrapper `.transacao-tab-content` (`flex:1; overflow-y:auto; min-height:0`) dentro do `Card`/modal.
