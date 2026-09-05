---
type: design
status: approved
created: 2026-09-05
approved: 2026-09-05
tags: [fechamento, recebimentos, settlement, ui, modal, brainstorm]
related:
  - .brain/specs/2026-08-31-fechamento-design.md
  - .brain/specs/2026-09-05-fix-pessoa-recebimento-settlement-design.md
  - .brain/decisions/2026-08-07-modal-exige-card-glass-interno.md
  - .brain/playbooks/criar-tela-consistente-design-system.md
---

# Design Doc — Redesenho do modal "Linkar Recebimento"

> Melhoria de UI no modal `LinkarRecebimentoModal.js` (módulo Fechamento). Motivado pelo Alisson após
> o fix funcional do "Linkar Recebimento" (ver spec relacionada) começar a mostrar candidatos reais
> pela primeira vez — o card de cada candidato hoje é raso demais (só descrição/valor/data) e o modal
> em si é mais estreito do que precisa ser.

## 1. Contexto

`LinkarRecebimentoModal.js` já segue o ADR-018 (Card `glass` interno — visualmente correto, sem
vazamento de fundo). O problema não é esse — é informação insuficiente por card e espaço mal
aproveitado: `.linkar-recebimento-modal` trava em `width: min(480px, 90vw)` enquanto o
`ModalTransacao` (casca) permite até `1400px`, sobrando vazio; e cada item da lista mostra só
descrição, valor bruto e data — sem indicar quais pessoas o settlement cobre, quanto foi de fato
aplicado às dívidas (vs. valor bruto recebido), ou quais transações específicas foram quitadas.

A tela `/fechamento` (`FechamentoInstanciaCard.js`) já resolve esse problema de densidade de
informação bem — pílula de status, stepper, totais em destaque, detalhe expansível com tabela de
transações — e serve de referência visual (não de reaproveitamento literal de código, já que o
formato de dado é outro: `Settlement` não é `FechamentoInstancia`).

**Dado já disponível, nenhuma mudança de backend necessária**: `settlementService.listar()` (spec
`2026-09-05-fix-pessoa-recebimento-settlement-design.md`) já devolve, por item, `pessoas: [...]`,
`totalApplied`, `leftoverAmount`, `appliedTransactions[].transactionId.{descricao,valor,data}` +
`amountApplied`, e `tagId` populado.

## 2. Decisões deste brainstorm

| Tema | Decisão | Razão |
|---|---|---|
| Settlement cobrindo múltiplas pessoas | Mostrar todas as pessoas em badges, destacando a pessoa do Fechamento atual | Esconder que o settlement é compartilhado seria informação perdida, não simplificação |
| Estrutura de componentes | Novo componente `SettlementCandidateCard.js` (não tudo dentro do modal) | Mantém `LinkarRecebimentoModal.js` enxuto (busca de dados + estado), isola a apresentação do card — mesmo padrão de `FechamentoInstanciaCard` ser separado do grid que o renderiza |
| Reaproveitamento visual vs. de código | Copiar a linguagem visual de `FechamentoInstanciaCard.css` (Card glass, tipografia de valores, tabela de detalhe) em classes CSS próprias (`settlement-candidate-card__*`), não reaproveitar `FechamentoInstanciaCard.js` literalmente | Os dados de origem são formatos diferentes (`instancia.cadastro.pessoa` vs `settlement.pessoas[]`) — acoplar os dois componentes seria gambiarra, não ganho |
| Ênfase de valor | Valor em destaque = `totalApplied` (quanto do recebimento cobre as dívidas), não o valor bruto recebido | Responde a pergunta que importa ao decidir o link: "isso cobre o que a pessoa devia?" |
| Sobra (`leftoverAmount`) | Linha secundária discreta "+ R$X de sobra" quando `> 0` | Informação real que hoje não aparece em lugar nenhum do modal, mas não deve competir com o valor principal |
| Expandir múltiplos candidatos | Accordion exclusivo (só um expandido por vez) | Diferente do grid principal do Fechamento (que permite vários abertos) — aqui é uma lista de escolha num modal mais estreito, abrir vários ao mesmo tempo desorienta mais do que ajuda |
| Largura do modal | `.linkar-recebimento-modal` de `min(480px, 90vw)` para `min(680px, 92vw)` | Ajusta só o teto em telas largas (onde sobrava vazio) — comportamento em telas pequenas já era responsivo via `90vw`/`92vw` |

## 3. Componentes

### 3.1 `SettlementCandidateCard.js` (novo — `components/Fechamento/`)

