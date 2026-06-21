---
type: playbook
status: active
created: 2026-06-21
tags: [procedimento, opencode, agentes, criar]
---

# Como criar um novo agente opencode

> **Quando usar:** sempre que precisar adicionar um agente customizado ao projeto (ex: `newapp-reviewer`, `newapp-debugger`, etc).

## Pré-requisitos

- Ler o ADR de sintaxe validada: [`../decisions/2026-06-21-sintaxe-permissoes-agentes-opencode.md`](../decisions/2026-06-21-sintaxe-permissoes-agentes-opencode.md)
- Decidir o **nome** do agente (kebab-case, sem espaços): ex: `newapp-reviewer`
- Decidir o **modo**:
  - `primary` (aparece ao ciclar com Tab; substitui Build/Plan padrão)
  - `subagent` (aparece no autocomplete `@`; invocável diretamente)
- Decidir o **escopo de permissão** (o que o agente pode fazer)

## Passo a passo

### 1. Criar o arquivo `.opencode/agents/<nome>.md`

O caminho é **sempre** `.opencode/agents/` (não outro lugar). O opencode lê apenas desta pasta.

### 2. Frontmatter YAML

Copie o template validado do ADR-002 e adapte:

#### Se for um subagent executor (escreve no projeto)

```yaml
---
description: <descrição curta e clara, em 1 linha>
mode: subagent
model: opencode-go/minimax-m3
permission:
  edit:
    "C:\\PROJETOS\\newApp\\**": allow
  write:
    "C:\\PROJETOS\\newApp\\**": allow
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

#### Se for um subagent committer (só git)

```yaml
---
description: <descrição curta e clara>
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
    "C:\\PROJETOS\\newApp\\**": allow
  question: allow
---
```

#### Se for um primary agent (escreve só no vault)

```yaml
---
description: <descrição curta e clara>
mode: primary
model: anthropic/claude-sonnet-4-5
permission:
  edit:
    "C:\\PROJETOS\\newApp\\.brain\\**": allow
  write:
    "C:\\PROJETOS\\newApp\\.brain\\**": allow
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

### 3. Body do system prompt (markdown)

Após o `---` de fechamento, escreva o system prompt do agente em markdown. Estrutura recomendada:

```markdown
# <nome-do-agente>

Você é o **<nome-do-agente>**, <papel em 1 frase>.

## Sobre quem você está respondendo

[Contexto do Alisson — copiar/adaptar de newapp-planner.md]

## Sobre o projeto

[Contexto do projeto Controle de Gastos]

## Tools disponíveis

[Tabela com tools e permissões]

## Comportamento

[Regras de comportamento]

## [Seções específicas do agente]

[Ex: "Quando delegar", "Mapeamento de fluxos", "Formato de commit"]
```

### 4. Reiniciar o opencode

**OBRIGATÓRIO.** O opencode só lê os arquivos de agentes no startup. Sem reiniciar, o novo agente NÃO será reconhecido.

### 5. Testar (checklist obrigatório)

Execute TODOS estes testes antes de considerar o agente pronto:

- [ ] **YAML válido:** o frontmatter parseia sem erro (verificar visualmente ou com parser)
- [ ] **Reinicie o opencode**
- [ ] **Aparece no lugar certo:** se `primary`, aparece ao ciclar com Tab. Se `subagent`, aparece no autocomplete `@`
- [ ] **Permissão positiva:** peça pro agente fazer algo permitido (deve funcionar)
- [ ] **Permissão negativa:** peça pro agente fazer algo proibido (deve bloquear)
- [ ] **Não conflita com outros agentes:** verifique que permissões não vazam (ex: committer não deve conseguir editar código)

### 6. Documentar no vault

Após o agente estar funcionando:

- Atualize `.brain/context/stack.md` com o novo agente (seção "Agentes configurados")
- Se for uma decisão arquitetural nova (ex: novo modo, novo padrão), crie um ADR em `.brain/decisions/`
- Adicione o agente a este playbook se for um novo padrão reutilizável

## Anti-padrões (NÃO FAÇA)

| ❌ NÃO FAÇA | Por quê quebra |
|---|---|
| `permission: edit: "**": deny` (catch-all solto) | Quebra o merge de allowlist |
| `permission: external_directory: "C:\\path"` (string direta) | Precisa ser objeto com pattern |
| `permission: edit: deny` + `tools: edit: true` (bloco tools legado) | Conflita com `permission` moderno |
| `permission.bash` com `:` dentro da string (ex: `"git log -*: allow`) | YAML quebra — use `"git log -*": allow` |
| Usar `**` no path absoluto (ex: `"C:\\PROJETOS\\**": allow`) | Permite acesso a outros projetos no mesmo path |
| Esquecer de reiniciar o opencode | Agente não é reconhecido |
| Não testar permissão negativa | Risco de segurança — agente pode fazer o que não deve |

## Exemplos reais deste projeto

- `.opencode/agents/newapp-planner.md` — primary agent, escreve no vault
- `.opencode/agents/newapp-executor.md` — subagent, escreve no projeto
- `.opencode/agents/newapp-committer.md` — subagent, só git

## Troubleshooting

### "Criei o agente mas ele não aparece no autocomplete"

1. Você reiniciou o opencode? (mais comum)
2. O YAML está válido? (testar com parser)
3. O `mode` está correto? (primary = Tab, subagent = @)
4. Tem algum caracter invisível estranho (BOM, etc)?

### "O agente aparece mas dá permission denied em tudo"

1. Você colocou o `**` (com aspas) corretamente? (ver seção "Anti-padrões")
2. O path absoluto está correto? (case-sensitive em alguns SOs)
3. Tem `*` catch-all conflitando com allowlist específica?

### "O agente consegue fazer coisas que não deveria"

1. Você adicionou `*` no bash? (NUNCA)
2. Você esqueceu de colocar `deny` no `edit`/`write`?
3. Você não tem `external_directory` bloqueando paths fora do projeto?

## Referências

- [ADR-002: sintaxe de permissões](../decisions/2026-06-21-sintaxe-permissoes-agentes-opencode.md) — **fonte da verdade**
- [ADR-003: commits sem corpo (PowerShell)](../decisions/2026-06-21-commits-sem-corpo-powershell.md)
- [Doc oficial opencode](https://opencode.ai/docs/agents/)
- Agentes existentes: `.opencode/agents/`
