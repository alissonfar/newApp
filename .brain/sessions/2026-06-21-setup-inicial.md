---
type: session
status: active
created: 2026-06-21
tags: [setup, vault, agentes, fase-0, fase-1]
---

# Sessão: Setup inicial do vault de memória + agentes

## Objetivo

Configurar do zero o sistema de **agentes customizados** (newapp-planner, newapp-executor, newapp-committer) e o **vault de memória de longo prazo** (`.brain/`) para o projeto Controle de Gastos.

Referência: prompt de setup usado no projeto Hub ACOM, com lições aprendidas aplicadas.

## O que rolou

### FASE 0 — Coleta de contexto (via `question`)

Coletadas as seguintes decisões:

| Pergunta | Resposta |
|----------|----------|
| Prefixo dos agentes | `newapp` (newapp-planner, newapp-executor, newapp-committer) |
| Banco de dados | MongoDB (NÃO Supabase) |
| Skill brainstorming | ✅ instalar |
| Skill vercel-react-best-practices | ✅ manter |
| Skill pluggy-* (4 skills) | ✅ já existentes, manter |
| Skill frontend-design | ✅ já existente, manter |
| Skill browser-use | ✅ já existente, manter |
| Skills do Supabase | ❌ NÃO instalar (projeto é MongoDB) |
| Comandos do executor | Conservador: lint + type-check automáticos, test/build manuais |
| Features críticas | Múltiplas (lista abaixo) |
| Princípios auth/multi-tenant | Tratar como GUIA FORTE (não inegociável) — agente pode propor exceções justificadas |
| Features críticas extras | Alisson marcou "tem outras que faltam" mas não listou agora — voltar nisso depois |

### FASE 1.1 — Estrutura de pastas `.brain/`

Criadas as 4 pastas: `decisions/`, `context/`, `sessions/`, `playbooks/`.

### FASE 1.2 — `README.md` do vault

Criado README rico explicando:
- O que é o vault e por que existe
- Como abrir no Obsidian (instruções completas)
- Estrutura de cada pasta com exemplos
- Convenção de frontmatter
- Como o agente lê/escreve
- Regra de ouro: aberto pra evolução

### FASE 1.3 — Notas modelo

Criadas 1 nota em cada pasta:
- `decisions/2026-06-21-usar-vault-como-memoria.md` — ADR explicando a decisão de usar vault
- `context/stack.md` — info estável do projeto (stack backend + frontend + auth + agentes + skills)
- `sessions/2026-06-21-setup-inicial.md` — esta nota
- `playbooks/abrir-vault-no-obsidian.md` — passo a passo

## Decisões tomadas

1. **ADR-001:** usar vault Obsidian em `.brain/` como memória de longo prazo. Documentado em `decisions/2026-06-21-usar-vault-como-memoria.md`.
2. **Prefixo dos agentes:** `newapp`.
3. **Skills:** instalar apenas `brainstorming` (as outras 6 já existem). NÃO instalar Supabase.
4. **Conservador:** executor roda lint + type-check automáticos, test e build manuais.
5. **Auth como guia forte:** agente pode propor exceções se justificadas, mas deve perguntar antes de criar rota pública.
6. **Descoberta importante (FASE 4):** opencode tem 2 tipos de agentes — `primary` (cicláveis com Tab, NÃO aparecem no `@`) e `subagent` (aparecem no `@`, invocáveis diretamente). Alisson decidiu: `newapp-planner` é **primary** (Tab), `newapp-executor` e `newapp-committer` são **subagents** (`@`). Ver [ADR-002](../decisions/2026-06-21-sintaxe-permissoes-agentes-opencode.md) (a ser criado na FASE 5).

## Mudanças aplicadas (paths relativos à raiz do projeto)

```
.brain/
├── README.md                                              [NOVO]
├── decisions/
│   └── 2026-06-21-usar-vault-como-memoria.md              [NOVO]
├── context/
│   └── stack.md                                            [NOVO]
├── sessions/
│   └── 2026-06-21-setup-inicial.md                         [NOVO]
└── playbooks/
    └── abrir-vault-no-obsidian.md                          [NOVO]
```

## Aprendizados

- O projeto é React puro (não Next.js), com CRACO + Tailwind 4 + MUI. Importante pra decidir se `vercel-react-best-practices` faz sentido total (vale mais pelas boas práticas gerais de React).
- O backend não tem script `lint` no `package.json` — precisa decidir se vamos adicionar.
- O projeto tem **5 features críticas provisoriamente identificadas**. Alisson sinalizou que faltam outras. **TODO:** voltar nisso em sessão futura com Alisson.
- O AGENTS.md do projeto já é bem documentado. Pode ser parcialmente migrado/incorporado em `.brain/context/stack.md` (já feito parcialmente).

## Pendências

- [ ] **FASE 1.4:** Alisson precisa abrir o vault no Obsidian e validar visualmente
- [ ] **FASE 2:** Instalar skill `brainstorming`
- [ ] **FASE 3:** Criar os 3 agentes (`newapp-planner`, `newapp-executor`, `newapp-committer`)
- [ ] **FASE 4:** Testar cada agente (planner salva no vault, executor cria arquivo, committer verifica status)
- [ ] **FASE 5:** Consolidação final (ADR de permissões, playbook de criar agente, atualizar stack.md)
- [ ] **FASE 6:** Avaliar se precisa adicionar MCP context7 no `opencode.json`
- [ ] **Futuro:** Voltar nas features críticas faltantes e completar a lista
- [ ] **Futuro:** Decidir se adiciona script `lint` no `backend/package.json`

## Referências

- Prompt de setup usado nesta sessão (input original)
- [ADR-001: usar vault como memória](../decisions/2026-06-21-usar-vault-como-memoria.md)
- [Stack do projeto](../context/stack.md)
- [README do vault](../README.md)
