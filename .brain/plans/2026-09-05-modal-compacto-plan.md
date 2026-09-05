# ModalCompacto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use lean-subagent-execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No TDD — implement and verify,
> tests are required but not test-first. Each task carries a testability tag (tela / sem tela / não
> testável) — use it, don't re-infer it, when reporting via personal-test-report.

**Goal:** Criar `ModalCompacto` (largura de conteúdo, `fit-content`, em vez do `width: 90%` forçado
de `ModalTransacao`) e migrar o "Linkar Recebimento" pra ele, sem quebrar nenhum dos outros
consumidores de `ModalTransacao`.

**Architecture:** Extrair a lógica de scroll-lock + focus-trap de `ModalTransacao.js` pra um hook
`useModalBehavior(modalRef)` (extração pura, sem mudar comportamento). `ModalCompacto.js` reaproveita
o mesmo hook, com CSS próprio de largura `fit-content`. `LinkarRecebimentoModal.js` migra pra ele.
Verificação manual cobre os 8 pontos que usam (ou usavam) `ModalTransacao`.

**Tech Stack:** React 19, CSS (tokens do design system), sem testes automatizados de frontend.

Spec completa: `.brain/specs/2026-09-05-modal-compacto-design.md`.
ADR: `.brain/decisions/2026-09-05-modal-compacto-vs-modal-transacao.md`.

---

### Task 1: Extrair `useModalBehavior` de `ModalTransacao.js`

**Files:**
- Create: `controle-gastos-frontend/src/components/Modal/useModalBehavior.js`
- Modify: `controle-gastos-frontend/src/components/Modal/ModalTransacao.js` (arquivo inteiro —
  pequeno, reescrita completa)

**Testabilidade:** tela — mesmo sendo uma extração "pura", `ModalTransacao` é usado por 7 telas reais;
qualquer regressão de comportamento (scroll-lock, focus-trap) só aparece testando na tela.

- [ ] **Step 1: Criar o hook**

Criar `controle-gastos-frontend/src/components/Modal/useModalBehavior.js`:

```javascript
// src/components/Modal/useModalBehavior.js
import { useEffect } from 'react';

/**
 * Trava o scroll do body e confina o foco de Tab/Shift+Tab dentro do modal enquanto ele estiver
 * aberto. Extraído de ModalTransacao.js para reaproveitamento por qualquer modal do design system
 * (ver ADR-022).
 */
export default function useModalBehavior(modalRef) {
  useEffect(() => {
    // Trava scroll do body enquanto modal estiver aberto
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      // Confina Tab dentro do modal (focus trap)
      if (e.key === 'Tab') {
        if (!modalRef.current) return;

        // Encontra todos os elementos focáveis dentro do modal
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab no primeiro elemento → volta para o último
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
        // Tab no último elemento → volta para o primeiro
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, []);
}
```

Esse código é **idêntico** ao `useEffect` que hoje vive dentro de `ModalTransacao.js` — só movido pra
um hook, sem nenhuma mudança de lógica (inclusive o array de dependências `[]` continua vazio, igual
ao original).

- [ ] **Step 2: Reescrever `ModalTransacao.js` pra usar o hook**

Substituir o conteúdo inteiro de
`controle-gastos-frontend/src/components/Modal/ModalTransacao.js` por:

```javascript
// src/components/Modal/ModalTransacao.js
import React, { useRef } from 'react';
import useModalBehavior from './useModalBehavior';
import './ModalTransacao.css';

const ModalTransacao = ({ onClose, children }) => {
  const modalRef = useRef(null);
  useModalBehavior(modalRef);

  return (
    <div className="modal-overlay">
      {/* Não fecha ao clicar no overlay - mantido conforme solicitação do usuário */}
      <div
        className="modal-content"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-close" onClick={onClose} aria-label="Fechar modal">
          X
        </button>
        {children}
      </div>
    </div>
  );
};

export default ModalTransacao;
```

