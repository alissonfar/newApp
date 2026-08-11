---
type: context
status: active
created: 2026-08-11
tags: [transacao, transacao-importada, importacao, arquitetura, regras-de-negocio]
related:
  - .brain/playbooks/investigar-caminhos-paralelos-antes-de-remover-campo.md
  - .brain/decisions/2026-08-11-descricao-apelido-transacoes.md
---

# Transacao ⟷ TransacaoImportada — mapa de pontos de acoplamento

> Lista viva. Toda vez que mexer em um campo de `Transacao` que também precisa existir/funcionar em transações vindas de importação, confira **cada um** destes pontos — eles não se atualizam sozinhos entre si, cada um é uma cópia manual independente do campo.

## Por que isso existe

`Transacao` (`backend/src/models/transacao.js`) e `TransacaoImportada` (`backend/src/models/transacaoImportada.js`) são **schemas Mongoose independentes**, sem herança nem referência um ao outro. O fluxo de importação em massa (`upload → parse → revisão → finalizar`) vive inteiramente em `TransacaoImportada` até o momento de "Finalizar Importação", quando os dados são copiados manualmente para uma `Transacao` real. Essa cópia **não é automática nem centralizada** — existem múltiplos pontos de cópia/leitura que precisam ser mantidos em sincronia manualmente.

## Pontos de acoplamento (backend)

| # | Ponto | Arquivo | O que faz |
|---|---|---|---|
| 1 | Model real | `backend/src/models/transacao.js` | Schema da transação de verdade. |
| 2 | Model espelho | `backend/src/models/transacaoImportada.js` | Schema paralelo, campos duplicados manualmente. |
| 3 | Campos editáveis na revisão | `backend/src/controllers/transacaoImportadaController.js` (`atualizarTransacao`, array `camposPermitidos`) | Lista explícita de quais campos o usuário pode editar **antes** de finalizar. Campo novo em `TransacaoImportada` não fica editável a menos que entre nessa lista. |
| 4 | Materialização — caminho A | `TransacaoImportada.paraTransacao()` (método do model, `transacaoImportada.js`) | Usado **só** por `transacaoImportadaController.js` → `validarMultiplas` (ação de validação em massa). |
| 5 | Materialização — caminho B (**o que importa de verdade**) | `backend/src/controllers/importacaoController.js` → `finalizarImportacao` → função interna `montarTransacao()` | Usado pelo botão real **"Finalizar Importação"**. **Independente do caminho A** — duplica a lista de campos copiados, na mão, dentro da própria função. Esquecer de atualizar este ponto é o erro mais fácil de cometer: o campo "funciona" na revisão (que só grava em `TransacaoImportada`) mas desaparece assim que a importação é finalizada. |
| 6 | Edição pós-finalização | `backend/src/controllers/controladorTransacao.js` → `atualizarTransacao` (rota `PUT /api/transacoes/:id`) | Único endpoint que edita a `Transacao` já materializada. Usado tanto por transações manuais quanto por transações importadas — qualquer regra "isso só vale pra transação importada" precisa ser condicional aqui, não assumida. |
| 7 | Duplicidade | `backend/src/services/importacaoService.js` (`gerarDeduplicationKey`, `classificarTransacoes`, `buscarPossivelDuplicata`) | Compara **só** `descricao` (texto cru). Qualquer campo novo que mude o texto/formato de `descricao` quebra dedup — por isso o campo `descricaoApelido` foi desenhado desacoplado, nunca lido por essas funções. |
| 8 | Inferência de pessoa | `backend/src/services/inferenciaPessoaService.js` | Também compara **só** `descricao` (regex, sufixo de parcela removido). Mesma regra: nunca ler campos de exibição/apelido aqui. |
| 9 | Relatório server-side | `backend/src/reportEngine/ruleEngine.js` (`flattenTransactions`) + `backend/src/reportEngine/filterService.js` (busca) | Usado pelo caminho de "template avançado" de relatório (`gerarRelatorioAvancado` / `controladorRelatorioAvancado.js`). |
| 10 | Busca na listagem principal | `backend/src/controllers/controladorTransacao.js` (`buildMatchStage`, filtro `search`) | Separado do ponto 9 — mesma lógica, arquivo diferente. |

## Pontos de acoplamento (frontend)

