---
type: decision
status: active
created: 2026-08-11
tags: [tags, categorias, lancamento, relatorio, arquitetura]
related:
  - .brain/decisions/2026-08-11-tags-categorias-ciclo-ativo-inativo.md
  - .brain/context/tags-categorias.md
---

# ADR-022: `mostrarNoLancamento` — reduzir tags/categorias no lançamento sem afetar relatórios

## Contexto

O usuário acumula tags/categorias ao longo do tempo (ex: "Fatura Cartão Abril 2025") que nunca mais serão escolhidas para lançar uma transação nova, mas que ainda precisam aparecer nos filtros de relatório para consultar histórico. O ciclo ativo/inativo que já existe ([ADR-020](2026-08-11-tags-categorias-ciclo-ativo-inativo.md)) não serve para isso — `ativo:false` é soft-delete completo, esconde de tudo, inclusive relatórios.

## Opções consideradas

- **Reaproveitar `ativo`/inativo para isso:** rejeitada de cara — inativar para "esconder do lançamento" também sumiria dos filtros de relatório, quebrando o caso de uso principal (consultar histórico).
- **Automação por uso/idade (esconder sozinho o que não é usado há X meses):** rejeitada pelo usuário — sem regra clara de corte, arriscaria esconder algo que ele ainda queria ver, e ele preferiu previsibilidade a "mágica".
- **Novo campo booleano de curadoria manual, ortogonal ao `ativo` (escolhida):** `mostrarNoLancamento` (default `true`), com UI de toggle igual ao padrão já existente de `Tag.mostrarNoDashboard`.

## Decisão

- Campo `mostrarNoLancamento: Boolean, default: true` em **Tag e Categoria** (ocultar uma categoria esconde o grupo inteiro — categoria + todas as suas tags — do lançamento, mesmo que alguma tag individual esteja marcada como visível).
- **Recebimentos conta como lançamento:** a tag escolhida na configuração de conciliação (`TabConfiguracao.js`, `ConfiguracaoRecebimentosModal.js`) é aplicada a transações futuras — mesma lógica de "lançar algo novo" — então também respeita a ocultação.
- **Relatórios e telas somente-leitura não mudam:** `RelatorioFiltersPanel.js`, `TransactionCard.js`, abas read-only de Recebimentos continuam mostrando qualquer item ativo, independente de `mostrarNoLancamento`.
- **Edição preserva sem expandir:** ao editar uma transação que já usa uma tag/categoria oculta, ela continua pré-selecionada (nunca perde dado), mas o seletor não permite adicionar *outras* tags/categorias ocultas naquela edição — mesma lista reduzida do lançamento novo. Para usar uma tag oculta de novo, o caminho é reativar a visibilidade dela em `/tags`; não existe um escape hatch ("mostrar tudo") dentro do próprio seletor, por decisão deliberada de manter o escopo simples.
- **Filtragem é 100% frontend:** o backend só persiste o campo; os endpoints de listagem (`obterTodasTags`/`obterTodasCategorias`) continuam devolvendo tudo que é ativo, e cada tela decide o que exibir. Um utilitário puro compartilhado (`controle-gastos-frontend/src/utils/tagVisibility.js`) concentra a regra de filtro, reusado no `TagSelector.js` (form de transação, edição, conta fixa) e nos dois pickers avulsos de Recebimentos.

## Consequências

- Pró: resolve o caso de uso sem duplicar o ciclo ativo/inativo nem arriscar esconder dado de relatório.
- Pró: sem migration — Mongoose aplica o default `true` na leitura de documentos existentes sem o campo persistido.
- Contra: nenhuma automação — o usuário precisa lembrar de marcar manualmente cada tag/categoria antiga que não vai mais usar; se o volume de itens acumulados crescer muito, pode valer revisitar a opção de automação por uso/idade no futuro.
- Achado durante a execução, sem relação direta com a feature: o formulário "Adicionar Nova Tag/Categoria" em `TagManagement.js` ficava visível ao mesmo tempo que o formulário de edição, confundindo qual campo mexer — corrigido no mesmo commit por ser trivial e no mesmo arquivo (agora "Adicionar" só aparece quando não há edição em andamento daquele tipo).
