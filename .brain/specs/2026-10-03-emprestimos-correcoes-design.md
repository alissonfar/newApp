---
type: design
status: draft
created: 2026-10-03
tags: [emprestimos, bugfix, juros-auto, cancelamento, total-esperado, tipo-retorno, ux]
related: [2026-06-30-emprestimo-bug-juros-auto-e-processo-desfazer-design.md, 2026-06-25-emprestimo-dois-caminhos.md, 2026-06-24-valor-esperado-por-transacao.md]
---

# Design — Correções do módulo de Empréstimos (achados da bateria QA de 2026-10-03)

> Origem: bateria de simulações end-to-end via `playwright-cli` no ambiente dev (docker),
> documentada no relatório da sessão. 5 achados: F1 (bug crítico), F2/F3/F4 (produto/UX),
> F5 (desvio de spec confirmado pelo Alisson).

## Contexto

A investigação do fluxo de empréstimo (criação → desembolso → recebimento → quitação →
reversão → cancelamento) reproduziu 11 cenários. Cinco pontos precisam de correção:

| ID | Achado | Tipo | Evidência |
|----|--------|------|-----------|
| F1 | Empréstimo quita **sem gerar a TX de juros auto** quando o vínculo é **pagamento-level** | Bug de cálculo | `QA Empr E`: `status=quitado`, `jurosAutoCount=0`, lucro 52,50 perdido |
| F2 | Cancelar empréstimo com lançamentos deixa o **gasto sumido do relatório** | Produto | `QA Empr G`: `status=cancelado`, desembolso com `valor=0` na API |
| F3 | Card "Valor esperado" (1.600) ≠ total da tabela (2.200) | Cálculo/consistência | `QA Empr H`: TX multi-pagamento com 600 por pagamento |
| F4 | "Reverter quitação" não reverte (rótulo enganoso) | UX/copy | botão no-op: `status=quitado` antes e depois |
| F5 | `tipoRetorno` não tem peso no cálculo | Desvio de spec | `QA Empr G` "Sem juros" exibiu Lucro esperado R$ 100 |

## O que o vault já decide (não re-litigado)

- **ADR-014** — `valorEsperadoRetorno` mora na Transação/Pagamento, não no Empréstimo.
- **ADR-015** — 2 caminhos coexistem (TX-level legado + pagamento-level novo), com exclusividade mútua.
- **Design 2026-06-30 (draft)** — a feature "Reverter quitação" foi desenhada **de propósito** como
  *deletar + recalcular/recriar* a TX de juros ("no-op visualmente"). Portanto **F4 não é bug de
  comportamento — é rótulo/comunicação**. E o "cancelamento com limpeza de TXs" foi declarado
  **não-objetivo** ("soft cancel"); **F2 reverte essa decisão**, por escolha do Alisson nesta sessão.
- O `totalEsperadoC2` "1× por TX" (com `$first`) foi decisão consciente do design 2026-06-30; **F3 a
  revisa** (a tabela passa a ser a fonte de verdade).

## Decisões aprovadas (forks desta sessão)

1. **F2** — bloquear cancelamento enquanto houver lançamentos vinculados (nada de TX órfã escondida).
2. **F3** — a **tabela** está certa: somar `valorEsperadoRetorno` **por pagamento vinculado**.
3. **F5** — "Sem juros" **trava o esperado = desembolso** (lucro sempre 0); "Valor fixo" mantém o esperado digitado.
4. **F4** — renomear a ação para **"Recalcular juros do empréstimo"** (mantém o comportamento de recálculo).
5. **Escopo** — um único plano, **F1 primeiro e isolado**, depois F2–F5 agrupados por arquivo.

---

## F1 — Juros auto no caminho pagamento-level (bug crítico)

### Causa raiz
`buscarSnapshotUltimoRecebimento(emprestimoId)` em `backend/src/utils/emprestimoQuitacao.js:36-44`
busca o último recebível apenas por `emprestimoId` **no nível da Transação**. Num empréstimo cujo
único recebimento está em `pagamentos[].emprestimoId`, a query retorna vazio → `recalcularJurosAuto`
devolve `{acao:'nenhuma'}` e **nenhuma TX "Lucro" é criada** (empréstimo fica `quitado` sem receita).

