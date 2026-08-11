---
type: session
status: active
created: 2026-08-11
tags: [tags, categorias, pagamentos, duplicidade, brainstorming, writing-plans, executing-plans, sessao]
related:
  - .brain/decisions/2026-08-11-tags-categorias-ciclo-ativo-inativo.md
  - .brain/context/tags-categorias.md
---

# Sessão: tags/categorias inativas, replicação de tags no rateio, bug de duplicidade

## Objetivo

Três correções pedidas no início da sessão:

1. Tags/categorias inativas continuavam visíveis/sem forma de reativar — precisava de exclusão condicional (hard delete só sem vínculo) e uma tela dedicada de reativação.
2. "Rateio igual" / "Dividir em" não replicavam as tags do pagamento principal para os demais pagamentos.
3. Alerta de "possível duplicidade" no formulário de transação mostrando contagens absurdas (ex: 800) — item que o usuário pediu para só registrar no plano, sem investigar a fundo.

## Investigação inicial

Três agentes Explore em paralelo levantaram o estado real de cada item antes de qualquer decisão:

- **Tags/categorias**: achado teve uma surpresa — o problema real não era "inativas aparecem" (isso já funcionava certo para Categoria, com badge). O problema era a **assimetria**: Tag tinha soft-delete mas nenhuma rota para reativar (`ativarTag`/`inativarTag` não existiam), então uma tag excluída ficava presa inativa para sempre. Nenhuma das duas entidades verificava vínculo antes de agir (único precedente no sistema: `Pessoa`, que bloqueia mas não faz hard-delete condicional).
- **Divisão de pagamentos**: `splitEqually`/`splitInto` (`usePagamentos.js`) de fato nunca tocavam em `paymentTags` dos pagamentos 2..N — confirmado como bug real. O padrão de merge aditivo já existia no backend (`mergeTagsPadrao`, usado na importação em massa para aplicar `tagSugerida` a todos os pagamentos).
- **Bug de duplicidade**: não era um caso vago — causa raiz encontrada de cara. `useDuplicateCheck.js` chamava `obterTransacoes` sem `page`; o backend (`controladorTransacao.js`) só respeita `search`/`dataInicio`/`dataFim`/`limit` no branch paginado — sem `page`, cai num branch legado que ignora esses filtros e devolve todas as transações ativas do usuário. Como a causa era simples e isolada, o usuário decidiu resolver na mesma sessão em vez de só documentar.

## Decisões tomadas

Ver [ADR-020](../decisions/2026-08-11-tags-categorias-ciclo-ativo-inativo.md) para o detalhe completo da decisão de exclusão condicional + cascata. Resumo das decisões validadas com o usuário ao longo da sessão:

- Hard delete só quando não há **nenhum** vínculo; com vínculo, soft-delete (como já era).
- Categoria passa a seguir o mesmo padrão de Tag (antes só inativava, nunca excluía de fato).
- Tela `/tags/inativos` única, com abas (não duas rotas separadas).
- "Rateio igual"/"Dividir em" replicam tags de forma **aditiva** (nunca sobrescreve tag distribuída manualmente) — decisão explícita do usuário, diferente da minha sugestão inicial de "sempre sobrescreve".
- **Redirecionamento no meio da execução**: depois de ver a Fase A funcionando, o usuário pediu que a tela principal `/tags` parasse de mostrar itens inativos por completo (o design original, já aprovado, ainda mostrava badge + botão Ativar na tela principal para paridade com o comportamento pré-existente de Categoria — o usuário decidiu que isso também estava errado). Removido o badge/toggle da tela principal; só ativos aparecem lá agora.
- **Cascata categoria↔tags** (não estava na spec original, surgiu de uma pergunta do usuário durante a revisão visual): inativar categoria cascateia para as tags dela; ativar categoria também cascateia (reativação simétrica); ativar tag de categoria inativa é bloqueado. Efeito colateral aceito conscientemente: a cascata de reativação não distingue tag-inativada-pela-cascata de tag-já-inativa-antes.
- **Accordion para categorias inativas** (pedido também no meio da execução): tela `/tags/inativos` evoluiu para mostrar, por tag, a categoria a que pertence (chip com ícone/cor), e por categoria, todas as tags dela (`Accordion` do MUI, mesmo componente já usado em `HistoricoRecebimentosPage.js`).

## Processo

- **Tier 3** para tags/categorias (`brainstorming` completo → spec em `docs/superpowers/specs/2026-08-11-tags-categorias-inativas-design.md` → `writing-plans`).
- **Tier 2** para divisão de pagamentos e **Tier 1** para o bug de duplicidade, incluídos no mesmo plano (`docs/superpowers/plans/2026-08-11-tags-categorias-pagamentos-fixes.md`).
- Execução inline (`executing-plans`), direto na `main`, com aprovação explícita do usuário antes de trabalhar direto nela (sem branch de feature).
- Sem TDD/testes novos por padrão do projeto (cobertura automatizada pequena, não é prioridade) — verificação backend via inspeção de sintaxe + reload do dev server já rodando; verificação frontend via bundle compilando sem erro (não consegui logar no app por política de segurança — nunca digito senha, mesmo autorizado), com roteiro de teste manual passado ao usuário a cada checkpoint.