**Props:** `settlement` (item de `listarSettlements`), `pessoaAtual` (nome da pessoa do Fechamento
aberto, pra destacar entre `settlement.pessoas`), `expandido` (bool), `onToggleExpandir` (callback,
recebe `settlement._id`), `onLinkar` (callback, recebe `settlement._id`), `linkando` (bool — estado de
loading do botão).

**Renderiza (fechado):**
```
[Cleia] [Milena]                          R$ 84,47
Transferência recebida pelo Pix - CLEIA DA SILVA...
05/09/2026 · 4 transações quitadas
                                    [Ver detalhe ▾] [Linkar]
```
- Badges de pessoa: uma por nome em `settlement.pessoas`, a que bate com `pessoaAtual`
  (case-insensitive) recebe um modificador de destaque (`--atual`).
- Valor grande: `formatMoeda(settlement.totalApplied)`.
- Se `settlement.leftoverAmount > 0`: linha secundária pequena `+ {formatMoeda(leftoverAmount)} de sobra`.
- Descrição: `settlement.receivingTransactionId?.descricao`.
- Meta: data (`settlement.createdAt`) + `settlement.appliedTransactions.length` transações quitadas.

**Renderiza (expandido), abaixo da meta:**
- Tabela (mesma forma de `fechamento-tx-table`, classes próprias): colunas Data / Descrição / Valor
  aplicado, uma linha por `settlement.appliedTransactions[]` (`transactionId.data`,
  `transactionId.descricao`, `amountApplied`).
- Se `settlement.tagId` existir: badge com a tag aplicada, mesma classe `TagBadge` já usada em
  `HistoricoRecebimentosPage.js`.

### 3.2 `SettlementCandidateCard.css` (novo)

Classes próprias (`settlement-candidate-card__*`), variáveis de espaçamento/cor/tipografia
reaproveitadas de `FechamentoInstanciaCard.css` (mesmos tokens `--cg-*`, mesmo padrão de
`font-variant-numeric: tabular-nums` pro valor grande) — visualmente irmã, não copiada por import.

### 3.3 `LinkarRecebimentoModal.js` (modificado)

- Estado novo: `const [expandidoId, setExpandidoId] = useState(null);` — accordion exclusivo, alternar
  entre `null` e `settlement._id`.
- Troca o `.map()` inline atual por `<SettlementCandidateCard settlement={s} pessoaAtual={pessoaNome}
  expandido={expandidoId === (s._id || s.id)} onToggleExpandir={...} onLinkar={handleLinkar}
  linkando={linkando === (s._id || s.id)} />`.
- Resto da lógica (fetch de `listarSettlements`, `handleLinkar`) permanece igual.

### 3.4 `LinkarRecebimentoModal.css` (modificado)

Única mudança: `.linkar-recebimento-modal { width: min(680px, 92vw); }` (era `min(480px, 90vw)`).

## 4. Não-objetivos

- Nenhuma mudança de backend/API — todos os dados já vêm prontos de `listarSettlements`.
- Nenhuma mudança no comportamento de `handleLinkar`/`linkarRecebimento` (backend) — só apresentação.
- Não mexe no grid principal da tela `/fechamento` (`FechamentoInstanciaCard.js` continua com seu
  próprio comportamento de múltiplos cards expandidos simultaneamente).

## 5. Verificação

Sem teste automatizado — projeto não tem suíte de frontend configurada (mesma situação de toda tela
do Controle de Gastos). Roteiro manual: abrir `/fechamento`, expandir uma instância com settlements
candidatos disponíveis (ex: Cleia, que já tem candidatos reais desde o fix anterior), clicar "Linkar
Recebimento", conferir visualmente o card mais rico (badges de pessoa, valor em destaque, sobra
quando houver), expandir um candidato (ver tabela de transações + tag), expandir outro (confirmar que
o primeiro fecha — accordion exclusivo), e confirmar que "Linkar" ainda funciona normalmente.

## 6. Referências

- `.brain/specs/2026-08-31-fechamento-design.md` — mockup original do módulo Fechamento, referência
  visual do card `FechamentoInstanciaCard`
- `.brain/specs/2026-09-05-fix-pessoa-recebimento-settlement-design.md` — fix que tornou os
  candidatos reais (pré-requisito funcional desta melhoria de UI)
- `.brain/decisions/2026-08-07-modal-exige-card-glass-interno.md` — ADR-018, já satisfeito por este
  modal
- `.brain/playbooks/criar-tela-consistente-design-system.md` — playbook de design system, item
  "botão sozinho numa caixa gigante" bate com o sintoma relatado