### Correção
1. `buscarSnapshotUltimoRecebimento` passa a considerar os dois caminhos:
   ```js
   const recebiveis = await Transacao.find({
     tipo: 'recebivel',
     status: 'ativo',
     emprestimoEhJurosAuto: { $ne: true },
     $or: [
       { emprestimoId },
       { 'pagamentos.emprestimoId': emprestimoId }
     ]
   }).sort({ data: -1 }).lean();
   ```
2. Ao montar a nova TX de juros (`recalcularJurosAuto`, `emprestimoQuitacao.js:104-131`), derivar
   `pessoa` e `tags` do **pagamento efetivamente vinculado** ao empréstimo (caminho 2), caindo para
   `pagamentos[0]` no caminho 1. `categoria`/`categoriaNome` continuam vindo da TX snapshot.
3. `montarObservacao` inalterado (já usa `calcularTotaisRecebEDisbursed`, que enxerga os 2 caminhos).

### Verificação
- Novo teste unitário em `emprestimoQuitacao.test.js`: `recalcularJurosAuto` **cria** a TX de juros em
  cenário 100% pagamento-level, com `valor = lucro realizado` e `pessoa` do pagamento vinculado.
- Novo teste de integração em `emprestimoService.test.js`: `recalcularStatus` transiciona para
  `quitado` **e** cria a TX auto num empréstimo só-pagamento-level.
- E2E: repetir o cenário F (`QA Empr E`): após receber, deve existir a linha "Lucro - …" com o valor
  correto.

---

## F3 — `totalEsperado` somar por pagamento (consistência com a tabela)

### Causa raiz
`_agregarTotaisEmprestimo` (`backend/src/services/emprestimoService.js:112-141`) agrupa o esperado do
caminho 2 **1× por TX** (`$group:{_id:'$_id', valorEsperado:{$first:...}}`), enquanto a tabela de
Movimentações soma 1× por pagamento. Resultado: card 1.600 vs tabela 2.200.

### Correção
Remover o agrupamento por TX e somar cada pagamento vinculado:
```js
const esperadoPagamentoAgg = await Transacao.aggregate([
  { $match: { usuario: usuarioObjId, status: 'ativo', tipo: 'gasto',
              'pagamentos.emprestimoId': objectId, emprestimoId: { $ne: objectId } } },
  { $unwind: '$pagamentos' },
  { $match: { 'pagamentos.emprestimoId': objectId,
              'pagamentos.valorEsperadoRetorno': { $ne: null, $gt: 0 } } },
  { $group: { _id: null, total: { $sum: '$pagamentos.valorEsperadoRetorno' } } }
]);
```
Nenhuma mudança de frontend (a tabela já era a referência correta).

### Verificação
- Atualizar/adicionar teste em `emprestimoService.test.js`: empréstimo com TX multi-pagamento (2 pagamentos
  vinculados, esperados 600 e 600) → `totalEsperado` inclui **1.200**, não 600.
- E2E: repetir o cenário H — card e tabela devem bater.

### Efeito colateral conhecido
`totalEsperado` de empréstimos com vários pagamentos na mesma TX **aumenta**. Como a quitação não tem
auto-reversão, empréstimos já `quitado` permanecem `quitado`; apenas novos recebimentos passarão a ser
comparados ao valor correto. Aceito (é o comportamento correto).

---

## F2 — Bloquear cancelamento com lançamentos vinculados

### Decisão de detalhe (interpretação de "vínculos")
"Vínculo" = **lançamento do usuário** vinculado (desembolso ou recebimento), em qualquer caminho.
A **TX de juros auto é do sistema** (🔒, não desvinculável) — então não conta como bloqueio e é
**apagada junto com o cancelamento** (o empréstimo deixa de existir; a receita de juros não faz mais sentido).

Sem essa isenção, um empréstimo quitado com lucro nunca poderia ser cancelado (a TX de juros é imutável),
o que seria um beco sem saída.

