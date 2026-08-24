---
type: context
status: active
created: 2026-08-07
updated: 2026-08-23
tags: [conta-fixa, regras-de-negocio, backend, cron, tags, ui]
related:
  - .brain/sessions/2026-08-07-conta-fixa-implementacao-e-fix-visual.md
  - .brain/decisions/2026-08-11-conta-fixa-tags-por-pagamento-e-resumo.md
  - docs/superpowers/specs/2026-08-16-conta-fixa-pagamentos-valor-absoluto-design.md
---

# Módulo Conta Fixa — regras de negócio estáveis

Lançamento recorrente mensal (despesa ou receita) que gera `Transacao` reais, automaticamente (cron) ou via confirmação manual.

> **Nota de migração (2026-08-23):** este documento foi atualizado após a refatoração de 16-17/08 que
> trocou o modelo de divisão por **percentual** (`montarPagamentos()`, `tagsPadrao`, `tagsOverride`)
> por **valores diretos reaproveitando os hooks de transação normal** (`usePagamentos`/`TabPagamentos`).
> Se algum outro documento do vault ainda mencionar `tagsPadrao`, `tagsOverride` ou `montarPagamentos`
> para Conta Fixa, está desatualizado — ver spec do design acima para o histórico da mudança.

## Modelo (`backend/src/models/contaFixa.js`)

- `ContaFixa` é uma **entidade própria**, independente de `Transacao` — representa a regra recorrente, não uma ocorrência.
- `Transacao.contaFixaId` (ref opcional) é o único rastro de que uma transação foi gerada por uma regra.
- `tipo` usa o mesmo enum de `Transacao.tipo`: `'gasto' | 'recebivel'` (não `'despesa'/'receita'` — não existe tradução, é o mesmo valor).
- `pagamentosTemplate` usa o **mesmo `PagamentoSchema` de `Transacao`** (`{ pessoa, valor, tags }`, valor em número absoluto, não percentual). Não existe mais `tagsPadrao` no schema — o campo foi removido; tags ficam só dentro de cada item de `pagamentosTemplate.tags`, no mesmo formato de `Transacao.pagamentos[].tags` (`{ categoriaId: [tagIds] }`).

## Dois dias, não um

- `diaLancamento`: quando o **registro é criado** no banco (cron ou disponibilização da pendência).
- `diaVencimento`: a **data que vai gravada na `Transacao`** (usada em relatórios/balanço).
- Motivo real do usuário: uma despesa futura conhecida (ex: financiamento que debita dia 12) deve aparecer no saldo já a partir do dia em que o registro existe (ex: dia 1), mesmo que o dinheiro só saia depois — porque a `Transacao` já existe no banco com a data de vencimento correta.
- `vencimentoMesSeguinte` (booleano explícito, não inferido por comparação numérica dos dias) — cobre financiamentos que atravessam a virada do mês.
- Dia inválido no mês (ex: 31 em fevereiro) → cai no último dia do mês (`calcularDataDoDia` em `contaFixaService.js`).

## Dedupe de ciclo (evita lançamento duplicado)

- `ContaFixa.ultimoCicloProcessado: { mes, ano }` — atualizado sempre que um ciclo é processado (gerado automaticamente, confirmado manualmente, **ou pulado**).
- Um ciclo é identificado só por `{mes, ano}` do **lançamento** (não do vencimento) — um único ciclo por mês calendário por `ContaFixa`.
- `ContaFixa.ciclosPulados: [{mes, ano}]` guarda histórico de "pular este mês" (redundante com `ultimoCicloProcessado` pra dedupe, mas preserva histórico visível).
- **Nenhuma entidade separada de "lançamento pendente"** — pendência é sempre calculada on-the-fly: `ContaFixa` ativa + modo `confirmacao` + hoje ≥ data de lançamento do ciclo + ciclo ainda não processado.

## Encerramento automático

- `totalGerados` (contador, incrementado só quando uma `Transacao` é de fato gerada — **não** ao pular) vs `totalRepeticoes` (opcional, ex: financiamento 12x).
- `dataFim` (opcional) — alternativa/complemento a `totalRepeticoes`.
- `verificarEEncerrar()` muda `status` pra `'encerrada'` quando qualquer um dos dois é atingido. Histórico de transações já geradas não é afetado.

## Divisão de pagamento (`pagamentosTemplate`)

- Guarda **valores diretos** (não percentual) — mudança de 16-17/08 (ver spec de design linkada no topo). O usuário digita o valor de cada pessoa direto, igual a uma transação normal, em vez de definir um percentual que era recalculado a cada ciclo.
- Validação da soma é **compartilhada** com transação normal: `transacaoService.validarSomaPagamentos()` é chamada tanto ao criar/editar o template (`contaFixaController.js`) quanto ao confirmar uma pendência (`contaFixaService.confirmarPendencia()`), garantindo que a soma dos pagamentos sempre bata com o valor total.
- Frontend reaproveita `usePagamentos`/`TabPagamentos` (os mesmos hooks/componentes do lançamento normal de transação), com `enableEmprestimo={false}` — vínculo com Empréstimo não se aplica a um molde recorrente. Parcelamento também não é exposto nessa tela.

## UI do modal (`ContaFixaFormModal.js`) e da tela de pendências (`PendenciasContasFixas.js`)

- `ContaFixaFormModal`: duas abas, mesmo padrão visual do modal de Transações (`transacao-tabs-bar`/`transacao-tab`): "Principal" (formulário, com `TabPagamentos` embutido) e "Resumo" (preview antes de salvar).
- Tela de "Pendências do Mês" (`/contas-fixas/pendencias`): mostra um card por pendência calculada on-the-fly (ver seção de dedupe abaixo), com valor editável e o **mesmo editor completo de pagamentos** usado no lançamento normal — permite ajustar valores/divisão antes de confirmar. Ações por card: "Confirmar lançamento" (gera a `Transacao`) ou "Pular este mês" (marca o ciclo como processado sem gerar nada).

## Cron (automático)

- `node-cron` (dependência nova, instalada nesta sessão) — `backend/src/services/contaFixaCronService.js`, registrado no `app.listen` de `app.js`, mesmo padrão do `pluggyCronService.js` existente.
- Roda 1x/dia. Se o servidor cair no dia exato do lançamento, a próxima execução detecta o ciclo pendente (sem `Transacao` gerada) e gera com a **data de vencimento correta**, não a data de hoje.

## Fora de escopo (decisão explícita)

- **Não** depende do módulo de conta conjunta — usa `pagamentos[]` normalmente, como qualquer transação. Desenhado assim de propósito, já sabendo que conta conjunta seria descontinuada (ver spec de descontinuação).
- Testes automatizados cobrem só a lógica pura de data (`calcularCiclo`, `cicloJaProcessado`, `verificarEEncerrar`) — decisão do usuário, primeira vez usando testes automatizados no projeto. Funções dependentes de banco (`listarPendencias`, `confirmarPendencia`, `pularCiclo`, geração via cron) são validadas manualmente. **Ponto em aberto:** depois da migração pra valor absoluto, não há teste de integração cobrindo o caminho feliz de `confirmarPendencia` (só um teste de rejeição por payload inválido) — é justamente a função cujo comportamento interno mudou na refatoração de 16-17/08.
