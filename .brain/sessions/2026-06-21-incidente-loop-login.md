---
type: incident
status: resolved
created: 2026-06-21
tags: [emprestimos, bug, auth, race-condition, hotfix]
---

# Incidente: Loop de login após refatoração de Empréstimos

> Bug grave detectado **imediatamente após** a refatoração do módulo de Empréstimos. **Status: RESOLVIDO em 2026-06-21 (mesmo dia)**.

## Resumo

Usuário tentou logar na aplicação. Após o login, o app **deslogava imediatamente e redirecionava para `/login`**, entrando em loop. O erro no console:

```
Erro ao carregar dados iniciais (categorias/tags): Error: Token não fornecido.
    apiRequest api.js:43
    obterCategorias api.js:51
    fetchData DataContext.js:31
```

## Causa raiz

A refatoração de Empréstimos (FASE 4) adicionou uma função `apiRequest` em `controle-gastos-frontend/src/api.js` que substituía `fetch` em 64 chamadas. O `apiRequest` detectava respostas 401 e automaticamente:
1. Removia o token do `localStorage`.
2. Redirecionava para `/login` via `window.location.href`.

**Combinado com uma race condition pré-existente** entre `AuthContext` e `DataContext`:
- Ambos têm `useEffect` que dependem de `token`.
- `AuthContext` salva o token no `localStorage` em um useEffect.
- `DataContext` lê o `localStorage` em outro useEffect.
- **Se o `DataContext` rodar antes do `AuthContext` terminar de escrever no `localStorage`, o token está vazio** e o backend retorna 401.
- **Antes da refatoração:** 401 era só um erro capturado pelo `DataContext` e mostrado como toast. App continuava funcionando.
- **Depois da refatoração:** 401 causava `localStorage.removeItem('token')` + `window.location.href = '/login'`. **Loop infinito.**

Adicionalmente, havia **duplo tratamento de 401** entre o `apiRequest` (fetch) e o `services/api.js` (axios, linhas 17-29) — ambos faziam a mesma coisa.

## Resolução

**Opção A aplicada** (reverter `apiRequest`):

- Substituído `apiRequest(...)` por `fetch(...)` em todas as 64 chamadas via substituição global.
- Removida a definição da função `apiRequest` (após a substituição, ela havia se tornado `function fetch(...)` que sobrescrevia a função global — corrigido).
- Import `api` (axios) preservado, ainda usado em `obterTagInsights` (linha 195).

## Validação

| Validação | Resultado |
|---|---|
| `npm run build` (frontend) | ✅ Compiled successfully |
| `npm test --testPathPattern="emprestimo"` (backend) | ✅ 44/44 testes passando |

## O que mudou em `api.js` (diff resumido)

```diff
- async function apiRequest(url, options = {}) {
-   const resposta = await fetch(url, options);
-   if (resposta.status === 401) {
-     // limpa token e redireciona
-   }
-   return resposta;
- }

- const resposta = await apiRequest(url, { headers: getHeaders(false) });
+ const resposta = await fetch(url, { headers: getHeaders(false) });
```

(64 ocorrências do segundo padrão, todas revertidas.)

## Pendências (não-bloqueantes)

1. **Bloco 7 #33 (tratamento 401 em `api.js`):** foi **abandonado** nesta rodada. A feature (tratamento automático de 401 + redirect) **não é trivial** — precisa de:
   - Investigar e corrigir a race condition `AuthContext` ↔ `DataContext`.
   - Coordenar o duplo interceptor (fetch + axios) para não duplicar lógica.
   - Adicionar testes para garantir que 401 não desloga o usuário durante carga inicial.
   - Tratar como rodada futura dedicada.

2. **Race condition `AuthContext` ↔ `DataContext`:** continua existindo. Em condições normais (token válido e salvo antes do `DataContext` ler), não causa problema. Mas pode gerar erros esporádicos (toast de "Falha ao carregar dados essenciais") em conexões lentas. Documentar para rodada futura.

3. **Validação manual do fix:** Alisson precisa **limpar o `localStorage`** do navegador (token antigo pode ter sido salvo com versão diferente do código) e testar o login novamente.

## Aprendizados

1. **A função `apiRequest` não deveria ter sido implementada sem coordenar com o `services/api.js`.** O interceptor de 401 já existia no axios. Adicionar o mesmo comportamento no fetch criou duplicação + race condition.

2. **Mudanças em camadas transversais (auth, interceptors) precisam de teste manual antes de "funciona em minha máquina".** O executor passou nos 44 testes de Empréstimo e no build, mas o app quebrou no primeiro login real.

3. **Substituição global de strings (sed/PowerShell `-replace`) pode ser traiçoeira.** A regex `\bapiRequest\b` pegou a definição da função também, transformando-a em `function fetch` (que sobrescrevia o `fetch` global e teria causado `ReferenceError` em runtime). Por isso, é sempre importante revisar o resultado e validar com build.

## Próximos passos para Alisson

1. **Limpar `localStorage` do navegador** (DevTools → Application → Local Storage → Clear).
2. **Fazer login novamente** e verificar se o app funciona.
3. **Re-rodar o checklist de validação manual** da pós-execução (`2026-06-21-emprestimos-pos-execucao.md`).
4. **Considerar se Bloco 7 #33 ainda faz sentido** — provavelmente sim, mas precisa de redesign cuidadoso.
