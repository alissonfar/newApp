---
type: playbook
status: active
created: 2026-08-11
tags: [procedimento, remocao, investigacao, importacao]
---

# Como investigar a remoção de um campo/módulo cross-cutting

## Pré-requisitos

- Uma spec ou decisão já aprovada de remover um campo/módulo que aparece em `Transacao` (ou outra entidade central do domínio).

## Passos

1. Grep pelo nome do campo/módulo em **todo** `backend/src` e `controle-gastos-frontend/src`, não só nos arquivos "óbvios" (model + service + controller principais). Um campo em `Transacao` quase sempre tem um espelho em `TransacaoImportada` — o fluxo de importação (`upload → parse → revisão → finalizar`) mantém um schema paralelo que se sincroniza com o real só no momento da finalização.
2. Verifique explicitamente estes 3 pontos de acoplamento típicos antes de declarar "ponto de acoplamento único":
   - O model espelho em `transacaoImportada.js` (schema próprio, não referencia `transacao.js`).
   - O controller de revisão de importação (`transacaoImportadaController.js`) — costuma ter uma lista `camposPermitidos` que precisa ser atualizada.
   - O controller de finalização (`importacaoController.js`) — costuma ter um bloco que copia/transforma o campo de `TransacaoImportada` pra `Transacao` real.
3. Depois disso, confira `app.js` pra rotas registradas que não apareceram no grep do model/service (ex: uma rota dedicada a uma sub-ação, como `/api/acertos` separada de `/api/vinculos-conjuntos` — ambas dependiam do mesmo `vinculoService`, mas viviam em arquivos de rota diferentes).
4. No frontend, além do form principal, confira:
   - `Relatorio.js` (ou telas de relatório equivalentes) — funções de "achatamento" de transação (`flattenTransactions`) costumam espalhar campos derivados em cada linha exibida/exportada.
   - A tela de revisão de importação — se ela exibe o campo em algum resumo/detalhe de linha.
   - `api.js` (ou o client HTTP equivalente) — confira o número real de funções exportadas relacionadas, não assuma que é só CRUD básico (o módulo de conta conjunta tinha 11 funções, não 5).
5. Depois de aplicar a remoção, rode um grep final pelo nome do campo/módulo (case-sensitive e variações) em `backend/src` e `controle-gastos-frontend/src` — pode sobrar comentário de docstring desatualizado ou parâmetro morto em função sem chamador (achado real: `installmentUtils.js` tinha um `@param` mencionando o campo já removido; `useTransacaoForm.js` tinha uma função com parâmetros do campo removido que não tinha nenhum chamador em todo o projeto).

## Troubleshooting

- Se o grep final ainda encontrar ocorrências depois da remoção "completa", não assuma que é falso positivo sem ler o arquivo — no caso de conta conjunta, um grep amplo por `conjunto` (minúsculo) pegou `GroupIcon`/`menuStructure.js` que o grep por `Conjunto` (maiúsculo, específico) tinha perdido.