Nenhuma classe CSS muda, nenhum JSX muda além de trocar o `useEffect` inline pela chamada do hook —
`ModalTransacao.css` **não é tocado** nesta task.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Modal/useModalBehavior.js controle-gastos-frontend/src/components/Modal/ModalTransacao.js
git commit -m "refactor(modal): extrai useModalBehavior de ModalTransacao para reaproveitamento"
```

---

### Task 2: Criar `ModalCompacto`

**Files:**
- Create: `controle-gastos-frontend/src/components/Modal/ModalCompacto.js`
- Create: `controle-gastos-frontend/src/components/Modal/ModalCompacto.css`

**Testabilidade:** não testável — componente novo, ainda não conectado a nenhuma tela (a Task 3 o
conecta).

- [ ] **Step 1: Criar o componente**

Criar `controle-gastos-frontend/src/components/Modal/ModalCompacto.js`:

```javascript
// src/components/Modal/ModalCompacto.js
import React, { useRef } from 'react';
import useModalBehavior from './useModalBehavior';
import './ModalCompacto.css';

const ModalCompacto = ({ onClose, children }) => {
  const modalRef = useRef(null);
  useModalBehavior(modalRef);

  return (
    <div className="modal-compacto-overlay">
      <div
        className="modal-compacto-content"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-compacto-close" onClick={onClose} aria-label="Fechar modal">
          X
        </button>
        {children}
      </div>
    </div>
  );
};

export default ModalCompacto;
```

- [ ] **Step 2: Criar o CSS**

Criar `controle-gastos-frontend/src/components/Modal/ModalCompacto.css`:

```css
/* src/components/Modal/ModalCompacto.css */
.modal-compacto-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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

.modal-compacto-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: var(--cor-primaria);
  color: var(--cor-branca);
  border: none;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.2rem;
  border-radius: 50%;
  transition: all 0.3s ease;
  z-index: 1001;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.modal-compacto-close:hover {
  background: var(--cor-secundaria);
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .modal-compacto-content {
    width: 95vw;
    max-width: 95vw;
  }
}
```

**Importante — não reaproveitar `.modal-close` de `ModalTransacao.css`**: aquele botão usa
`position: fixed; right: calc(5% + 20px)`, uma matemática que só funciona porque `ModalTransacao`
força `width: 90%` centralizado (margem de 5% de cada lado). Como `ModalCompacto` usa
`width: fit-content`, essa margem não existe — por isso `.modal-compacto-close` usa
`position: absolute` (relativo ao `.modal-compacto-content`, que já tem `position: relative`),
ancorado no canto do próprio card, não do viewport. Sem essa diferença, o botão de fechar ficaria
flutuando num lugar errado da tela.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Modal/ModalCompacto.js controle-gastos-frontend/src/components/Modal/ModalCompacto.css
git commit -m "feat(modal): adiciona ModalCompacto, largura de conteudo em vez de 90% forcado"
```

---

### Task 3: Migrar `LinkarRecebimentoModal.js` para `ModalCompacto`

**Files:**
- Modify: `controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js`

**Testabilidade:** tela — `/fechamento`, modal "Linkar Recebimento".

- [ ] **Step 1: Trocar o import e as tags**

Em `controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js`, trocar a linha de
import:

```javascript
import ModalTransacao from '../Modal/ModalTransacao';
```

por:

```javascript
import ModalCompacto from '../Modal/ModalCompacto';
```

E trocar as duas tags JSX (abertura e fechamento) — de:

```javascript
    <ModalTransacao onClose={onClose}>
      <Card variant="glass" padding="md" className="linkar-recebimento-modal">
```
```javascript
      </Card>
    </ModalTransacao>
```

para:

```javascript
    <ModalCompacto onClose={onClose}>
      <Card variant="glass" padding="md" className="linkar-recebimento-modal">
```
```javascript
      </Card>
    </ModalCompacto>
```

Nada mais neste arquivo muda — toda a lógica de fetch/`handleLinkar`/`handleToggleExpandir`
permanece idêntica.

- [ ] **Step 2: Commit**

```bash
git add controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js
git commit -m "feat(fechamento): migra LinkarRecebimentoModal para ModalCompacto"
```

---

