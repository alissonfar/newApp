---
type: session
status: active
created: 2026-08-11
tags: [tags, categorias, lancamento, brainstorming, writing-plans, executing-plans, sessao]
related:
  - .brain/decisions/2026-08-11-mostrar-no-lancamento.md
  - .brain/context/tags-categorias.md
  - .brain/sessions/2026-08-11-tags-categorias-inativas-e-pagamentos-execucao.md
---

# Sessão: reduzir tags/categorias no lançamento (mostrarNoLancamento)

> Segunda demanda da mesma sessão de [tags/categorias inativas e pagamentos](2026-08-11-tags-categorias-inativas-e-pagamentos-execucao.md) — usuário sinalizou no fechamento daquela parte que a próxima demanda também envolveria tags/categorias.

## Objetivo

Usuário quer diminuir a quantidade de tags/categorias exibidas nas telas de **lançamento** de transação (ex: uma tag "Fatura Cartão Abril 2025" que nunca mais vai usar para lançar algo novo), sem perder dado e sem afetar os **filtros de relatório**, que precisam continuar mostrando tudo. Pedido explícito: "não tem uma regra clara de como fazer isso... me ajude a detalhar melhor e planejar."

## Investigação e mapeamento

Antes de brainstormar, mapeei onde tags/categorias são escolhidas hoje no frontend (grep por usos de `TagSelector.js` e pickers avulsos de `react-select`):

- **Lançamento** (usam `TagSelector.js`): `TabPagamentos.js` (form principal), `EditarTransacaoItem.js`, `ContaFixaFormModal.js`.
- **Filtro** (componente próprio, não usa `TagSelector.js`): `RelatorioFiltersPanel.js`.
- **Zona cinzenta, esclarecida com o usuário**: módulo de Recebimentos tem 2 pickers próprios (`TabConfiguracao.js`, `ConfiguracaoRecebimentosModal.js`) — usuário decidiu que conta como lançamento, porque a tag escolhida ali é aplicada a transações futuras na conciliação.
- Descartado do escopo depois de investigar: `TabResumo.js`/`TabSelecao.js` de Recebimentos só exibem tags já escolhidas (`TagBadge`, read-only) — não precisam de filtro.

## Decisões tomadas

Ver [ADR-022](../decisions/2026-08-11-mostrar-no-lancamento.md) para o detalhe completo. Resumo das perguntas de brainstorming e respostas (todas as recomendadas foram aceitas):

- Curadoria manual, sem automação por uso/idade.
- Existe em Tag **e** Categoria (ocultar categoria esconde o grupo inteiro).
- Recebimentos respeita a ocultação (comporta-se como lançamento).
- Editar uma transação com tag/categoria oculta preserva o que já estava lá, mas não permite adicionar outra oculta na mesma edição — sem escape hatch ("mostrar tudo") no seletor.

## Processo

- Tier 3 (`brainstorming` → spec em `docs/superpowers/specs/2026-08-11-mostrar-no-lancamento-design.md` → `writing-plans` → plano em `docs/superpowers/plans/2026-08-11-mostrar-no-lancamento.md`, 5 tasks D1-D5).
- Execução inline (`executing-plans`), direto na `main`, mesmo padrão da parte anterior da sessão — consentimento de trabalhar em `main` já dado no início da sessão, não precisou perguntar de novo.
- Mesma abordagem de verificação: sem TDD novo, sintaxe + reload do dev server já rodando no backend, bundle compilando sem erro no frontend (sem login possível), roteiro de teste manual passado ao usuário a cada checkpoint.

## Mudanças aplicadas (4 commits)

**`091fbcda`** — Task D1: `mostrarNoLancamento: Boolean, default: true` em `Tag`/`Categoria` (`backend/src/models/`), persistido em `criarTag`/`atualizarTag`/`criarCategoria`/`atualizarCategoria`. Sem migration.

**`e85d9960`** — Tasks D2+D3: `controle-gastos-frontend/src/utils/tagVisibility.js` (novo) com `filtrarCategoriasParaLancamento`/`filtrarTagsParaLancamento`; integrado em `TagSelector.js` — categoria oculta esconde o grupo inteiro, tag oculta some, mas qualquer item já selecionado no pagamento continua visível (derivado do próprio `paymentTags` recebido, sem prop nova).

**`c11e8239`** — Task D4: `TabConfiguracao.js` e `ConfiguracaoRecebimentosModal.js` filtram as opções de tag com a mesma regra (filtro direto, sem passar pelo utilitário compartilhado — essas telas não agrupam por categoria, então `filtrarTagsParaLancamento` não se aplicava tal como escrito).

**`fadda19d`** — Task D5 + bug extra: checkbox "Mostrar no lançamento de transações" em `TagManagement.js` (formulários de criar/editar Tag e Categoria, ao lado do "Mostrar no Dashboard" já existente). Incluído no mesmo commit, por pedido do usuário: fix de um bug de UX sem relação com a feature — o formulário "Adicionar Nova Tag/Categoria" ficava visível ao mesmo tempo que o formulário de edição, confundindo qual campo mexer. Agora "Adicionar" só aparece quando não há edição em andamento daquele tipo.

## Testes

- `npm test` no backend: **121/122 passam** — mesmo resultado da parte anterior da sessão. A 1 falha (`ledgerService.test.js`) é a mesma falha pré-existente e não relacionada, já investigada e documentada.
- Bundle do frontend verificado a cada task via reload forçado no dev server já em execução (outra sessão paralela rodando `npm start`/`npm run dev` nesta mesma pasta) — sempre sem erro de console/compile.
- Teste funcional real ainda pendente do usuário no navegador (roteiro passado na conversa, não documentado aqui por ser efêmero) — não confirmado nesta sessão que o teste manual foi executado antes do pedido de documentar o vault.

## Aprendizados

1. **Numeração de ADR colidiu com uma sessão paralela.** Escrevi o ADR desta feature como "ADR-021", mas outra sessão rodando ao mesmo tempo nesta pasta (edição de `descricaoApelido` em transações importadas) já tinha commitado seu próprio ADR-021 pouco antes. Renumerado para **ADR-022** ao notar o conflito no `git log`. Vale, daqui pra frente, checar `git log` (não só `.brain/decisions/` local) antes de cravar o número de um ADR novo quando há sinais de trabalho paralelo na mesma pasta — o vault não tem lock nem numeração automática.
2. **Zona cinzenta identificada por investigação, não por suposição.** A intuição inicial era que qualquer tela com um seletor de tag contava como "lançamento" — a leitura de `TabResumo.js`/`TabSelecao.js` de Recebimentos mostrou que elas só exibem (`TagBadge`, sem picker), então não precisavam de filtro. Evitou trabalho desnecessário em 2 arquivos que a suposição inicial teria incluído.
3. **O utilitário compartilhado não serviu 1:1 em todo lugar.** `filtrarTagsParaLancamento(tags, categoriasVisiveis, jaSelecionadas)` foi desenhado pensando em telas agrupadas por categoria (`TagSelector.js`). Nas telas de Recebimentos (sem conceito de categoria), reaproveitar a função exigiria um argumento artificial — decidido durante a escrita do plano (não na implementação) usar um filtro direto equivalente nesses 2 arquivos, documentado explicitamente no plano para não virar uma inconsistência de tipo/assinatura despercebida.

## Próximo passo

Nenhum pendente identificado nesta sessão para esta feature. Falta o usuário validar o fluxo completo no navegador (roteiro já passado) e decidir sobre push das 8 mudanças acumuladas nesta sessão (tags/categorias inativas + pagamentos + mostrarNoLancamento), já que tudo foi direto pra `main`.