## Mudanças aplicadas (4 commits)

**`89317f99`** — backend, Fase A (Tasks A1-A3):
- `backend/src/services/vinculoTagCategoriaService.js` (novo) — `tagEstaVinculada`/`categoriaEstaVinculada` via aggregation com `$objectToArray` sobre `pagamentos.tags`.
- `controladorTag.js`/`controladorCategoria.js` — hard delete condicional em `excluirTag`/`excluirCategoria`.
- `controladorTag.js` — novos `ativarTag`/`inativarTag`; `obterTodasTags` aceita `incluirInativas`; `obterTagPorId`/`atualizarTag` não exigem mais `ativo:true`.
- `rotasTag.js` — rotas `PUT /:id/ativar` e `/:id/inativar`.

**`f36e7536`** — frontend, Fase A (Tasks A4-A6) + ajustes pedidos durante a revisão visual:
- `api.js` — `obterTags(incluirInativas)`, `ativarTag`, `inativarTag`.
- `App.js` — rota `/tags/inativos`.
- `pages/TagsInativos/` (novo) — abas Tags/Categorias inativas; categorias em `Accordion` mostrando tags vinculadas; tags mostrando chip da categoria.
- `TagManagement.js`/`.css` — tela principal só mostra ativos (sem badge/toggle de inativo); mensagens de exclusão distinguem hard-delete de soft-delete.
- `controladorCategoria.js`/`controladorTag.js` — cascata categoria↔tags (ativar/inativar) e bloqueio de ativar tag órfã.
- Fix: `TagsInativos.js` não chamava `refreshData()` do `DataContext` global — tela `/tags` ficava com dado velho até reload manual.

**`6e1d2412`** — `usePagamentos.js`: `splitEqually` e `splitInto` replicam tags do pagamento principal para os demais de forma aditiva (`mergeTagsAditivo`, mesmo padrão de `mergeTagsPadrao` no backend).

**`82625393`** — `useDuplicateCheck.js`: troca `obterTransacoes` por `obterTransacoesPaginadas` para respeitar `search`/`dataInicio`/`dataFim`/`limit`.

## Testes

- `npm test` no backend: **121/122 passam**. A 1 falha (`ledgerService.test.js`, `calcularSaldoPorLedger`) é **pré-existente e não relacionada** — investigada e confirmada: o arquivo de teste não estabelece nenhuma conexão Mongoose (não há `jest.config.js`/setup file, e o único `mongoose.connect()` do projeto está em `app.js`, nunca importado pelo teste), então a query trava em "buffering timed out" independente de qualquer mudança nesta sessão. Não faz parte de `ledgerService`/`netWorthService` tocados por este trabalho.
- Bundle do frontend verificado a cada task via reload forçado no dev server já em execução (outra sessão paralela estava rodando `npm start`/`npm run dev` nesta mesma pasta) — sempre sem erro de console/compile.
- Teste funcional real feito pelo usuário no navegador, a cada checkpoint, seguindo roteiros passados na conversa (não documentados aqui por serem efêmeros).

## Aprendizados

1. **A investigação inicial mudou o diagnóstico do próprio usuário.** O pedido original ("inativas continuam aparecendo") descrevia melhor o sintoma de Categoria (que já tinha badge) do que o de Tag (que sumia para sempre, sem reativação). Vale sempre investigar antes de aceitar a causa raiz como o usuário a descreveu — nesse caso a investigação revelou um bug diferente e mais específico do que o relato inicial sugeria.
2. **Design aprovado em brainstorming pode não sobreviver ao contato com a tela real.** A spec previa badge+toggle na tela principal para dar paridade a Tag com o comportamento pré-existente de Categoria — só ao ver o resultado renderizado o usuário percebeu que esse comportamento pré-existente (mostrar inativos com badge) também era o problema, não o padrão a seguir. Vale timebox curto entre "aprovar o design" e "mostrar rodando" para pegar isso cedo.
3. **Perguntas do usuário no meio da execução às vezes são a spec revelando lacunas, não scope creep.** A pergunta sobre cascata categoria→tags não estava prevista, mas é uma consequência lógica direta da regra de negócio já decidida (não devia existir tag ativa sob categoria inativa) — vale tratar como extensão natural do ADR, não como feature nova a ser negociada à parte.
4. Reforça o aprendizado já registrado na sessão de Conta Conjunta: **toda tela que muta dado espelhado em contexto global precisa chamar o refresh do contexto**, não só atualizar seu próprio estado local — o mesmo tipo de bug (dado desatualizado ao navegar) já tinha aparecido antes em outro módulo.

## Próximo passo

Usuário sinalizou que a próxima demanda da sessão também envolve tags/categorias — a definir na sequência da conversa.
