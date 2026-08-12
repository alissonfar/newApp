---
type: context
status: active
created: 2026-08-11
tags: [layout, main-content, pageheader, css, frontend, pendencias]
related:
  - .brain/decisions/2026-08-11-pageheader-componente-padrao.md
  - docs/superpowers/specs/2026-08-11-pageheader-padronizacao-design.md
  - docs/superpowers/plans/2026-08-11-largura-fluida-paginas.md
  - docs/superpowers/plans/2026-08-11-pageheader-padronizacao.md
---

# Layout: largura do `.main-content` e padrão de cabeçalho (`PageHeader`)

> Nota de sessão pendente de confirmação visual pelo usuário (2026-08-11) — ver "Pendências" no fim deste arquivo antes de continuar o trabalho de layout em sessão futura.

## Mecanismo de largura do `.main-content`

`src/components/Layout/MainLayout.css` — o `.main-content` (área de conteúdo à direita da sidebar) **já calcula largura corretamente**, sem bug:

```css
.main-content {
  flex: 1;
  min-width: 0;
  padding: 1.5rem; /* era 2rem antes de 2026-08-11 */
  margin-left: var(--cg-menu-expanded-width); /* 260px */
  width: calc(100% - var(--cg-menu-expanded-width));
}
.main-content.expanded {
  margin-left: var(--cg-menu-rail-width); /* 72px, sidebar colapsada */
  width: calc(100% - var(--cg-menu-rail-width));
}
```

**O bug histórico (corrigido em 2026-08-11) não estava aqui** — estava em cada página individualmente: 18 arquivos de página tinham seu próprio wrapper com `max-width: 1000-1400px` + `margin: 0 auto`, duplicando a limitação de largura por cima do `.main-content` já correto. Isso fazia sobrar espaço vazio nas laterais (mais visível ainda quando a sidebar colapsava, porque o `.main-content` ganhava largura extra que o wrapper interno ignorava). Corrigido removendo `max-width`/`margin:auto` de todos — containers de página agora são fluidos, confiando só no `padding` do `.main-content` como respiro lateral. Ver [plano de largura fluida](../../docs/superpowers/plans/2026-08-11-largura-fluida-paginas.md).

**Se aparecer de novo** um `max-width` + `margin: 0 auto` isolado numa página nova, é o mesmo anti-padrão — não adicionar, deixar fluido.

## Componente `PageHeader`

Ver [ADR-024](../decisions/2026-08-11-pageheader-componente-padrao.md) para a decisão completa. Resumo prático pra quem for tocar em cabeçalho de página:

- **Arquivo:** `src/components/shared/PageHeader.js` + `.css`.
- **API:** `{ icon, title, subtitle, action }` — `icon` sempre o mesmo `@mui/icons-material` já usado pra rota em `src/components/Layout/menuStructure.js` (sub-páginas sem entrada própria herdam o ícone da página-mãe).
- **Não confundir com `SectionHeader`** (`src/components/shared/SectionHeader.js`) — esse é pra título de card/seção **interna**, não de página. `PageHeader` é sempre o primeiro elemento visível da página, direto dentro do container raiz.
- Migrado em 30 páginas (2026-08-11) — toda página nova deve usar `PageHeader` desde o início, não reinventar `<h1>` manual.

## Páginas que são código morto (achado durante a migração, não confundir com página esquecida)

Três arquivos existem no código mas **não são roteados em nenhum lugar de `App.js`** — não migrados, não fazem parte do padrão, e um usuário real nunca os vê:

| Arquivo | Situação |
|---|---|
| `src/pages/Transacoes/Transacoes.js` (+ `.css`) | A rota `/transacoes` em `App.js` é só `<Navigate to="/relatorio" replace />` — o componente nunca é importado/renderizado. |
| `src/pages/GerenciarImportacoes/GerenciarImportacoes.js` (+ `.css`) | Duplica `GerenciamentoImportacoesPage.js` (pasta `ImportacaoMassa/`), que é o que a rota `/importacao` realmente usa. |
| `src/pages/ImportacaoEmMassa/ImportacaoEmMassa.js` | Pasta com nome parecido a `ImportacaoMassa/` mas não referenciada em nenhum import nem rota. |

Task spawnada (chip pendente, não executada ainda) pra confirmar via grep e remover os 3 — ver "Pendências" abaixo.

## Pendências (para sessão futura)

Sinalizado pelo usuário em 2026-08-11: ele vai continuar com ajustes de layout em outra sessão. Itens em aberto:

1. **Confirmação visual do usuário ainda pendente** — build compilou sem erro a cada task (validado via reload + console do navegador), mas ninguém logou no app pra confirmar visualmente o resultado final das 30 páginas (a IA não pode digitar senha, mesmo autorizada — política de segurança). Roteiro de smoke test já foi passado ao usuário.
2. **`/admin` não verificado** — só é acessível com usuário de papel `admin`; não confirmado se o `PageHeader` renderiza corretamente lá.
3. **Remoção de código morto** — task spawnada (chip) pra remover `Transacoes.js`, `GerenciarImportacoes.js`, `ImportacaoEmMassa.js` após confirmar via grep que nada mais os referencia. Ainda não executada.
4. **Banner do "Como Utilizar" removido** — o usuário pode preferir recuperar o visual antigo (gradiente roxo) de alguma forma; decisão tomada unilateralmente durante a execução por incompatibilidade de cor de texto, vale confirmar se agradou.
5. Usuário mencionou "outros ajustes que serão necessários" sem detalhar ainda — provavelmente mais uma rodada de polimento visual depois de ver as 30 páginas rodando.
