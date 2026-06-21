---
type: decision
status: active
created: 2026-06-21
tags: [meta, opencode, agentes, permissões, fonte-da-verdade]
---

# ADR-002: Sintaxe de permissões dos agentes do opencode

## Contexto

Tentamos configurar 3 agentes customizados para o projeto Controle de Gastos (`newapp-planner`, `newapp-executor`, `newapp-committer`) usando permissões no frontmatter YAML. Na primeira tentativa, **o `newapp-executor` não foi reconhecido pelo opencode** — o autocomplete `@` mostrava apenas o committer e os subagents built-in (`explore`, `general`).

Após investigação, descobrimos que o **padrão validado em produção** vem do projeto Hub ACOM. Este ADR documenta a sintaxe CERTA, os anti-padrões que quebram, e o processo de diagnóstico.

## Lições aprendidas

### 1. `mode: primary` vs `mode: subagent` — não afeta o reconhecimento, afeta a UX

- **Primary agents** (cicláveis com Tab): NÃO aparecem no autocomplete `@`
- **Subagents** (invocáveis com `@`): aparecem no autocomplete `@`
- Ambos são reconhecidos e funcionam — só a UX de invocação muda
- Para o Controle de Gastos: `newapp-planner` é primary (Tab), `newapp-executor` e `newapp-committer` são subagents (`@`)

### 2. Anti-padrões que QUEBRAM o reconhecimento

| ❌ NÃO FAÇA | Por quê quebra |
|---|---|
| `permission: edit: "**": deny` (catch-all `**` solto) | O opencode não consegue mesclar allowlist quando há catch-all no mesmo nível |
| `permission: external_directory: "C:\\path\\**"` (string direta) | Precisa ser **objeto** com pattern, não string |
| `permission: edit: deny` + `tools: edit: true` (bloco `tools` legado) | Conflita — o `tools` é deprecated e sobrescreve de forma imprevisível |
| Linhas como `"git log -*: allow` (com `:` dentro da string) | YAML quebra — o `:` fecha a chave prematuramente. Use `"git log -*": allow` |

### 3. Sintaxe VALIDADA em produção (Hub ACOM + Controle de Gastos)

Para um **subagent executor** (escreve no projeto todo):

```yaml
---
description: Executor fullstack do <projeto>. Recebe plano aprovado do <projeto>-planner, aplica mudanças no código, valida com lint+type-check a cada fase. PARA e pergunta via `question` se travar ou se o plano tiver problema.
mode: subagent
model: opencode-go/minimax-m3
permission:
  edit:
    "C:\\PROJETOS\\<projeto>\\**": allow
  write:
    "C:\\PROJETOS\\<projeto>\\**": allow
  bash:
    "npm run lint": allow
    "npm run type-check": allow
    "npm run dev": allow
    "npx tsc*": allow
    "npx eslint*": allow
    "git status*": allow
    "git log*": allow
    "git diff*": allow
    "git show*": allow
    "git branch*": allow
    "ls *": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "wc *": allow
    "mkdir *": allow
    "cp *": allow
    "mv *": allow
    "node -e *": allow
  webfetch: deny
  question: allow
  todowrite: allow
  skill: allow
---
```

Para um **subagent committer** (só git):

```yaml
---
description: Committer do <projeto>. Lê diffs, gera mensagens de commit estruturadas em Conventional Commits (português), e commita após aprovação explícita via `question`. NÃO edita código, NÃO faz push, NÃO reseta histórico.
mode: subagent
model: opencode-go/minimax-m3
permission:
  edit: deny
  write: deny
  bash:
    "*": deny
    "git status": allow
    "git status*": allow
    "git diff": allow
    "git diff*": allow
    "git diff --staged*": allow
    "git log*": allow
    "git show*": allow
    "git branch*": allow
    "git add *": allow
    "git add -A": allow
    "git add -p": allow
    "git commit*": allow
    "ls *": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "wc *": allow
  webfetch: deny
  external_directory:
    "**": deny
    "C:\\PROJETOS\\<projeto>\\**": allow
  question: allow
---
```

Para um **primary agent planner** (escreve só no vault):

```yaml
---
description: Planejamento estruturado com memória persistente no vault .brain/. Use para tarefas que exigem análise, design doc, ou múltiplas alternativas.
mode: primary
model: anthropic/claude-sonnet-4-5
permission:
  edit:
    "C:\\PROJETOS\\<projeto>\\.brain\\**": allow
  write:
    "C:\\PROJETOS\\<projeto>\\.brain\\**": allow
  bash:
    "git status*": allow
    "git log*": allow
    "git diff*": allow
    "git show*": allow
    "git branch*": allow
    "ls *": allow
    "cat *": allow
    "head *": allow
    "tail *": allow
    "wc *": allow
  webfetch: deny
  task: allow
  question: allow
  todowrite: allow
  skill: allow
---
```

## Decisão

Usamos esta sintaxe como **fonte da verdade** para todos os agentes do projeto Controle de Gastos. Qualquer novo agente criado DEVE seguir este padrão, ou o `playbooks/criar-novo-agente.md` (que referencia este ADR).

## Checklist de validação (após criar um agente)

1. **YAML parseia sem erro** — rodar `node -e` com parser ou verificar visualmente
2. **Reinicie o opencode** — agentes são lidos no startup
3. **Subagent:** aparece no autocomplete `@`?
4. **Primary:** aparece ao ciclar com Tab?
5. **Teste de permissão positiva:** peça pro agente fazer algo permitido
6. **Teste de permissão negativa:** peça pro agente fazer algo proibido
7. **Documente no vault:** criar/editar `.opencode/agents/<nome>.md` e atualizar `.brain/context/stack.md`

Se qualquer passo falhar, **revise o YAML contra a seção "Anti-padrões"** deste ADR antes de tentar variações.

## Consequências

### Pró

- 3 agentes funcionando de forma previsível
- Permissões explícitas (whitelist) — o agente só faz o que foi autorizado
- Fácil replicar pra outros projetos (substituir `<projeto>` e o path)

### Contra

- Whitelist verbosa (cada comando bash precisa estar listado)
- Quando o opencode lançar versão nova, sintaxe pode mudar — revalidar este ADR
- Se aparecer um comando novo que o agente precise, tem que editar o YAML e reiniciar

## Referências

- Doc oficial: <https://opencode.ai/docs/agents/>
- Doc permissions: <https://opencode.ai/docs/permissions/>
- Playbook: `../playbooks/criar-novo-agente.md`
- Projeto Hub ACOM (origem desta sintaxe validada)