### Correção (backend)
Em `emprestimoController.cancelar` (`backend/src/controllers/emprestimoController.js:200-216`), antes de cancelar:
```js
const vinculos = await Transacao.countDocuments({
  usuario: req.userId,
  status: 'ativo',
  emprestimoEhJurosAuto: { $ne: true },
  $or: [ { emprestimoId: emprestimo._id }, { 'pagamentos.emprestimoId': emprestimo._id } ]
});
if (vinculos > 0) {
  return res.status(400).json({
    erro: 'Este empréstimo possui lançamentos vinculados. Desvincule-os (ou estorne-os) antes de cancelar.'
  });
}
// ao cancelar com sucesso, remover a TX de juros auto (se houver)
await Transacao.deleteMany({ emprestimoId: emprestimo._id, emprestimoEhJurosAuto: true });
```
(O `deleteMany` roda só depois da checagem de vínculos.)

### Correção (frontend)
`EmprestimoDetalhePage.js` `handleCancelar`: se `movimentacoes` (excluindo a de juros auto) não estiver
vazia, mostrar um `Swal` explicativo ("Desvincule os lançamentos antes de cancelar") em vez do modal de
confirmação; caso contrário, fluxo atual. Erros 400 do backend também são exibidos via toast.

### Nota de UX (fora do escopo desta entrega)
Desvincular um vínculo **pagamento-level** hoje exige editar a TX e desmarcar o checkbox (o botão
"Editar vínculo" só navega com um toast). Com o bloqueio, isso vira o caminho obrigatório para cancelar
esses empréstimos. Melhorar esse atalho é uma pendência separada (não incluída aqui).

### Verificação
- Novo teste em `emprestimoService.test.js`/controller: cancelar com vínculo ativo → 400; cancelar sem
  vínculo ativo → 200 e TX de juros auto removida.
- E2E: cenário G — empréstimo com desembolso vinculado **não** cancela; após desvincular, cancela. O
  gasto nunca fica "sumido" silenciosamente.

---

## F4 — Renomear "Reverter quitação" → "Recalcular juros do empréstimo"

### Escopo
Somente **comunicação** (comportamento permanece: deleta + recalcula/recria a TX de juros). Sem mudança
de backend, de rota (`POST /:id/reverter-quitacao` permanece) ou de service.

### Correção
- `controle-gastos-frontend/src/pages/Emprestimos/EmprestimoDetalhePage.js`: rótulo do botão →
  **"Recalcular juros"**; `title` → "Remove e recria a transação de juros automáticos com o valor
  recalculado".
- `controle-gastos-frontend/src/components/Emprestimos/ReverterQuitacaoModal.js`: título/HTML →
  "Recalcular juros do empréstimo?"; remover a promessa "voltar ao status **ativo**" (ela não se
  sustenta quando `totalRecebido ≥ totalEsperado`); deixar claro que é **recalcular**, não desfazer.
- Vault: atualizar `context/glossary-emprestimos.md` — a nota de quitação "irreversível" precisa
  refletir que existe uma ação de **recálculo** (não de reversão).

### Verificação
- E2E: após clicar, o empréstimo continua `quitado` (comportamento esperado) e o valor da TX de juros
  é recalculado; a UI deixa de prometer "voltar a ativo".

---

## F5 — `tipoRetorno` com peso: "Sem juros" trava esperado = desembolso

### Regra
Quando o empréstimo é **`tipoRetorno: 'sem_juros'`**, o retorno esperado de cada lançamento de gasto é
**igual ao seu valor desembolsado** → `totalEsperado = totalDisbursed` → **lucro sempre 0**.
`tipoRetorno: 'valor_fixo'` mantém o comportamento atual (esperado digitado pelo usuário).

### Correção (backend — fonte de verdade)
Em `controladorTransacao.js`, ao criar/atualizar TX (ambos os caminhos), após validar o empréstimo
(`validarEmprestimoParaTransacao`, que já carrega o documento):
- Caminho TX-level: se `emprestimo.tipoRetorno === 'sem_juros'` e `tipo === 'gasto'`, **forçar**
  `transacao.valorEsperadoRetorno = transacao.valor` (ignorar o valor enviado).
