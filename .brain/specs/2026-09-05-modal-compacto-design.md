---
type: design
status: approved
created: 2026-09-05
approved: 2026-09-05
tags: [modal, ui, design-system, fechamento, recebimentos, brainstorm]
related:
  - .brain/specs/2026-09-05-linkar-recebimento-modal-redesign-design.md
  - .brain/decisions/2026-08-07-modal-exige-card-glass-interno.md
---

# Design Doc — `ModalCompacto` (modal com largura de conteúdo, não forçada)

> Correção de um problema visual apontado pelo Alisson após o redesenho do modal "Linkar
> Recebimento": o modal ficava com um espaço vazio grande ao redor do card, porque a casca
> compartilhada `ModalTransacao` força `width: 90%` (até `1400px`) independente do tamanho real do
> conteúdo.

## 1. Contexto

`ModalTransacao.js` é usado por **8 telas diferentes** (`LinkarRecebimentoModal`,
`NovaInstanciaModal`, `TransactionDetailsModal`, `ContaFixaFormModal`, `Home`,
`DetalhesImportacaoPage`, `Relatorio`, `Transacoes`). Sua casca (`.modal-content`) tem
`width: 90%; max-width: min(95vw, 1400px)` hardcoded — faz sentido pro caso de uso original
(formulário de transação denso, com abas), mas força qualquer conteúdo menor (como o card de 680px
do "Linkar Recebimento") a ficar cercado de espaço vazio, porque a casca não se adapta ao tamanho do
conteúdo.

**Precedente investigado e descartado como modelo:** as telas de Admin (`UserDetailsModal.js`,
`AdminUserActionsModal.js`) já resolveram esse mesmo tipo de problema no passado criando seu próprio
modal do zero — mas duplicando toda a lógica de overlay/scroll-lock, **sem focus-trap**, e com cor
hardcoded (`background-color: #fff`, não reage a dark mode). Não é um padrão a copiar.

**Decisão sobre `ModalTransacao` em geral:** o Alisson reconhece que `ModalTransacao` é reutilizado de
forma inconsistente entre as 8 telas (larguras/necessidades diferentes forçadas na mesma casca), mas
optou por **não refatorar isso agora** — escopo desta rodada é só criar o novo modal e migrar o
"Linkar Recebimento" pra ele.

## 2. Decisão

Criar `ModalCompacto` — um segundo modal, para casos onde o conteúdo deve controlar a largura (listas
de itens/cards, pickers), em vez de forçar 90% da tela. Para não duplicar lógica de acessibilidade
(scroll-lock do body + focus-trap de Tab/Shift+Tab, que `ModalTransacao` já implementa
corretamente), essa lógica é **extraída para um hook compartilhado** `useModalBehavior(modalRef)` —
extração pura, sem mudar nenhum comportamento visível dos 7 consumidores que continuam em
`ModalTransacao`.

| Alternativa | Descartada por |
|---|---|
| Duplicar a lógica de scroll-lock/focus-trap no modal novo, sem tocar em `ModalTransacao.js` | Repetiria ~25 linhas de lógica de acessibilidade — e é exatamente o padrão que já deu errado no Admin (modal duplicado, sem focus-trap) |
| Estender `ModalTransacao` com uma prop de tamanho, em vez de um componente novo | Alisson preferiu um componente dedicado — "pode ter mais funções [no futuro]", mais isolado do uso genérico do form de transação |
| Refatorar `ModalTransacao` pra resolver a inconsistência de largura entre os 8 usos de uma vez | Fora de escopo desta rodada, por decisão explícita — fica para o futuro |

## 3. Arquitetura

### 3.1 `components/Modal/useModalBehavior.js` (novo)

Hook `useModalBehavior(modalRef)` — contém o `useEffect` de scroll-lock (`document.body.style.overflow
= 'hidden'`, restaurado no cleanup) + focus-trap (Tab/Shift+Tab presos entre o primeiro e o último
elemento focável dentro de `modalRef.current`), extraído **literalmente** do `useEffect` que hoje
vive dentro de `ModalTransacao.js` — mesmo comportamento, mesma implementação, só movido de lugar.

### 3.2 `ModalTransacao.js` (modificado — extração pura)

Substitui o `useEffect` inline por uma chamada a `useModalBehavior(modalRef)`. JSX, classes CSS,
`ModalTransacao.css` — tudo continua idêntico. Nenhuma mudança visível pros 7 consumidores que
permanecem nele.