### Task 4: Verificação manual — todos os 8 pontos que usam (ou usavam) `ModalTransacao`

**Files:** nenhum (task de verificação, sem código novo).

**Testabilidade:** tela — cobre 8 telas diferentes do app.

Pedido explícito do Alisson: confirmar que a extração do hook (Task 1) não quebrou nenhum dos 7
consumidores que continuam em `ModalTransacao`, e que o `ModalCompacto` novo (Task 2-3) funciona no
1 que migrou. Para cada um dos itens 1-7 abaixo, o roteiro é o mesmo: abrir o modal, digitar em pelo
menos um campo, apertar Tab repetidamente conferindo que o foco não escapa pra fora do modal (focus
trap), fechar. Pra o item 8 (o que migrou), roteiro equivalente mais a conferência visual de que não
sobra espaço vazio ao redor do conteúdo.

- [ ] **Step 1: `LinkarRecebimentoModal` (migrou para `ModalCompacto`)**

1. Abrir `/fechamento`, período "Este Ano", expandir uma pessoa com settlements candidatos, clicar
   "Linkar Recebimento".
2. Confirmar visualmente: o modal encolhe pro tamanho do conteúdo (sem espaço vazio ao redor do
   card), o botão de fechar (X) aparece no canto certo (não flutuando fora do card).
3. Apertar Tab repetidamente — confirmar que o foco cicla entre os elementos do modal (botões "Ver
   detalhe"/"Linkar"/"Fechar"), sem escapar pra página atrás.
4. Fechar com o X.

- [ ] **Step 2: `NovaInstanciaModal` (continua em `ModalTransacao`)**

1. Abrir `/fechamento`, clicar "Nova Instância".
2. Confirmar que o modal abre normalmente, com a largura de sempre (90%, sem mudança visual).
3. Testar Tab dentro do form, confirmar que o foco não escapa.

- [ ] **Step 3: `Transacoes` (continua em `ModalTransacao`)**

1. Abrir `/transacoes`, clicar "+ Nova Transação".
2. Confirmar abertura normal, testar Tab, fechar.

- [ ] **Step 4: `Relatorio` (continua em `ModalTransacao`)**

1. Abrir `/relatorio`, clicar numa transação da lista pra abrir o modal de edição.
2. Confirmar abertura normal, testar Tab, fechar.

- [ ] **Step 5: `Home` (continua em `ModalTransacao`)**

1. Abrir `/` (Home), clicar no botão de nova transação (ação `handleNovaTransacao`).
2. Confirmar abertura normal, testar Tab, fechar.

- [ ] **Step 6: `ContaFixaFormModal` (continua em `ModalTransacao`)**

1. Abrir `/contas-fixas`, clicar em criar ou editar uma conta fixa.
2. Confirmar abertura normal (modal com abas: Principal/Pagamentos/Resumo), testar Tab, fechar.

- [ ] **Step 7: `DetalhesImportacaoPage` (continua em `ModalTransacao`)**

1. Abrir uma importação existente em `/importacao-massa` → detalhe, clicar numa transação da lista
   pra abrir o modal de edição.
2. Confirmar abertura normal, testar Tab, fechar.

- [ ] **Step 8: `TransactionDetailsModal` — nota, sem teste manual**

Este componente importa `ModalTransacao`, mas **não está conectado a nenhuma rota/tela hoje**
(confirmado por busca no código: nenhum outro arquivo o importa/renderiza) — não há como testá-lo
manualmente porque não é alcançável na UI atual. Como `ModalTransacao.js` não muda de comportamento
(Task 1 é extração pura), não há risco de regressão nele; só não dá pra confirmar visualmente por
falta de rota. Registrar essa observação no relatório final, não é um bloqueio desta task.

- [ ] **Step 9: Reportar**

Reportar via `personal-test-report`, usando as tags de testabilidade desta plan (Tasks 1-3: tela ou
não testável, conforme marcado; Task 4: tela) — sem re-inferir a categoria em tempo de execução.
Mencionar explicitamente a observação do Step 8 (`TransactionDetailsModal` sem rota alcançável) no
relatório.
