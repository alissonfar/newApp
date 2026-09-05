---
type: playbook
status: active
created: 2026-09-05
tags: [modal, acessibilidade, react-select, frontend]
related:
  - .brain/decisions/2026-09-05-modal-compacto-vs-modal-transacao.md
---

# Dois problemas recorrentes ao criar/migrar um modal (`ModalTransacao`/`ModalCompacto`)

## 1. Focus-trap não prende o foco se nada foi focado ao abrir

**Sintoma**: o modal abre normalmente, mas depois de alguns `Tab`, o foco escapa pra página de trás.

**Causa**: `useModalBehavior` (hook compartilhado pelos dois modais, em
`src/components/Modal/useModalBehavior.js`) só intercepta o `Tab` quando o elemento **já focado** é
o primeiro ou o último elemento focável dentro do modal. Se o clique que abriu o modal deixou o foco
no botão de fora (comportamento padrão do browser — abrir um modal não move o foco sozinho), o Tab
nunca é interceptado até o foco eventualmente (por acaso, seguindo a ordem do DOM) cair num desses
dois extremos — e pode nunca cair, escapando primeiro.

**Correção já aplicada** (`ModalTransacao.js` e `ModalCompacto.js`, commit `dd238313`): o container
do modal recebe `tabIndex={-1}` (focável via script, fora da ordem natural de Tab) e
`useModalBehavior` chama `modalRef.current?.focus()` logo no mount. CSS correspondente:
`outline: none` no container (o foco é funcional, não precisa de anel visível ao redor da caixa
inteira). **Se você criar um terceiro modal no futuro reaproveitando `useModalBehavior`, só precisa
lembrar de dar `tabIndex={-1}` ao elemento que recebe o `ref`** — o resto já vem pronto do hook.

## 2. `react-select` corta o menu dentro de um modal com `overflow: hidden`

**Sintoma**: um `<Select>` (react-select) dentro do modal abre o dropdown, mas as últimas opções
ficam cortadas na borda do modal, mesmo com espaço de sobra na tela.

**Causa**: `.modal-compacto-content` (e também `.modal-content` de `ModalTransacao`) usa
`overflow: hidden` (necessário pra evitar scroll duplicado — ver ADR-025) — mas o menu do
`react-select` é um elemento posicionado *dentro* dessa árvore por padrão, então fica sujeito ao
clipping do container pai sempre que o campo está perto do fim do conteúdo visível.

**Correção**: usar as props do `react-select` que renderizam o menu via portal, fora da árvore do
modal:

```jsx
<Select
  ...
  menuPortalTarget={document.body}
  menuPosition="fixed"
  styles={{ menuPortal: (base) => ({ ...base, zIndex: 1100 }) }}
/>
```

O `zIndex: 1100` importa — precisa ficar acima do `z-index` do overlay/botão de fechar dos modais
(`1000`/`1001`), senão o menu abre atrás do modal. Aplicado em `NovaInstanciaModal.js` (campos
Pessoa e Modelo de Relatório).

**Quando isso importa**: só em modais que usam `ModalCompacto`/`ModalTransacao` **e** têm um
`react-select` perto do fim do conteúdo visível (campo de baixo, ou modal curto). Um select bem no
topo do formulário raramente esbarra nisso, porque o menu abre pra baixo com espaço de sobra antes de
alcançar a borda do container.
