---
type: design
status: approved
created: 2026-09-05
approved: 2026-09-05
tags: [settlement, recebimentos, fechamento, bug, pessoa]
related:
  - .brain/specs/2026-08-31-fechamento-design.md
  - .brain/decisions/2026-08-31-fechamento-modelagem.md
---

# Design Doc — Corrigir "pessoa" de um Recebimento (Settlement)

> Bug encontrado durante uso real do módulo Fechamento: "Linkar Recebimento" nunca encontrava
> nenhuma conciliação candidata, e a tela `/recebimentos/historico` sempre mostrava o próprio
> usuário como "a pessoa" do recebimento, nunca quem realmente pagou.

## 1. Contexto e causa raiz

Um `Settlement` (Recebimento) concilia uma transação `recebivel` (`receivingTransactionId` —
dinheiro que entrou, sempre com `pagamentos[].pessoa` = o próprio usuário) contra N transações
`gasto` pendentes (`appliedTransactions[]`, cada uma com um `pagamentoIndex` opcional apontando pra
qual fatia específica de `pagamentos[]` daquela transação foi quitada — **é aqui que mora o nome de
quem realmente devia**, ex: "Cleia").

Três pontos do código liam o lado errado (`receivingTransactionId.pagamentos`, sempre o próprio
usuário) em vez do lado certo (`appliedTransactions[].transactionId.pagamentos[pagamentoIndex]`):

1. `HistoricoRecebimentosPage.js` (`pessoaRecebimento()`) — mostrava o próprio usuário na coluna
   Pessoa.
2. `settlementService.listar()` (filtro `pessoa`) — restringia por `receivingTransactionId`, nunca
   achando nada quando filtrado por uma pessoa real.
3. `fechamentoService.linkarRecebimento()` — validação final também batia contra o lado errado,
   rejeitando 100% dos links.

Confirmado com dados reais (leitura via mongosh): a transação "Morifarma Osternack" tem 3
pagamentos (Alisson, Milena, Cleia); o Settlement que a quitou registra
`{ transactionId, pagamentoIndex: 2, amountApplied: 27 }` — exatamente a fatia da Cleia. A
informação correta já existe e está gravada certa; só não estava sendo lida do lugar certo.

**Achado colateral confirmado nos dados**: um mesmo Settlement pode conciliar dívidas de mais de
uma pessoa ao mesmo tempo (o exemplo acima mistura Cleia e Milena) — decisão validada: linkar ao
Fechamento de qualquer uma delas conta como válido (`.some()`), não exige que todas as
`appliedTransactions` sejam da mesma pessoa.

## 2. Correção

### 2.1 Função central `pessoasDoSettlement` (`settlementService.js`)

```js
function pessoasDoSettlement(settlement) {
  const nomes = new Set();
  for (const at of settlement.appliedTransactions || []) {
    const pagamentos = at.transactionId?.pagamentos || [];
    if (at.pagamentoIndex != null && pagamentos[at.pagamentoIndex]) {
      if (pagamentos[at.pagamentoIndex].pessoa) nomes.add(pagamentos[at.pagamentoIndex].pessoa);
    } else {
      pagamentos.forEach(p => { if (p.pessoa) nomes.add(p.pessoa); });
    }
  }
  return [...nomes];
}
```

Centraliza num único lugar a lógica de "quais pessoas estão por trás de um Settlement" — reaproveitada
pelos 3 pontos abaixo, em vez de recalculada 3 vezes de formas ligeiramente diferentes (foi assim que
o bug original nasceu).

- **Fallback sem `pagamentoIndex`** (settlements antigos criados via `appliedTransactionIds`, sem
  índice específico): considera todos os pagadores daquela transação. Pode incluir alguém a mais do
  que o real, mas é estritamente melhor que hoje (sempre "Alisson", nunca ninguém real) — sem
  regressão.
- **Settlement sem nome de pessoa em nenhum pagamento**: devolve `[]`, exibido como "-" (igual hoje).

### 2.2 Backend calcula, frontend só exibe

`settlementService.listar()` passa a:
- Popular `appliedTransactions.transactionId` incluindo `pagamentos` no select (hoje só
  `descricao valor data`).
- Filtrar `pessoa` restringindo por `match['appliedTransactions.transactionId'] = { $in: allowedIds }`
  (pré-filtro grosseiro por transação, não por índice exato — suficiente pra popular a lista de
  candidatos; a validação fina de índice já acontece à parte, no ponto 2.3).
- Anexar `pessoas: pessoasDoSettlement(s)` em cada item retornado.

`fechamentoService.linkarRecebimento()` passa a popular `appliedTransactions.transactionId` (com
`pagamentos`) em vez de `receivingTransactionId`, e validar
`pessoasDoSettlement(settlement).some(nome => nome.toLowerCase() === pessoaNome)`.

`HistoricoRecebimentosPage.js` (`pessoaRecebimento()`) passa a exibir `s.pessoas.join(', ')` (campo
já pronto vindo do backend) em vez de recalcular a partir de `receivingTransactionId`.

## 3. Não-objetivos

- Nenhuma migração de dado — o dado gravado (`appliedTransactions[].pagamentoIndex`,
  `Transacao.pagamentos[]`) já está correto; o bug era só na leitura.
- Nenhuma mudança de schema (`Settlement`, `Transacao`, `FechamentoInstancia` intocados).
- Nenhuma mudança na semântica de `pagamentos[].pessoa` em transações novas (fora de escopo desta
  rodada — ver limitação abaixo).

## 4. Limitação conhecida, fora de escopo

Ao criar uma transação nova (`NovaTransacaoForm`), o campo `Pessoa` sempre nasce preenchido com o
próprio usuário (`proprietarioPadrao`), inclusive para `tipo: 'recebivel'` — isso não muda com esta
correção. O fix aqui resolve a leitura de dados **já existentes e corretos** (o `pagamentoIndex` do
gasto quitado); não resolve a UX de entrada de dados para casos futuros onde essa ambiguidade
importe. Registrado aqui para uma eventual rodada futura, não tratado agora.

## 5. Verificação

- `npm test` no backend (`settlementService`/`fechamentoService` já têm suíte em `__tests__/`).
- Roteiro manual: `/recebimentos/historico` deve mostrar "Cleia"/"Milena" (não "Alisson") na coluna
  Pessoa; abrir uma instância de Fechamento da Cleia e confirmar que "Linkar Recebimento" agora lista
  e permite linkar o settlement correspondente.

## 6. Referências

- `.brain/decisions/2026-08-31-fechamento-modelagem.md` — casamento por nome com `Pessoa` (técnica
  reaproveitada aqui)
- `.brain/context/relatorios-recebimentos-infraestrutura.md` — infraestrutura de Settlement mapeada
  anteriormente
