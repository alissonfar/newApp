---
type: decision
status: active
created: 2026-10-03
tags: [emprestimos, qa, bugfix, juros-auto, cancelamento, tipo-retorno, total-esperado]
related: [2026-10-03-emprestimos-correcoes-design, 2026-06-30-emprestimo-bug-juros-auto-e-processo-desfazer-design, 2026-06-25-emprestimo-dois-caminhos, 2026-06-24-valor-esperado-por-transacao]
---

# ADR-026: Correções do módulo de Empréstimos (achados da bateria QA de 2026-10-03)

> Design detalhado: `specs/2026-10-03-emprestimos-correcoes-design.md`.
> Número escolhido como 026 após checar o vault (maior era ADR-025; há colisões históricas de número).

## Contexto

Uma bateria de simulações end-to-end (`playwright-cli`, ambiente dev) do fluxo de empréstimo
reproduziu 11 cenários e expôs 5 pontos. Este ADR registra as **decisões de comportamento** tomadas
nesta sessão (o "como implementar" fica no design/spec e no plano).

Reenquadramento importante: o design de 2026-06-30 já havia desenhado a ação "Reverter quitação" como
*recalcular* (deletar + recriar a TX de juros, "no-op visual"), e havia declarado o cancelamento com
limpeza de TXs como **não-objetivo** ("soft cancel"). Logo, dois achados não são bugs de cálculo, e sim
decisões a revisar.

## Decisões

### F1 — (bug) TX de juros auto em empréstimo pagamento-level
`buscarSnapshotUltimoRecebimento` só enxergava recebíveis no caminho TX-level. **Decisão:** passar a
considerar os dois caminhos (`$or` em `emprestimoId` e `pagamentos[].emprestimoId`) e derivar pessoa/tags
do pagamento vinculado. É o único achado com risco real de perda de contabilidade (lucro não vira receita).

### F2 — Cancelar empréstimo com vínculos: **bloquear** (reverte o não-objetivo de 2026-06-30)
**Decisão:** não permitir cancelar enquanto houver lançamentos do usuário vinculados (desembolso/
recebimento). A TX de juros auto (sistema) **não bloqueia** e é **apagada no cancelamento** — senão um
empréstimo quitado com lucro nunca poderia ser cancelado (a TX é imutável).

- **Alternativas rejeitadas:** (a) manter o *soft cancel* — foi rejeitado porque faz o gasto sumir do
  relatório silenciosamente; (b) cancelar e devolver as TXs automaticamente à contabilidade — rejeitado
  porque mistura "cancellar" com "estornar", que já existe como operação própria de transação.

### F3 — `totalEsperado` do caminho 2: **somar por pagamento** (revisa o `$first` de 2026-06-30)
**Decisão:** a **tabela de Movimentações é a fonte de verdade**. O agregado passa a somar
`valorEsperadoRetorno` de cada pagamento vinculado, não 1× por TX.

- **Alternativa rejeitada:** ajustar a tabela para 1× por TX — rejeitado porque o modelo pagamento-level
  permite esperados distintos por pagamento; repetir o valor na tabela esconderia isso.
- **Efeito:** `totalEsperado` de empréstimos multi-pagamento aumenta; quitação não auto-reverte, então
  empréstimos já quitados permanecem quitados.

### F4 — "Reverter quitação" é **recalcular**, não reverter: renomear
**Decisão:** manter o comportamento desenhado em 2026-06-30 e corrigir a **comunicação** — a ação passa a
se chamar **"Recalcular juros do empréstimo"**, com modal e glossário ajustados (sem prometer "voltar a ativo").

- **Alternativa rejeitada:** implementar reversão real (impedir a re-quitação automática) — rejeitada por
  mudar a regra de negócio de quitação automática (escopo e risco maiores) para resolver o que é, na
  origem, um problema de rótulo.

### F5 — `tipoRetorno` deve ter peso: **"Sem juros" trava o esperado = desembolso**
**Decisão:** em empréstimo `sem_juros`, o `valorEsperadoRetorno` de cada gasto é **forçado igual ao valor
desembolsado** (backend é a fonte de verdade; frontend trava o campo) → lucro sempre 0. `valor_fixo`
mantém o esperado digitado pelo usuário.

- **Alternativas rejeitadas:** (a) "Sem juros" só forçar lucro 0 sem travar o campo — menos explícito;
  (b) remover o `tipoRetorno` — mudança de schema/UI/migração desproporcional agora.
- **Sem migration retroativa:** empréstimos `sem_juros` antigos só são corrigidos no próximo vínculo.

## Consequências

- **Pró:** fecha o vazamento de contabilidade do caminho pagamento-level (F1); elimina a perda silenciosa
  de gasto no cancelamento (F2); tela deixa de mostrar dois números contraditórios (F3); ação deixa de
  prometer o que não faz (F4); `tipoRetorno` deixa de ser campo inerte (F5).
- **Contra / risco:** F2 adiciona fricção (obriga desvincular antes de cancelar) e depende de um atalho de
  desvínculo pagamento-level ainda fraco (pendência separada); F3 altera `totalEsperado` de empréstimos
  existentes; nenhum tem migration.
- **Fora de escopo:** melhoria do atalho de desvínculo pagamento-level; migration retroativa; demais módulos.

## Referências

- Spec/design: `.brain/specs/2026-10-03-emprestimos-correcoes-design.md`
- Bateria QA (evidências): screenshots `qa-cenario*.png` na raiz do projeto
- Design de origem (juros auto): `.brain/sessions/2026-06-30-emprestimo-bug-juros-auto-e-processo-desfazer-design.md`
- ADR-014 (valor esperado por TX), ADR-015 (dois caminhos)
- Glossário: `.brain/context/glossary-emprestimos.md` (a atualizar após implementação)
