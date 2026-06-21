---
type: session
status: active
created: 2026-06-21
tags: [consolidação, vault, agentes, finalização]
---

# Sessão: Consolidação final do setup de vault + agentes

## Objetivo

Documentar no vault todas as decisões, aprendizados e procedimentos surgidos durante o setup completo de vault `.brain/` + 3 agentes (`newapp-planner`, `newapp-executor`, `newapp-committer`) para o projeto Controle de Gastos.

## O que rolou

### FASE 0 — Coleta de contexto

Alisson respondeu às perguntas iniciais via `question`:

| Decisão | Resposta |
|---------|----------|
| Prefixo dos agentes | `newapp` |
| Banco | MongoDB (NÃO Supabase) |
| Skills | brainstorming (instalar) + 6 já existentes (manter); Supabase NÃO |
| Comandos do executor | Conservador: lint + type-check automáticos, test/build manuais |
| Features críticas | Múltiplas (provisoriamente 6; Alisson marcou "tem outras" sem listar) |
| Princípios | Auth/multi-tenant como GUIA FORTE, não dogma |
| Vault location | SÓ a pasta `.brain/` (não a raiz) — Alisson escolheu |

### FASE 1 — Vault `.brain/`

Criadas 4 pastas + 1 README rico + 4 notas modelo:

- `.brain/README.md` (6483 bytes)
- `.brain/decisions/2026-06-21-usar-vault-como-memoria.md` (ADR-001)
- `.brain/context/stack.md` (info estável do projeto)
- `.brain/sessions/2026-06-21-setup-inicial.md` (log inicial)
- `.brain/playbooks/abrir-vault-no-obsidian.md` (passo a passo)

Alisson validou visualmente no Obsidian — viu grafo com nós esperados (incluindo nós "fantasma" de wikilinks planejados, que documentam o roadmap).

### FASE 2 — Skills

Instalada skill `brainstorming` (`.agents/skills/brainstorming/`) — auditoria: Safe, 0 alerts, Low Risk.

Total de skills após FASE 2:
- `.agents/skills/`: `brainstorming`
- `.opencode/skills/`: `browser-use`, `frontend-design`, `pluggy-doctor`, `pluggy-integration`, `pluggy-open-finance`, `pluggy-payments`

### FASE 3 — 3 agentes criados

| Agente | Modo | Função | Status inicial |
|--------|------|--------|----------------|
| `newapp-planner.md` | primary | Planejamento, escreve no vault | YAML OK, mas descoberto que primary não aparece no `@` |
| `newapp-executor.md` | subagent | Execução, edita código | **NÃO RECONHECIDO** na primeira tentativa |
| `newapp-committer.md` | subagent | Commits estruturados | YAML OK |

### FASE 4 — Testes e descoberta crítica

**Teste 1 (planner):** Alisson reiniciou opencode, pressionou Tab até o planner, pediu pra salvar arquivo de teste. **SUCESSO** — arquivo `2026-06-21-teste-permissao.md` criado em `.brain/sessions/`. Permissões do planner OK.

**Teste 2 (executor):** **FALHOU** — `@newapp-executor` não aparecia no autocomplete. Apenas `explore`, `general` (built-ins) e `@newapp-committer` apareciam.

**Investigação:** Alisson trouxe YAML do executor do Hub ACOM como referência. Comparação revelou que a estrutura era praticamente idêntica. Hipótese: o problema não era estrutural, era algum detalhe do YAML.

**Solução:** Recriei o `newapp-executor.md` copiando o padrão do Hub ACOM (model `opencode-go/minimax-m3`, comandos extras como `mkdir`/`cp`/`mv`/`node -e *`, sem `description` no bash whitelist). **SUCESSO** — após reiniciar, `@newapp-executor` apareceu no autocomplete e funcionou.

**Lição aprendida:** a causa exata do problema inicial não foi 100% identificada (provavelmente combinação de `model: anthropic/claude-sonnet-4-5` + ausência de alguns comandos bash), mas a **solução funciona e está documentada no ADR-002**.

**Teste 3 (committer):** Recriado committer com mesmo padrão Hub ACOM. **SUCESSO** — `git status` funcionou, `git push` foi bloqueado. Limitação do PowerShell com `git commit -m -m` foi documentada como ADR-003.

### FASE 5 — Consolidação (esta fase)

Criados 4 artefatos no vault:

1. **ADR-002** — `decisions/2026-06-21-sintaxe-permissoes-agentes-opencode.md` (fonte da verdade de permissões)
2. **ADR-003** — `decisions/2026-06-21-commits-sem-corpo-powershell.md` (decisão consciente sobre limitação PowerShell)
3. **Playbook** — `playbooks/criar-novo-agente.md` (passo a passo pra criar novos agentes)
4. **Esta sessão** — `sessions/2026-06-21-consolidacao-permissoes.md`

