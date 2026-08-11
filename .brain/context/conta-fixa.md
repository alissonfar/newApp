---
type: context
status: active
created: 2026-08-07
updated: 2026-08-11
tags: [conta-fixa, regras-de-negocio, backend, cron, tags, ui]
related:
  - .brain/sessions/2026-08-07-conta-fixa-implementacao-e-fix-visual.md
  - .brain/decisions/2026-08-11-conta-fixa-tags-por-pagamento-e-resumo.md
---

# Módulo Conta Fixa — regras de negócio estáveis

Lançamento recorrente mensal (despesa ou receita) que gera `Transacao` reais, automaticamente (cron) ou via confirmação manual.

## Modelo (`backend/src/models/contaFixa.js`)

- `ContaFixa` é uma **entidade própria**, independente de `Transacao` — representa a regra recorrente, não uma ocorrência.
- `Transacao.contaFixaId` (ref opcional) é o único rastro de que uma transação foi gerada por uma regra.
- `tipo` usa o mesmo enum de `Transacao.tipo`: `'gasto' | 'recebivel'` (não `'despesa'/'receita'` — não existe tradução, é o mesmo valor).
- Categorização é **por pagamento**, igual ao modal de Transações: `pagamentosTemplate[].tagsOverride` usa o mesmo formato de `Transacao.pagamentos[].tags` (`{ categoriaId: [tagIds] }`). `ContaFixa.tagsPadrao` (mesmo formato, nível raiz) existe só como fallback pra registros antigos que não tinham `tagsOverride` por item — ver [ADR-023](../decisions/2026-08-11-conta-fixa-tags-por-pagamento-e-resumo.md). `montarPagamentos()` resolve com `tagsOverride || tagsPadrao` por item.

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

- Guarda **percentuais**, não valores fixos — porque o valor real de cada ciclo pode variar (ex: conta de luz), mas a divisão proporcional entre pessoas deve se manter.
- `montarPagamentos()` (em `contaFixaService.js`) usa `decimal.js` e ajusta o **último** item do array pra absorver a diferença de arredondamento, garantindo que a soma sempre bate exatamente com o valor total (nunca perde/ganha centavo por arredondamento de percentual).

## UI do modal (`ContaFixaFormModal.js`)

- Duas abas, mesmo padrão visual do modal de Transações (`transacao-tabs-bar`/`transacao-tab`): "Principal" (formulário) e "Resumo" (preview antes de salvar — dados básicos, soma de percentuais, valor calculado por pessoa com tags, alertas de consistência). Implementado inline no próprio arquivo, não reusa `TabResumo.js` de Transações (shape de dados diferente o bastante pra não compensar abstrair ainda).
- `TagSelector` fica dentro do loop de `pagamentosTemplate`, um por pagamento — ver ADR-023.

## Cron (automático)

- `node-cron` (dependência nova, instalada nesta sessão) — `backend/src/services/contaFixaCronService.js`, registrado no `app.listen` de `app.js`, mesmo padrão do `pluggyCronService.js` existente.
- Roda 1x/dia. Se o servidor cair no dia exato do lançamento, a próxima execução detecta o ciclo pendente (sem `Transacao` gerada) e gera com a **data de vencimento correta**, não a data de hoje.

## Fora de escopo (decisão explícita)

- **Não** depende do módulo de conta conjunta — usa `pagamentos[]` normalmente, como qualquer transação. Desenhado assim de propósito, já sabendo que conta conjunta seria descontinuada (ver spec de descontinuação).
- Testes automatizados cobrem só a lógica pura de data/valor (`calcularCiclo`, `montarPagamentos`, `cicloJaProcessado`, `verificarEEncerrar`) — decisão do usuário, primeira vez usando testes automatizados no projeto. Funções dependentes de banco (`listarPendencias`, `confirmarPendencia`, `pularCiclo`, geração via cron) são validadas manualmente.
