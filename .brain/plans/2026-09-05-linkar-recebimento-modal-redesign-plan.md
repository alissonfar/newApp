# Redesenho do Modal Linkar Recebimento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use lean-subagent-execution to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No TDD — implement and verify,
> tests are required but not test-first. Each task carries a testability tag (tela / sem tela / não
> testável) — use it, don't re-infer it, when reporting via personal-test-report.

**Goal:** Substituir a linha rasa de cada candidato no modal "Linkar Recebimento" por um card rico
(badges de pessoa, valor aplicado em destaque, detalhe expansível com as transações quitadas), e
alargar o modal, que hoje sobra vazio ao redor de um conteúdo estreito demais.

**Architecture:** Novo componente `SettlementCandidateCard.js` (visualmente irmão de
`FechamentoInstanciaCard.js`, classes CSS próprias) renderizado dentro de `LinkarRecebimentoModal.js`
com um estado de accordion exclusivo (`expandidoId`, só um card expandido por vez). Nenhuma mudança de
backend — todo dado necessário já vem de `listarSettlements` (`pessoas`, `totalApplied`,
`leftoverAmount`, `appliedTransactions[].transactionId`).

**Tech Stack:** React 19, CSS (tokens `--cg-*` do design system), sem testes automatizados
(frontend deste projeto não tem suíte configurada).

Spec completa: `.brain/specs/2026-09-05-linkar-recebimento-modal-redesign-design.md`.

---

### Task 1: Criar `SettlementCandidateCard.js` e seu CSS

**Files:**
- Create: `controle-gastos-frontend/src/components/Fechamento/SettlementCandidateCard.js`
- Create: `controle-gastos-frontend/src/components/Fechamento/SettlementCandidateCard.css`

**Testabilidade:** não testável — componente novo, ainda não conectado a nenhuma tela (a Task 2 o
conecta; a verificação visual real acontece na Task 3).

- [ ] **Step 1: Criar o componente**

Criar `controle-gastos-frontend/src/components/Fechamento/SettlementCandidateCard.js`:

```javascript
// src/components/Fechamento/SettlementCandidateCard.js
import React from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import Card from '../shared/Card';
import Button from '../shared/Button';
import TagBadge from '../../pages/Recebimentos/components/TagBadge';
import './SettlementCandidateCard.css';

function formatMoeda(valor) {
  const n = parseFloat(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(date) {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const SettlementCandidateCard = ({
  settlement,
  pessoaAtual,
  expandido,
  onToggleExpandir,
  onLinkar,
  linkando
}) => {
  const id = settlement._id || settlement.id;
  const pessoas = settlement.pessoas || [];
  const pessoaAtualLower = (pessoaAtual || '').toLowerCase();
  const appliedTransactions = settlement.appliedTransactions || [];

  return (
    <Card variant="glass" padding="md" className="settlement-candidate-card">
      <div className="settlement-candidate-card__top">
        <div className="settlement-candidate-card__pessoas">
          {pessoas.map((nome) => (
            <span
              key={nome}
              className={
                'settlement-candidate-card__pessoa-badge' +
                (nome.toLowerCase() === pessoaAtualLower ? ' settlement-candidate-card__pessoa-badge--atual' : '')
              }
            >
              {nome}
            </span>
          ))}
        </div>
        <div className="settlement-candidate-card__valores">
          <span className="settlement-candidate-card__valor-principal">
            {formatMoeda(settlement.totalApplied)}
          </span>
          {settlement.leftoverAmount > 0 && (
            <span className="settlement-candidate-card__valor-sobra">
              + {formatMoeda(settlement.leftoverAmount)} de sobra
            </span>
          )}
        </div>
      </div>

      <p className="settlement-candidate-card__desc">
        {settlement.receivingTransactionId?.descricao}
      </p>
      <p className="settlement-candidate-card__meta">
        {new Date(settlement.createdAt).toLocaleDateString('pt-BR')} · {appliedTransactions.length} transações quitadas
      </p>

      {expandido && (
        <div className="settlement-candidate-card__detail">
          {appliedTransactions.length === 0 ? (
            <p className="settlement-candidate-card__detail-empty">Nenhuma transação quitada registrada.</p>
          ) : (
            <table className="settlement-candidate-card__tx-table">
              <thead><tr><th>Data</th><th>Descrição</th><th>Valor aplicado</th></tr></thead>
              <tbody>
                {appliedTransactions.map((at, i) => (
                  <tr key={i}>
                    <td>{formatData(at.transactionId?.data)}</td>
                    <td>{at.transactionId?.descricao || 'N/A'}</td>
                    <td>{formatMoeda(at.amountApplied)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {settlement.tagId && (
            <div className="settlement-candidate-card__tag">
              <TagBadge tag={settlement.tagId} size={14} />
            </div>
          )}
        </div>
      )}

      <div className="settlement-candidate-card__actions">
        <Button variant="ghost" size="sm" onClick={() => onToggleExpandir(id)}>
          {expandido ? <FaChevronUp /> : <FaChevronDown />} {expandido ? 'Recolher' : 'Ver detalhe'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={linkando}
          onClick={() => onLinkar(id)}
        >
          Linkar
        </Button>
      </div>
    </Card>
  );
};

export default SettlementCandidateCard;
```