Também atualizado `context/stack.md` com info dos agentes criados + skills finais.

### FASE 6 — opencode.json

Já configurado com `context7` (com API key) e `pluggy-mcp`. **Sem mudanças necessárias.**

## Decisões tomadas

1. **ADR-001:** vault Obsidian em `.brain/` como memória de longo prazo
2. **ADR-002:** sintaxe de permissões dos agentes opencode (padrão Hub ACOM, validado)
3. **ADR-003:** commits sem corpo (limitação PowerShell aceita conscientemente)
4. **Estrutura de agentes:** planner como primary (Tab), executor e committer como subagents (`@`)
5. **Vault location:** SÓ `.brain/`, não raiz do projeto
6. **Comandos do executor:** conservador (lint + type-check automáticos)
7. **Auth/multi-tenant:** GUIA FORTE, não dogma — agente pode propor exceções se justificadas

## Mudanças aplicadas

### Vault

```
.brain/
├── README.md
├── decisions/
│   ├── 2026-06-21-usar-vault-como-memoria.md (ADR-001)
│   ├── 2026-06-21-sintaxe-permissoes-agentes-opencode.md (ADR-002) [NOVO]
│   └── 2026-06-21-commits-sem-corpo-powershell.md (ADR-003) [NOVO]
├── context/
│   ├── stack.md [ATUALIZADO com agentes + skills finais]
├── sessions/
│   ├── 2026-06-21-setup-inicial.md
│   ├── 2026-06-21-teste-permissao.md [CRIADO pelo planner]
│   └── 2026-06-21-consolidacao-permissoes.md (esta nota) [NOVO]
└── playbooks/
    ├── abrir-vault-no-obsidian.md
    └── criar-novo-agente.md [NOVO]
```

### Skills

```
.agents/skills/
└── brainstorming/   [INSTALADA via npx]

.opencode/skills/
├── browser-use/             [pré-existente]
├── frontend-design/         [pré-existente]
├── pluggy-doctor/           [pré-existente]
├── pluggy-integration/      [pré-existente]
├── pluggy-open-finance/     [pré-existente]
└── pluggy-payments/         [pré-existente]
```

### Agentes

```
.opencode/agents/
├── newapp-planner.md     (primary, escreve no vault)
├── newapp-executor.md    (subagent, escreve no projeto)
└── newapp-committer.md   (subagent, só git)
```

### Config

```
.opencode/opencode.json [SEM MUDANÇAS — já tinha context7 + pluggy-mcp]
```

## Aprendizados

1. **Sintaxe de permissões é frágil** — YAML válido ≠ comportamento correto. Sempre **teste com ação real** após criar agente.
2. **Padrão Hub ACOM é fonte da verdade** — quando o agente não foi reconhecido, copiar o YAML do Hub ACOM resolveu. **Reutilizar padrões validados > inventar novo**.
3. **Primary vs subagent** — primário aparece com Tab, subagent aparece com `@`. UX diferente, mesmo nível de reconhecimento.
4. **PowerShell quebra `git commit -m -m`** — body de commit não funciona via bash tool. Decisão consciente de manter sem corpo.
5. **Teste negativo é tão importante quanto positivo** — committer tem que **bloquear** `git push`, não só **permitir** `git status`.
6. **Vault como contrato de memória** — sem ele, decisões se perdem entre sessões. Com ele, próximo dev (ou IA) tem contexto completo.

## Pendências (próximas sessões)

- [ ] Alisson voltar nas **features críticas faltantes** e completar a lista em `context/stack.md`
- [ ] Adicionar script `lint` no `backend/package.json` se necessário
- [ ] Primeiro uso real do fluxo: planner → executor → committer, em uma tarefa real
- [ ] Avaliar se o planner precisa de skill `vercel-react-best-practices` carregada por padrão (atualmente só `brainstorming` no modo completo)

## Referências

- [ADR-001: vault como memória](../decisions/2026-06-21-usar-vault-como-memoria.md)
- [ADR-002: sintaxe de permissões](../decisions/2026-06-21-sintaxe-permissoes-agentes-opencode.md)
- [ADR-003: commits sem corpo](../decisions/2026-06-21-commits-sem-corpo-powershell.md)
- [Playbook: criar novo agente](../playbooks/criar-novo-agente.md)
- [Stack do projeto](../context/stack.md)
- [Sessão inicial de setup](./2026-06-21-setup-inicial.md)
- [Teste de permissão do planner](./2026-06-21-teste-permissao.md)