- Caminho pagamento-level: para cada pagamento com `emprestimoId`, carregar o empréstimo e, se
  `sem_juros`, forçar `pagamento.valorEsperadoRetorno = pagamento.valor`.
- Centralizar numa função pequena (ex.: `aplicarRegraTipoRetorno(payload, emprestimosPorId)`) para não
  duplicar a regra nos ramos de create/update/parcelamento.

### Correção (frontend)
`EmprestimoFormFields.js`:
- Em modo **criar**, quando `novoTipoRetorno === 'sem_juros'`, desabilitar o input "Valor esperado de
  retorno" e exibi-lo igual ao valor da transação (`valorTotal`), com hint "Sem juros: o retorno esperado
  é o valor emprestado".
- Em modo **vincular**, usar o `tipoRetorno` do empréstimo selecionado (já disponível em
  `state.emprestimosPessoa`) para decidir se trava o campo.
- `useEmprestimoForm.validar`: não exigir valor esperado quando a regra trava (o valor é derivado).
- Ajustar a copy enganosa "Para empréstimos com juros, crie o empréstimo primeiro na tela de
  Empréstimos." (não existe mais tipo "com juros").

### Verificação
- Novo teste em `emprestimoService.test.js` ou de controller: TX de gasto vinculada a empréstimo
  `sem_juros` com payload `valorEsperadoRetorno=999` → persistido igual ao `valor` da TX; `lucro = 0`.
- E2E: repetir o cenário I — empréstimo "Sem juros" deve exibir **Lucro esperado R$ 0,00**.

### Efeito colateral conhecido
Empréstimos `sem_juros` **já existentes** com esperado digitado diferente só passam a ser corrigidos
quando um novo lançamento for vinculado (a regra é aplicada no vínculo). Não há migration retroativa
(decisão: evitar migração; dados dev são triviais).

---

## Não-objetivos

- ❌ Migration retroativa (corrigir empréstimos/dados antigos) — reversão/será decidida caso a caso.
- ❌ Refator amplo do `emprestimoService` (unificar tudo numa função) — já resolvido em 30/06 com `_agregarTotaisEmprestimo`.
- ❌ Renomear rota/endpoint de "reverter-quitacao" (compatibilidade).
- ❌ Melhorar o atalho de desvincular pagamento-level (vira pendência separada).
- ❌ Tocar em Conta Fixa, Patrimônio, Relatórios (fora do módulo de Empréstimos).

## Riscos

1. **F3 aumenta `totalEsperado`** de empréstimos multi-pagamento existentes → muda "Saldo a receber" e o
   gatilho de futuras quitações. Mitigação: testes existentes + validação E2E do cenário H.
2. **F2 bloqueia cancelamento** de empréstimos com vínculos — mudança de comportamento visível.
   Mitigação: mensagem clara + `Swal` explicativo no frontend.
3. **F5** só corrige dados antigos no próximo vínculo. Aceito conscientemente (sem migration).
4. **F1** é o único com risco de regressão em cálculo já correto (caminho 1). Mitigação: cobertura
   unitária dos 2 caminhos + rodar `npm test` no backend antes de fechar.

## Verificação global

- **Backend:** `npm test` (Jest) em `backend/` — suíte existente (`emprestimoService`, `emprestimoQuitacao`,
   `emprestimoAjuste`) **verde**, mais os testes novos de F1/F3/F5.
- **E2E (playwright-cli, ambiente dev):** reexecutar os cenários da bateria de 2026-10-03:
  F1 (juros em pagamento-level), F2 (bloqueio de cancelamento), F3 (card = tabela), F4 (rótulo),
  F5 (lucro 0 em "Sem juros"). Evidências por screenshot.
- **Navegador sem janela** por padrão; dados de QA deixados no banco dev para revisão manual.

## Sequenciamento do plano

1. **Bloco F1** (bug crítico, isolado, backend + testes) — primeiro.
2. **Bloco F3 + F5** (cálculo/regra no backend, compartilham `emprestimoService`/controller) + testes.
3. **Bloco F2 + F4** (backend controller + UI detail/modal + vault glossary).
4. Verificação global + reexecução E2E.