- [ ] **Step 2: Criar o CSS**

Criar `controle-gastos-frontend/src/components/Fechamento/SettlementCandidateCard.css`:

```css
/* src/components/Fechamento/SettlementCandidateCard.css */
.settlement-candidate-card {
  display: flex;
  flex-direction: column;
  gap: var(--cg-spacing-sm);
  margin-bottom: var(--cg-spacing-base);
}

.settlement-candidate-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--cg-spacing-md);
}

.settlement-candidate-card__pessoas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.settlement-candidate-card__pessoa-badge {
  padding: 3px 10px;
  border-radius: var(--cg-radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--cg-color-border);
  color: var(--cg-color-text-secondary);
}

.settlement-candidate-card__pessoa-badge--atual {
  background: var(--cg-color-primary-muted);
  color: var(--cg-color-primary);
}

.settlement-candidate-card__valores {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.settlement-candidate-card__valor-principal {
  font-size: 1.375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--cg-color-text-primary);
}

.settlement-candidate-card__valor-sobra {
  font-size: 0.75rem;
  color: var(--cg-color-text-muted);
}

.settlement-candidate-card__desc {
  margin: 0;
  font-size: 0.875rem;
  color: var(--cg-color-text-primary);
}

.settlement-candidate-card__meta {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--cg-color-text-muted);
}

.settlement-candidate-card__detail {
  border-top: 1px solid var(--cg-color-border);
  padding-top: var(--cg-spacing-sm);
}

.settlement-candidate-card__detail-empty {
  color: var(--cg-color-text-muted);
  font-size: 0.875rem;
  margin: 0;
}

.settlement-candidate-card__tx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.settlement-candidate-card__tx-table thead th {
  text-align: left;
  background: var(--cg-color-thead-bg);
  color: var(--cg-color-text-muted);
  font-weight: 600;
  font-size: 0.6875rem;
  text-transform: uppercase;
  padding: 8px 10px;
}

.settlement-candidate-card__tx-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--cg-color-border);
  color: var(--cg-color-text-primary);
}

.settlement-candidate-card__tag {
  margin-top: var(--cg-spacing-sm);
}

.settlement-candidate-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Fechamento/SettlementCandidateCard.js controle-gastos-frontend/src/components/Fechamento/SettlementCandidateCard.css
git commit -m "feat(fechamento): adiciona SettlementCandidateCard, card rico pro modal de linkar recebimento"
```

---

### Task 2: Conectar o novo card em `LinkarRecebimentoModal.js` e alargar o modal

**Files:**
- Modify: `controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js` (arquivo
  inteiro — reescrita completa, ele é pequeno)
- Modify: `controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.css` (arquivo
  inteiro — reescrita completa)

**Testabilidade:** tela — `/fechamento`, modal "Linkar Recebimento".

- [ ] **Step 1: Reescrever `LinkarRecebimentoModal.js`**

Substituir o conteúdo inteiro de
`controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js` por:

```javascript
// src/components/Fechamento/LinkarRecebimentoModal.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import ModalTransacao from '../Modal/ModalTransacao';
import Card from '../shared/Card';
import Button from '../shared/Button';
import SettlementCandidateCard from './SettlementCandidateCard';
import { listarSettlements } from '../../api';
import './LinkarRecebimentoModal.css';

const LinkarRecebimentoModal = ({ instancia, onClose, onLinkar }) => {
  const [settlements, setSettlements] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [linkando, setLinkando] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);

  const pessoaNome = instancia.cadastro?.pessoa?.nome;

  useEffect(() => {
    (async () => {
      try {
        const resultado = await listarSettlements({ pessoa: pessoaNome, limit: 20 });
        setSettlements(resultado.items || []);
      } catch (err) {
        toast.error(err.message || 'Erro ao listar conciliações.');
      } finally {
        setCarregando(false);
      }
    })();
  }, [pessoaNome]);

  const handleLinkar = async (settlementId) => {
    setLinkando(settlementId);
    try {
      await onLinkar(instancia._id, settlementId);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao linkar recebimento.');
    } finally {
      setLinkando(null);
    }
  };

  const handleToggleExpandir = (settlementId) => {
    setExpandidoId((atual) => (atual === settlementId ? null : settlementId));
  };

  return (
    <ModalTransacao onClose={onClose}>
      <Card variant="glass" padding="md" className="linkar-recebimento-modal">
        <h2 className="linkar-recebimento-modal__title">Linkar Recebimento — {pessoaNome}</h2>

        {carregando && <p>Carregando conciliações...</p>}
        {!carregando && settlements.length === 0 && (
          <p className="linkar-recebimento-modal__empty">
            Nenhuma conciliação encontrada para esta pessoa. Crie uma em "Recebimentos &gt; Nova Conciliação".
          </p>
        )}
        {!carregando && settlements.map((s) => (
          <SettlementCandidateCard
            key={s._id || s.id}
            settlement={s}
            pessoaAtual={pessoaNome}
            expandido={expandidoId === (s._id || s.id)}
            onToggleExpandir={handleToggleExpandir}
            onLinkar={handleLinkar}
            linkando={linkando === (s._id || s.id)}
          />
        ))}

        <div className="linkar-recebimento-modal__actions">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </Card>
    </ModalTransacao>
  );
};

export default LinkarRecebimentoModal;
```