| # | Ponto | Arquivo | O que faz |
|---|---|---|---|
| 11 | Tela real de revisão | `controle-gastos-frontend/src/pages/ImportacaoMassa/DetalhesImportacaoPage.js` | **Esta é a tela que atende `/importacao/:id`** (confirmar sempre em `App.js`). Tem sua própria tabela inline e seu próprio `handleEditarTransacao` (mapeia `TransacaoImportada` → formato esperado pelo form genérico). |
| 12 | Componente morto (armadilha) | `controle-gastos-frontend/src/components/ImportacaoMassa/RevisaoImportacao/ListaTransacoesImportadas.js` | **Não é usado em nenhuma rota.** Parece o componente certo pelo nome/pasta, mas é código órfão. Sempre confirmar com grep em `App.js` antes de editar um componente candidato. |
| 13 | Form genérico de transação | `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js` + `hooks/useTransacaoForm.js` + `components/Transaction/TabPrincipal.js` | Reusado em 5 contextos (nova transação manual, edição via Transações, via Relatórios, via revisão de importação, etc). `NovaTransacaoForm.js` monta o payload de submit **manualmente inline**, não chama o `buildPayload()` exportado pelo hook — cuidado ao mudar um sem checar o outro. |
| 14 | Detecção "esta transação veio de importação" | `useTransacaoForm.js` (`isImportada`) | **Armadilha principal desta área.** `transacao.importacao` só existe no objeto `TransacaoImportada` (pré-finalização). Uma `Transacao` real (pós-finalização) nunca tem esse campo. Sinal robusto: `transacao.deduplicationKey` (só atribuído por transações que passaram pelo pipeline de importação — criação manual nunca gera). Testar sempre nos dois contextos: editando via revisão (`TransacaoImportada`) E editando via `/relatorio`/`/transacoes` (Transacao real já finalizada). |
| 15 | Modal de sugestão de pessoa | `controle-gastos-frontend/src/components/ImportacaoMassa/DetalhesImportacao/ModalSugestaoPessoa.js` | Mostra `transacao` (a que está sendo revisada) e `transacao.pessoaSugeridaSample` (evidência histórica) — os dois têm campos de descrição independentes. |
| 16 | Modal de possível duplicata | `controle-gastos-frontend/src/components/ImportacaoMassa/DetalhesImportacao/ModalPossivelDuplicata.js` | Mostra `transacao` (nova) e `sem`/`transacao.transacaoSemelhante*` (a existente parecida) lado a lado. |
| 17 | Relatório client-side (**duplicado do backend**) | `controle-gastos-frontend/src/pages/Relatorio/Relatorio.js` (função local `flattenTransactions`, linhas ~43-96) | **Independente da `flattenTransactions` do backend (ponto 9).** Alimenta tanto a grade da tela quanto a exportação "simples" (CSV/PDF) — `obterTransacoesExport`. O caminho de "template avançado" (`gerarRelatorioAvancado`) usa o backend; o caminho "simples" usa esta função local. Corrigir uma não corrige a outra. |
| 18 | Listagem principal / dashboard | `controle-gastos-frontend/src/components/Transaction/TransactionCard.js`, `pages/Home/Home.js` | Pontos de exibição diretos, cada um lê `transacao.descricao`/campos equivalentes independentemente. |
| 19 | PDF de transações | `controle-gastos-frontend/src/components/PDF/TransactionsTable.js` | Outro ponto de exibição separado (usado fora do fluxo `Relatorio.js`, ex: exportação avulsa da tela de Transações). |

## Regra prática

Antes de considerar um campo "propagado por completo": rode o checklist do playbook [`investigar-caminhos-paralelos-antes-de-remover-campo.md`](../playbooks/investigar-caminhos-paralelos-antes-de-remover-campo.md) e confira contra esta tabela — se algum ponto não foi tocado nem descartado conscientemente, não está completo.

## Caso real que gerou este mapa

[ADR — descricaoApelido](../decisions/2026-08-11-descricao-apelido-transacoes.md): a spec e o plano originais cobriam os pontos 1-4, 7, 8. Só apareceram os pontos 5, 6, 11, 12, 13, 14 e 17 durante 3 rodadas de teste manual pelo usuário — cada rodada revelou um ponto de acoplamento novo que nem a investigação inicial (agentes Explore dedicados) nem o plano escrito tinham coberto.
