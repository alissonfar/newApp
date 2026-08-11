---
type: playbook
status: active
created: 2026-08-11
tags: [procedimento, remocao, adicao, investigacao, importacao, transacao-importada]
related:
  - .brain/context/transacao-importada-pontos-acoplamento.md
  - .brain/decisions/2026-08-11-descricao-apelido-transacoes.md
---

# Como investigar campos cross-cutting em `Transacao` (adicionar OU remover)

> Atualizado em 2026-08-11 (2ª vez no mesmo dia): a lição original veio de **remover** um campo (conta conjunta). Na sessão de descricaoApelido, os mesmos pontos cegos se repetiram **adicionando** um campo — e apareceram 2 pontos de acoplamento novos que esta lista não cobria. Ver mapa completo e sempre atualizado em [`context/transacao-importada-pontos-acoplamento.md`](../context/transacao-importada-pontos-acoplamento.md) — este playbook é o procedimento, aquele arquivo é a lista viva dos pontos.

## Pré-requisitos

- Uma spec ou decisão já aprovada de adicionar, remover ou alterar o comportamento de um campo que aparece em `Transacao` (ou outra entidade central do domínio).

## Passos

1. Grep pelo nome do campo/módulo em **todo** `backend/src` e `controle-gastos-frontend/src`, não só nos arquivos "óbvios" (model + service + controller principais). Um campo em `Transacao` quase sempre tem um espelho em `TransacaoImportada` — o fluxo de importação (`upload → parse → revisão → finalizar`) mantém um schema paralelo que se sincroniza com o real só no momento da finalização.
2. Verifique explicitamente estes pontos de acoplamento típicos antes de declarar "mapeamento completo" — **confira cada um lendo o código, não assumindo pelo nome do arquivo**:
   - O model espelho em `transacaoImportada.js` (schema próprio, não referencia `transacao.js`).
   - O controller de revisão de importação (`transacaoImportadaController.js`) — costuma ter uma lista `camposPermitidos` que precisa ser atualizada.
   - **A materialização final tem DOIS caminhos independentes, não um:**
     - `TransacaoImportada.paraTransacao()` (método do model) — usado só por `transacaoImportadaController.js` no fluxo de **validação em massa** (`validarMultiplas`).
     - `ImportacaoController.finalizarImportacao` → função interna `montarTransacao()` — usado pelo botão real **"Finalizar Importação"**, o caminho que o usuário usa 99% do tempo. **Esta função NÃO chama `paraTransacao()` — ela duplica a lista de campos manualmente.** Corrigir só `paraTransacao()` dá falsa sensação de cobertura completa (foi exatamente o que aconteceu: o campo funcionava em teoria, mas a transação real nascia sem ele porque passava pelo caminho errado).
   - Qualquer lugar que edita a transação **depois** de já finalizada (ex: formulário genérico de edição) — ver ponto 6.
3. Depois disso, confira `app.js` pra rotas registradas que não apareceram no grep do model/service (ex: uma rota dedicada a uma sub-ação, como `/api/acertos` separada de `/api/vinculos-conjuntos` — ambas dependiam do mesmo `vinculoService`, mas viviam em arquivos de rota diferentes).
4. No frontend, além do form principal, confira:
   - **A tela real usada pela rota, não a que "parece" ser pelo nome/pasta.** Antes de editar um componente, confirme no roteador (`App.js`) qual componente realmente atende a rota. `ListaTransacoesImportadas.js` (pasta `RevisaoImportacao/`) parecia óbvio pelo nome, mas é código morto — a tela real de `/importacao/:id` é `DetalhesImportacaoPage.js`. Rode `grep` pelo nome do componente candidato em `App.js`/rotas antes de editá-lo; se não aparecer lá, é suspeito de estar morto ou de ser usado só em outro fluxo.
   - `Relatorio.js` (ou telas de relatório equivalentes) — **o frontend tem sua PRÓPRIA função `flattenTransactions`, duplicada e independente da `flattenTransactions` do backend (`reportEngine/ruleEngine.js`)**. Corrigir uma não corrige a outra. Isso vale tanto para a grade da tela quanto para a exportação "simples" (CSV/PDF) — o caminho de "template avançado" (`gerarRelatorioAvancado`) já usa o `ruleEngine.js` do backend, mas o caminho "simples" não.
   - A tela de revisão de importação — se ela exibe o campo em algum resumo/detalhe de linha.
   - `api.js` (ou o client HTTP equivalente) — confira o número real de funções exportadas relacionadas, não assuma que é só CRUD básico (o módulo de conta conjunta tinha 11 funções, não 5).
5. Depois de aplicar a mudança, rode um grep final pelo nome do campo/módulo (case-sensitive e variações) em `backend/src` e `controle-gastos-frontend/src` — pode sobrar comentário de docstring desatualizado ou parâmetro morto em função sem chamador (achado real: `installmentUtils.js` tinha um `@param` mencionando o campo já removido; `useTransacaoForm.js` tinha uma função com parâmetros do campo removido que não tinha nenhum chamador em todo o projeto).
6. **Novo (adicionando campo em `Transacao` que só faz sentido para transações importadas):** o formulário genérico de transação (`NovaTransacaoForm.js` + `useTransacaoForm.js` + `TabPrincipal.js`, reusado em 5 contextos) precisa saber "esta transação específica veio de importação?" pra decidir se edita o campo normal ou uma variante segura. **`transacao.importacao` só existe no objeto `TransacaoImportada` (pré-finalização)** — depois de finalizada, a `Transacao` real nunca teve esse campo, então qualquer flag `isImportada` calculado só a partir dele **é sempre `false` para transações já finalizadas**, mesmo que tenham vindo de importação. Sinal robusto alternativo: `transacao.deduplicationKey` (só o pipeline de importação atribui esse campo; criação manual nunca gera). Sempre teste a lógica condicional editando uma transação **já finalizada** a partir de `/relatorio` ou `/transacoes`, não só a partir da tela de revisão — são dois `transacao` com formatos de objeto diferentes chegando no mesmo form.
7. **Novo:** antes de assumir que uma função "builder" de payload (tipo `buildPayload()` de um hook) é o que realmente é enviado ao backend, confirme se o componente que faz o `fetch`/`PUT` de fato **chama** essa função — `NovaTransacaoForm.js` monta o payload de submit manualmente inline (`transacaoData = {...}`), sem nunca chamar o `buildPayload()` exportado pelo hook `useTransacaoForm.js`. Mudar só o hook não muda o que é enviado.

## Troubleshooting

- Se o grep final ainda encontrar ocorrências depois da mudança "completa", não assuma que é falso positivo sem ler o arquivo — no caso de conta conjunta, um grep amplo por `conjunto` (minúsculo) pegou `GroupIcon`/`menuStructure.js` que o grep por `Conjunto` (maiúsculo, específico) tinha perdido.
- Se um campo novo "funciona no teste manual da tela de revisão mas some depois de finalizar a importação": você corrigiu `paraTransacao()` mas não `montarTransacao()` (ou vice-versa) — ver ponto 2.
- Se um campo novo "funciona ao editar transação recém-importada mas não aparece/não persiste ao editar a mesma transação depois de já finalizada, a partir de outra tela": suspeite do flag `isImportada` calculado via `transacao.importacao` — ver ponto 6.
- Se a exibição funciona na listagem principal de transações mas não no relatório (ou vice-versa): são pipelines de dados diferentes — ver ponto 4 (`Relatorio.js` tem `flattenTransactions` próprio).