Mudanças em relação ao original: removido o `formatMoeda` local e o `.map()` inline (agora dentro de
`SettlementCandidateCard`); adicionado `expandidoId` (accordion exclusivo — abrir um fecha o anterior,
por isso é um único valor, não um array/Set) e `handleToggleExpandir`; import de
`SettlementCandidateCard`. O resto (fetch de `listarSettlements`, `handleLinkar`, `onClose`) é
idêntico ao original.

- [ ] **Step 2: Reescrever `LinkarRecebimentoModal.css`**

Substituir o conteúdo inteiro de
`controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.css` por:

```css
/* src/components/Fechamento/LinkarRecebimentoModal.css */
.linkar-recebimento-modal {
  width: min(680px, 92vw);
  max-height: 80vh;
  overflow-y: auto;
}

.linkar-recebimento-modal__title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0 0 var(--cg-spacing-base);
  color: var(--cg-color-text-primary);
}

.linkar-recebimento-modal__empty {
  color: var(--cg-color-text-muted);
  font-size: 0.875rem;
}

.linkar-recebimento-modal__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--cg-spacing-base);
}
```

Duas mudanças: a largura sobe de `min(480px, 90vw)` pra `min(680px, 92vw)` (a melhoria pedida); e
`max-height: 80vh; overflow-y: auto;` é adicionado — necessário porque `.modal-content` (a casca do
`ModalTransacao`) tem `overflow: hidden` sem scroll próprio, e os novos cards são bem mais altos que a
linha antiga (com o detalhe expandido, um card sozinho pode passar de 300px) — sem esse scroll interno,
uma lista de vários candidatos expandíveis ficaria cortada e inacessível abaixo da metade da tela
(mesmo problema documentado no ADR-018 pra outros modais). As classes `.linkar-recebimento-modal__item`,
`__desc` e `__meta` do arquivo original são removidas — não são mais usadas, esse conteúdo agora mora
em `SettlementCandidateCard.css`.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.js controle-gastos-frontend/src/components/Fechamento/LinkarRecebimentoModal.css
git commit -m "feat(fechamento): modal Linkar Recebimento usa SettlementCandidateCard e fica mais largo"
```

---

### Task 3: Verificação manual fim-a-fim

**Files:** nenhum (task de verificação, sem código novo).

**Testabilidade:** tela — `/fechamento`, modal "Linkar Recebimento".

- [ ] **Step 1: Abrir o modal e conferir o layout novo**

1. Abrir `/fechamento`, período "Este Ano" (ou o período que tiver instâncias com settlements
   candidatos reais — ex: a pessoa "Cleia", que já tem conciliações candidatas desde o fix anterior).
2. Expandir o card da pessoa, clicar "Linkar Recebimento".
3. Confirmar visualmente: o modal está mais largo que antes (não mais uma coluna estreita com muito
   espaço vazio ao redor); cada candidato mostra badge(s) de pessoa (a pessoa atual destacada visualmente
   das demais, se o settlement cobrir mais de uma), valor aplicado em destaque (fonte grande), e — se
   houver sobra registrada em algum candidato — a linha "+ R$X de sobra".

- [ ] **Step 2: Conferir o accordion exclusivo**

1. Clicar "Ver detalhe" num candidato — confirmar que expande mostrando a tabela de transações
   quitadas (Data/Descrição/Valor aplicado) e, se houver tag aplicada, o badge da tag.
2. Clicar "Ver detalhe" num segundo candidato — confirmar que o primeiro **recolhe automaticamente**
   (só um expandido por vez).
3. Se a lista for longa o bastante para passar da altura do modal, rolar dentro do modal e confirmar
   que o scroll interno funciona (não corta conteúdo).

- [ ] **Step 3: Conferir que "Linkar" continua funcionando**

1. Clicar "Linkar" num candidato compatível.
2. Confirmar que o modal fecha e o card da instância na tela principal passa a mostrar "Recebido"
   (mesmo comportamento já verificado no fix anterior — esta task não muda a lógica de linkar, só a
   apresentação).

- [ ] **Step 4: Reportar**

Reportar via `personal-test-report`, usando as tags de testabilidade desta plan (Task 1: não
testável; Tasks 2-3: tela) — sem re-inferir a categoria em tempo de execução.