### 3.3 `components/Modal/ModalCompacto.js` (novo)

Mesma estrutura de `ModalTransacao.js` (overlay + content com `ref`, `role="dialog"
aria-modal="true"`, botão fechar com `aria-label="Fechar modal"`), mesmo hook
`useModalBehavior(modalRef)`, classes CSS próprias (`modal-compacto-overlay`,
`modal-compacto-content`). Mesma API de props (`{ onClose, children }`) — migração de qualquer
consumidor existente é só trocar o import/tag.

### 3.4 `components/Modal/ModalCompacto.css` (novo)

```css
.modal-compacto-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-compacto-content {
  background: var(--cor-fundo-card);
  padding: 20px 24px;
  border-radius: var(--borda-radius);
  width: fit-content;
  max-width: min(95vw, 900px);
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  box-shadow: var(--sombra-card);
  border: 1px solid rgba(224, 231, 255, 0.2);
}
```

Não reaproveita `.modal-overlay`/`.modal-content` de `ModalTransacao.css` (evita acoplar os dois
arquivos CSS por ~10 linhas idênticas de overlay — duplicação trivial e estável, aceita
conscientemente). A diferença real: `width: fit-content` em vez de `width: 90%` — a casca encolhe pro
tamanho do conteúdo real (o `Card` de 680px do "Linkar Recebimento"), eliminando o espaço vazio.

### 3.5 `LinkarRecebimentoModal.js` (modificado)

Troca `import ModalTransacao from '../Modal/ModalTransacao'` por
`import ModalCompacto from '../Modal/ModalCompacto'`, e a tag `<ModalTransacao onClose={onClose}>`
por `<ModalCompacto onClose={onClose}>`. Nada mais muda neste arquivo.

## 4. Não-objetivos

- Não refatora a inconsistência de uso do `ModalTransacao` nas outras 7 telas — decisão explícita de
  ficar pra depois.
- Não migra `NovaInstanciaModal.js` (outro modal do Fechamento) pro `ModalCompacto` — fora de escopo
  desta rodada, mesmo sendo um candidato natural no futuro.
- Nenhuma mudança de comportamento funcional em nenhum modal — só a largura da casca do
  `LinkarRecebimentoModal` muda de fato.

## 5. Verificação

**Backend:** nenhuma — mudança 100% frontend/CSS.

**Verificação manual via navegador — obrigatória em TODOS os 8 pontos que usam `ModalTransacao`**
(pedido explícito do Alisson: confirmar que a extração do hook não quebrou nada nos 7 que
permanecem, e que o `ModalCompacto` novo funciona no 1 que migra):

1. `LinkarRecebimentoModal` (`/fechamento` → "Linkar Recebimento") — confirma visual novo
   (`ModalCompacto`, sem espaço vazio) e que scroll-lock/focus-trap continuam funcionando.
2. `NovaInstanciaModal` (`/fechamento` → "Nova Instância") — continua em `ModalTransacao`, confirma
   que abre normalmente, largura igual à de antes.
3. `TransactionDetailsModal` (`/transacoes` → detalhe de uma transação) — idem.
4. `ContaFixaFormModal` (`/contas-fixas` → criar/editar) — idem.
5. `Home.js` (modal usado na tela inicial — checar qual ação abre) — idem.
6. `DetalhesImportacaoPage.js` (`/importacao-massa/:id` → modal de edição de transação importada) —
   idem.
7. `Relatorio.js` (`/relatorio` → modal de transação a partir do relatório) — idem.
8. `Transacoes.js` (`/transacoes` → nova/editar transação) — idem.

Para cada um dos 7 que permanecem em `ModalTransacao`: abrir o modal, digitar em pelo menos um campo,
apertar Tab algumas vezes confirmando que o foco não escapa do modal, fechar. Para o 1 que migra:
mesmo roteiro, mais a conferência visual de que não sobra espaço vazio ao redor do card.

## 6. Referências

- `.brain/specs/2026-09-05-linkar-recebimento-modal-redesign-design.md` — spec anterior que motivou
  esta (o redesenho do card expôs o problema de largura da casca)
- `.brain/decisions/2026-08-07-modal-exige-card-glass-interno.md` — ADR-018, ainda válido: qualquer
  conteúdo dentro de `ModalCompacto` também precisa se auto-envolver num `Card variant="glass"`
