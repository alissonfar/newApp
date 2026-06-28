---
type: design-doc
status: approved
created: 2026-06-28
tags: [bugfix, race-condition, auth, frontend]
related: [.brain/sessions/2026-06-21-incidente-loop-login.md]
---

# Fix: race condition 401 "Token não fornecido" no carregamento inicial

## Problema

Sintoma reportado por Alisson em 2026-06-28:
- Ao abrir a página pela primeira vez, o console mostra:
  - `Resposta inválida em obterCategorias: 401 { erro: "Token não fornecido." }`
  - `Resposta inválida em obterTags: 401 { erro: "Token não fornecido." }`
  - `Erro ao carregar dados iniciais (categorias/tags): Error: Token não fornecido.`
- Categorias e tags **não carregam** nesse primeiro load.

## Causa raiz

O `DataContext` (src/context/DataContext.js) dispara `obterCategorias` e `obterTags` via `useEffect` quando `token` muda ou `carregando` muda. Esses dois valores vêm do `AuthContext`.

Em **React 19 com `StrictMode` ativo** (ver src/index.js linha 17), cada componente monta duas vezes em dev. A sequência problemática é:

1. **1ª montagem do `AuthContext`:**
   - `useState(localStorage.getItem('token') || '')` → token preenchido
   - `useEffect` (linha 32) roda → chama `/usuarios/perfil` com `setCarregando(true)`

2. **Cleanup + remontagem (StrictMode):**
   - O React aborta o effect e remonta.
   - A primeira chamada `/usuarios/perfil` pode ter falhado (cleanup do abort), e nesse caso rodou `setToken('')` na linha 48.
   - OU o `finally` rodou `setCarregando(false)` antes do abort.

3. **Janela de race:**
   - O `useEffect` do `DataContext` re-roda porque `carregando` mudou.
   - O `api.js` faz `getToken()` lendo o `localStorage` **no momento do fetch** (não o state do React).
   - Se o token foi limpo entre o `useState` inicial e o `fetch`, o header `Authorization` não é enviado → 401.

O `getToken()` em `api.js` (linha 7-9) lê o `localStorage` direto, então ele pode ver um estado diferente do `useState` do React — essa é a fonte da inconsistência.

## Solução aprovada

**Guard no `api.js`** — cirúrgico, 2 linhas alteradas.

Em `obterCategorias` e `obterTags`, antes de chamar `fetch`:

```js
if (!getToken()) return [];
```

### Por que essa abordagem

- **Não muda o fluxo do React** — não precisa mexer em `DataContext`, `AuthContext`, providers, refs ou effects.
- **Defensivo em qualquer cenário** — não só StrictMode, mas também logout, token expirado, race em troca de abas, etc.
- **Comportamento silencioso é o correto** — sem token não há o que buscar. Sem toast, sem erro, sem log ruidoso.
- **Auto-corrige no próximo frame** — o `useEffect` do `DataContext` re-roda quando `token` muda, e aí busca os dados reais.

### Por que NÃO refatorar o `useEffect` do `DataContext`

- Mais código, mais superfície de bug.
- A causa raiz é que `getToken()` lê fonte diferente do `useState` do React — corrigir isso em todo lugar é maior que uma guarda pontual.
- A guarda também ajuda em outros cenários (refresh manual, troca de usuário, etc).

## Plano de execução

1. Editar `controle-gastos-frontend/src/api.js`:
   - Função `obterCategorias` (linha 25): adicionar `if (!getToken()) return [];` no início, antes do `fetch`.
   - Função `obterTags` (linha 117): mesma alteração.
2. Não tocar em `DataContext.js`, `AuthContext.js`, backend, ou outros arquivos.
3. Testar manualmente:
   - Abrir a página → não deve mais aparecer 401 no console.
   - Categorias e tags devem carregar normalmente após o `carregando` terminar.
   - Logout → categorias/tags ficam `[]` (já era o comportamento).

## Pontos de atenção

- O toast `"Falha ao carregar dados essenciais (categorias/tags)"` (DataContext linha 40) **deixa de aparecer** quando não há token. Isso é correto — sem token não é falha, é estado não-autenticado.
- `obterTagInsights` (linha 170) usa axios via `services/api.js` — não afetado.
- O fix é silencioso em prod também, mas em prod não há StrictMode duplicando effects. Mesmo se ocorrer token-vazio (ex: cookie expirado, logout em outra aba), retornar `[]` é o mais defensivo.
- Categoria/tag insights não tem o mesmo guard — mas como ela só é chamada por ação do usuário (não em load inicial), não precisa.

## Não-objetivos

- Não estamos refatorando o sistema de auth.
- Não estamos adicionando refresh token automático.
- Não estamos trocando `fetch` por axios nas categorias/tags.
- Não estamos mexendo no backend.
