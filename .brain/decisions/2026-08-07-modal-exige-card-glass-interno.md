---
type: decision
status: active
created: 2026-08-07
tags: [design-system, glassmorphism, modal, frontend]
related:
  - .brain/decisions/2026-06-23-glassmorphism-exige-gradiente-vibrante.md
  - .brain/sessions/2026-08-07-conta-fixa-implementacao-e-fix-visual.md
---

# ADR-018: `ModalTransacao` só fica visualmente correto com um `Card` `glass` interno

## Contexto

Ao construir a tela de Conta Fixa (ver sessão relacionada), o modal de criação/edição (`ContaFixaFormModal.js`) foi montado envolvendo o conteúdo direto em `<ModalTransacao>`, sem nenhum wrapper adicional. Visualmente, o resultado vazava o fundo escuro do overlay por trás dos campos — um efeito "meio transparente"/quebrado, reportado pelo Alisson com print.

Investigação mostrou que **`ModalTransacao.css` (`.modal-content`) só fornece a casca translúcida** (`background: var(--cor-fundo-card)`, que resolve pra `rgba(255,255,255,0.85)` claro / `rgba(15,23,42,0.75)` escuro — sem `backdrop-filter`). Isso por si só não produz um visual "sólido" — é só um vidro fino sem embaçamento, e o ADR-008 já documentava que glass sem gradiente vibrante atrás fica "chapado"/vazando.

O motivo do modal de transação (`NovaTransacaoForm.js`) parecer sólido é que ele **nunca é renderizado direto dentro do `ModalTransacao`** — ele se auto-envolve num `<Card variant="glass" padding="md">` (`src/components/shared/Card.js`). A classe `.cg-card--glass` (`Card.css`) adiciona `backdrop-filter: blur(var(--cg-glass-blur)) saturate(180%)` por cima da translucidez. É o **blur + saturate**, empilhado com a casca translúcida do modal, que produz o efeito "fosco opaco" que lê como sólido.

## Decisão

**Todo conteúdo renderizado dentro de `ModalTransacao` deve se auto-envolver num `<Card variant="glass" padding="md">`** (ou variant equivalente que inclua `backdrop-filter`), replicando a estrutura exata de `NovaTransacaoForm.js`:

```jsx
<ModalTransacao onClose={onClose}>
  <Card variant="glass" padding="md" className="meu-form-card">
    <h2 className="nova-transacao-form-title">...</h2>
    <div className="transacao-tab-content">  {/* scroll interno — ver nota abaixo */}
      ...
    </div>
    <div className="form-buttons">...</div>
  </Card>
</ModalTransacao>
```

CSS mínimo necessário para o `Card` se comportar como container flex dentro do modal (replicado de `.nova-transacao-form-container` em `NovaTransacaoForm.css`):

```css
.meu-form-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.meu-form-card.cg-card:hover {
  transform: none; /* desativa o lift do Card — dentro de um modal, o "pulo" no hover fica estranho */
}
```

Nenhum token novo foi necessário — `--cg-glass-blur`, `--cg-color-surface` e as variantes de `Card` já reagem a `[data-theme="dark"]` automaticamente (ver `theme/tokens.css`).

## Consequências

- **Pró:** modal fica visualmente consistente com o resto do app sem duplicar CSS — reaproveita 100% da infraestrutura de `Card`/tokens já existente.
- **Pró:** correção fica isolada por consumidor (cada tela que usa `ModalTransacao` decide seu próprio `Card` interno) — não precisou alterar `ModalTransacao.css` compartilhado, então não há risco de quebrar o modal de transação real.
- **Contra:** é fácil esquecer esse passo ao criar um novo modal (aconteceu exatamente isso na primeira versão da Conta Fixa) — **checklist criado em `playbooks/criar-tela-consistente-design-system.md`** para mitigar.
- **Nota de scroll:** modais com formulário maior que a altura da tela também precisam do wrapper `.transacao-tab-content` (`flex: 1; overflow-y: auto; min-height: 0`, definido em `TransacaoTabs.css`) por dentro do `Card`, senão o conteúdo abaixo da metade fica inacessível — `.modal-content` tem `overflow: hidden` e não tem scroll próprio. Esse foi um segundo bug real encontrado (não só o visual) na mesma sessão.

## Relacionado

- ADR-008 (glassmorphism exige gradiente vibrante — mesma família de problema, um nível abaixo na composição)
- ADR-007 (MUI/tokens como fonte de verdade)
