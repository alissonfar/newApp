---
type: decision
status: active
created: 2026-09-05
tags: [modal, design-system, frontend, arquitetura]
related:
  - .brain/specs/2026-09-05-modal-compacto-design.md
  - .brain/decisions/2026-08-07-modal-exige-card-glass-interno.md
---

# ADR-025: `ModalCompacto` — segundo modal no design system, para conteúdo que não deve forçar 90% da tela

## Contexto

`ModalTransacao` (usado por 8 telas) força `width: 90%; max-width: min(95vw, 1400px)` na sua casca,
independente do conteúdo — correto pro caso de uso original (formulário denso com abas), mas errado
pra conteúdo mais estreito (ex: lista de cards no modal "Linkar Recebimento", card de 680px sobrando
espaço vazio ao redor).

Um precedente já existente no código (`UserDetailsModal.js`/`AdminUserActionsModal.js`, área Admin)
resolveu esse mesmo tipo de problema no passado criando um modal do zero — mas duplicando lógica de
overlay/scroll, **sem focus-trap**, com cor hardcoded (`#fff`, não reage a dark mode). Não é um
padrão a repetir.

## Opções consideradas

- **Estender `ModalTransacao` com uma prop de tamanho** (rejeitada): tecnicamente mais DRY, mas o
  Alisson preferiu um componente dedicado, mais isolado do uso genérico de formulário de transação e
  com espaço pra crescer funcionalidades próprias no futuro.
- **Duplicar a lógica de scroll-lock/focus-trap num modal novo, sem tocar em `ModalTransacao.js`**
  (rejeitada): repetiria o mesmo erro do modal do Admin — lógica de acessibilidade duplicada e
  sujeita a divergir.
- **Extrair um hook `useModalBehavior` reaproveitado pelos dois modais** (escolhida): `ModalTransacao`
  ganha um segundo irmão (`ModalCompacto`, largura `fit-content` em vez de `90%`) sem duplicar
  scroll-lock/focus-trap — extração pura, sem mudar comportamento dos 7 consumidores existentes.

## Decisão

Dois modais compartilhados coexistem no design system a partir de agora:
- **`ModalTransacao`** — formulários densos, com abas, que devem ocupar boa parte da tela (uso
  original, inalterado).
- **`ModalCompacto`** — conteúdo que deve controlar sua própria largura (listas de cards, pickers,
  confirmações) — a casca encolhe (`width: fit-content`) até um teto de segurança
  (`max-width: min(95vw, 900px)`).

Ambos reaproveitam o mesmo hook `useModalBehavior(modalRef)` (scroll-lock + focus-trap), extraído de
dentro de `ModalTransacao.js`. Qualquer modal novo daqui pra frente deve escolher entre os dois
conforme o formato do conteúdo — não criar um terceiro do zero (ver o erro do Admin acima).

**Deliberadamente não resolvido agora**: a inconsistência de uso do `ModalTransacao` nas outras 7
telas (larguras diferentes forçadas na mesma casca de 90%) não foi refatorada — decisão explícita do
Alisson de deixar pra uma rodada futura.

## Consequências

- **Pró:** resolve o espaço vazio do "Linkar Recebimento" sem duplicar lógica de acessibilidade nem
  repetir o erro já cometido no Admin.
- **Pró:** estabelece um padrão claro pra escolha de modal em telas futuras (denso/formulário vs.
  conteúdo que controla a própria largura).
- **Contra:** `ModalTransacao.js` precisou ser tocado (extração do hook) — risco baixo (comportamento
  idêntico), mas é um arquivo compartilhado por 8 telas, então a verificação manual desta rodada
  cobre explicitamente todos os 8 consumidores, não só o que migra.
- **Contra:** duas cascas de overlay quase idênticas (`.modal-overlay`/`.modal-compacto-overlay`)
  coexistem — duplicação de CSS aceita conscientemente (baixo custo de manutenção, evita acoplar os
  dois arquivos CSS).
- **Impacto em outras áreas:** nenhum model/service backend tocado — mudança 100% frontend.

## Referências

- Spec completa: [`2026-09-05-modal-compacto-design.md`](../specs/2026-09-05-modal-compacto-design.md)
- ADR-018 (modal exige Card glass interno) — continua valendo pros dois modais
