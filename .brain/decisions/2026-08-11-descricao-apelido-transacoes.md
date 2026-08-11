---
type: decision
status: active
created: 2026-08-11
tags: [transacao, descricao, importacao, duplicidade, inferencia-pessoa, ux]
related:
  - .brain/context/transacao-importada-pontos-acoplamento.md
  - .brain/playbooks/investigar-caminhos-paralelos-antes-de-remover-campo.md
---

# ADR-021: Apelido de descrição desacoplado do texto original (`descricaoApelido`)

## Contexto

Transações importadas (faturas de cartão, principalmente Mercado Livre) chegam com `descricao` genérica (`Mercadolivre*Ohmybag - Parcela 10/12`), sem indicação do que foi comprado. O usuário queria poder reescrever a descrição pra ficar legível em relatórios, sem quebrar dois mecanismos que dependem do texto cru de `descricao`:

1. **Deduplicação de importação** (`backend/src/services/importacaoService.js`): `deduplicationKey` é um SHA256 de `usuarioId | descricao_normalizada | valor | data | tipo | identificador [| installmentGroupId | installmentNumber]`. Há também matching fuzzy de "possível duplicata" por regex exata sobre `descricao`.
2. **Inferência de "provavelmente de X"** (`backend/src/services/inferenciaPessoaService.js`): identifica de qual participante da conta compartilhada é a transação, comparando `descricao` (sufixo de parcela removido) contra o histórico via regex exata.

Achado relevante da investigação inicial: o parser da fatura Nubank (`nubankFatura.js`, formato usado de fato pelo usuário) não interpreta `- Parcela X/Y` nem gera `installmentGroupId` — cada parcela é uma transação solta, sem vínculo de grupo entre meses. Um mecanismo de vínculo manual de parcelas ficou **fora de escopo** desta decisão (spec/plano futuro).

## Opções consideradas

- **A (escolhida) — Campo novo e desacoplado.** `descricaoApelido` opcional em `Transacao`/`TransacaoImportada`, nunca substitui `descricao`. Exibição usa `descricaoApelido || descricao`. Dedup e inferência de pessoa continuam lendo só `descricao`.
- **B — Trocar o papel dos campos.** Mover o texto cru pra um novo `descricaoOriginal`, deixar `descricao` livremente editável, redirecionar dedup/inferência pra `descricaoOriginal`. Rejeitada: exige migração de dados em transações existentes e aumenta risco de regressão em dois subsistemas sensíveis que já funcionavam.
- **C — Nota/anotação secundária exibida ao lado do original.** Rejeitada: o usuário definiu explicitamente que o apelido deve **substituir** a descrição na exibição principal (com o original secundário, colapsável), não ficar lado a lado.

## Decisão

Opção A. Ver spec completa em [`docs/superpowers/specs/2026-08-11-descricao-apelido-transacoes-design.md`](../../docs/superpowers/specs/2026-08-11-descricao-apelido-transacoes-design.md) e plano em [`docs/superpowers/plans/2026-08-11-descricao-apelido-transacoes.md`](../../docs/superpowers/plans/2026-08-11-descricao-apelido-transacoes.md).

## Consequências

- **Pró:** dedup e inferência de pessoa continuam funcionando exatamente como antes — nenhuma linha das funções críticas foi tocada, só um campo novo passageiro no payload.
- **Pró:** sem migração/backfill — transações existentes ficam com `descricaoApelido: null`, caem no fallback pro texto original.
- **Contra (descoberto só em teste manual, não na spec original):** o campo teve que ser propagado manualmente em **muito mais pontos** do que o plano previu inicialmente, porque `Transacao`/`TransacaoImportada` têm múltiplos caminhos paralelos e duplicados que não aparecem só lendo o model/service principal. Ver [`context/transacao-importada-pontos-acoplamento.md`](../context/transacao-importada-pontos-acoplamento.md) pro mapa completo — esse arquivo nasceu diretamente dessa lacuna.
- **Contra:** o flag `isImportada` do formulário genérico de transação (`useTransacaoForm.js`) tinha um bug pré-existente (não introduzido por esta mudança, mas exposto por ela): dependia de `transacao.importacao`, campo que só existe em `TransacaoImportada`, nunca em `Transacao` já finalizada. Corrigido nesta mesma sessão trocando pra `transacao.importacao || transacao.deduplicationKey`.

## Linha do tempo real de descoberta de bugs (relevante pra calibrar expectativa em features futuras deste tipo)

A spec e o plano cobriram corretamente os pontos "óbvios" (models, endpoints de edição, dedup/inferência intocados, exibição na maioria das telas). Mas precisou de **3 rodadas de teste manual pelo usuário**, cada uma revelando um bug novo:

1. **Rodada 1:** apelido editado na revisão não aparecia na mesma tela. Causa: o componente editado (`ListaTransacoesImportadas.js`) era código morto — a tela real (`DetalhesImportacaoPage.js`) nunca foi tocada. Bug composto: o form genérico (`NovaTransacaoForm.js`) montava o payload de submit manualmente, sem usar o `buildPayload()` do hook já corrigido, e ainda enviava `descricao` (que o backend não aceitava mais nesse endpoint) — edição descartada silenciosamente.
2. **Rodada 2:** apelido salvava e exibia certo na revisão, mas a transação finalizada nascia com a descrição original. Causa: `ImportacaoController.finalizarImportacao` tem uma função interna `montarTransacao()` **completamente independente** de `TransacaoImportada.paraTransacao()` (que tinha sido corrigido) — o botão real de "Finalizar Importação" passa por `montarTransacao()`, não por `paraTransacao()`.
3. **Rodada 3:** apelido funcionava na finalização e na listagem, mas o grid de `/relatorio` e a exportação mostravam o texto original; o tooltip de "descrição original" não aparecia ao editar a partir do relatório. Causas compostas: (a) `Relatorio.js` tem seu próprio `flattenTransactions` no frontend, duplicado e desconectado do `ruleEngine.js` do backend já corrigido; (b) `isImportada` (ponto acima) sempre `false` pra transações já finalizadas, então nem o payload nem a UI condicional funcionavam ao editar por `/relatorio`.

**Lição prática:** para qualquer mudança futura em campo de `Transacao`/`TransacaoImportada`, tratar a spec inicial como ponto de partida, não como cobertura completa — usar o playbook e o mapa de acoplamento linkados acima **antes** de declarar a implementação pronta, e testar manualmente editando a mesma transação a partir de pelo menos 3 telas diferentes (revisão de importação, `/transacoes`, `/relatorio`) e em pelo menos 2 estados (pré e pós-finalização).
