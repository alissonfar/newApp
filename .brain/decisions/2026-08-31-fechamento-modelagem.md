---
type: decision
status: active
created: 2026-08-31
tags: [fechamento, pessoa, settlement, relatorios, arquitetura]
related:
  - .brain/specs/2026-08-31-fechamento-design.md
  - .brain/decisions/2026-08-11-descontinuacao-conta-conjunta.md
---

# ADR-020: Módulo Fechamento — modelagem em 2 níveis, live-query, casamento por nome com Pessoa

## Contexto

Novo módulo "Fechamento" substitui a aba "Insights" (placeholder sem uso). Objetivo: consolidar numa
única tela o acompanhamento de fechamento de várias pessoas por período — transações, valor total,
status de envio/recebimento — hoje disperso entre `/relatorio`, `/recebimentos` (`Settlement`) e
`/pessoas`. Spec completa: [`2026-08-31-fechamento-design.md`](../specs/2026-08-31-fechamento-design.md).

## Opções consideradas

### Pessoa: string livre vs referência ao model `Pessoa`

- **String livre** (rejeitada): mais simples, sem exigir cadastro prévio, mas perde acesso a
  contato/observações já modeladas em `Pessoa` — que serão a base do envio via WhatsApp (futuro).
- **Referência a `Pessoa`, casada por nome com `pagamentos[].pessoa` em tempo de consulta**
  (escolhida): `FechamentoCadastro.pessoa` é `ObjectId`. O link com as transações reais
  (`Transacao.pagamentos[].pessoa`, que é string) acontece só na hora da query, via regex
  case-insensitive — mesma técnica que `settlementService.listarPendentes` já usa. **Sem migração de
  dados**: nada é gravado retroativamente em `Transacao`. Trade-off aceito: o nome do `Pessoa`
  cadastrado precisa bater exatamente (case-insensitive) com o nome usado historicamente nos
  pagamentos, ou a instância aparece com 0 transações — a UI alerta (não bloqueia) esse caso.

### Cadastro único por pessoa vs um documento por período

- **Um documento por pessoa contendo array de períodos aninhado** (rejeitada): dificultaria a query
  central da tela — "todas as pessoas com uma instância no período X" — que precisa varrer/`$unwind`
  todos os cadastros.
- **Dois models normalizados** (escolhida): `FechamentoCadastro` (perfil: pessoa + modelo de
  relatório padrão, 1 por pessoa) + `FechamentoInstancia` (N por cadastro, uma por período,
  com status e `settlementId`). Query da tela principal vira um filtro direto por
  `dataInicio`/`dataFim` na coleção de instâncias.

### Transações/valor: live-query vs snapshot

- **Snapshot ao finalizar** (rejeitada por ora): garantiria que o histórico bate exatamente com o
  que foi enviado, mas exige guardar cópia dos dados e uma tela de "reabrir/recalcular" se algo
  precisar ser corrigido depois.
- **Ao vivo, sempre recalculado** (escolhida): `FechamentoInstancia` não guarda transações nem
  total — a tela busca ao vivo por pessoa+período a cada abertura, igual o Relatório já faz. Mais
  simples, sem duplicar dado; se uma transação for editada/estornada depois, o fechamento reflete a
  mudança automaticamente.

## Decisão

Implementar conforme a spec: 2 models (`FechamentoCadastro`, `FechamentoInstancia`), pessoa como
referência com casamento por nome em tempo de consulta, valores sempre live-query, status
`aberto → enviado → aguardando_recebimento → recebido` com transição automática para `recebido` ao
linkar um `Settlement` existente (não cria settlement novo). Reaproveita 100% o motor de PDF já
existente (`@react-pdf/renderer`) — única dependência nova é `jszip`, exclusivamente para empacotar
exportação em lote.

## Consequências

- **Pró:** zero duplicação de dado financeiro; zero mudança nos motores de relatório/PDF/settlement
  já existentes — o módulo é puramente orquestrador.
- **Pró:** query da tela principal ("pessoas no período X") é direta, sem `$unwind`.
- **Contra:** exige que toda pessoa usada num Fechamento tenha um `Pessoa` cadastrado com nome
  idêntico (case-insensitive) ao usado em `pagamentos[].pessoa` — não há enforcement de schema para
  isso, só alerta de UI quando 0 transações são encontradas.
- **Contra:** nenhum registro histórico imutável do que foi de fato enviado — se o usuário editar
  uma transação semanas depois de já ter enviado o PDF daquele fechamento, o valor exibido diverge
  silenciosamente do que foi enviado (aceito conscientemente; snapshot fica como evolução futura se
  isso incomodar na prática).
- **Impacto em outras áreas:** nenhum model/service existente é alterado. `Settlement`,
  `ModeloRelatorio`, `reportEngine`, `Pessoa` e o motor de PDF são consumidos, não modificados.

## Referências

- Spec completa: [`2026-08-31-fechamento-design.md`](../specs/2026-08-31-fechamento-design.md)
- ADR-019 (descontinuação Conta Conjunta) — motivo de `pagamentos[]` ser a base de divisão por pessoa hoje
- ADR-017 (menuStructure fonte de verdade) — onde a entrada de sidebar entra
