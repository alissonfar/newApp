---
type: decision
status: active
created: 2026-06-21
tags: [meta, opencode, skills, estratégia]
---

# ADR-005: Estratégia de skills — forçar no prompt vs. deixar agente decidir

## Contexto

Skills no opencode são **carregadas sob demanda** (ver [ADR-004](./2026-06-21-skills-carregadas-sob-demanda.md)). Isso significa que o agente **decide sozinho** se vai carregar uma skill, baseado na descrição que ele vê no início da sessão.

A pergunta que se coloca é: **devemos forçar o carregamento de algumas skills no system prompt, ou confiar no julgamento do agente?**

Após análise, decidimos uma **abordagem mista**: forçar skills críticas (onde esquecer de carregar causaria bug ou feature ruim) e deixar opcionais as demais (onde o benefício é marginal).

## Análise skill por skill

### Skills FORÇADAS no `newapp-executor`

#### `frontend-design` (sempre que mexer em UI)

- **Custo de não carregar:** MÉDIO-ALTO. UI fica sem diretrizes estéticas, vira "mais um app genérico"
- **Risco de esquecer:** ALTO. É tentador pular quando a mudança é "só um CSS pequeno"
- **Decisão:** **FORÇAR** — "sempre que criar ou modificar componente visual, página, tela, modal, layout, ou estilo"
- **Justificativa:** Alisson valoriza estética (ver [ADR-002 de contexto do projeto](./2026-06-21-usar-vault-como-memoria.md)). Improvise design = app genérico.

#### `pluggy-doctor` (ao tocar em código Pluggy)

- **Custo de não carregar:** ALTO. Integração Pluggy/Open Finance é feature crítica do projeto
- **Risco de esquecer:** MÉDIO. O agente pode achar que a mudança é "pequena demais" pra precisar review
- **Decisão:** **FORÇAR** — "ao editar/criar/deletar qualquer arquivo em `backend/src/services/pluggy*`, `backend/src/controllers/pluggy*`, etc"
- **Justificativa:** Pluggy é integração crítica (Open Finance), bugs aqui podem quebrar importação de transações

#### `pluggy-integration` (ao implementar algo NOVO com Pluggy)

- **Custo de não carregar:** MÉDIO. Pode reinventar padrão existente
- **Risco de esquecer:** BAIXO. Geralmente o agente carrega naturalmente ao trabalhar com Pluggy
- **Decisão:** **FORÇAR** (condicional) — "ao implementar algo novo, não precisa se for só ajustar existente"

#### `pluggy-payments` (ao implementar pagamento)

- **Custo de não carregar:** MÉDIO. Padrão de pagamento tem nuances
- **Risco de esquecer:** BAIXO. Raro neste projeto
- **Decisão:** **FORÇAR** (condicional, específica) — "ao implementar PIX, Boleto ou Smart Transfers"

### Skills FORÇADAS no `newapp-planner`

#### `brainstorming` (no modo completo)

- **Custo de não carregar:** ALTO. O modo completo é justamente o que justifica a skill existir
- **Risco de esquecer:** ALTO. Modo completo sem brainstorming = modo completo improvisado
- **Decisão:** **FORÇAR** — "ao entrar no modo completo, carregue ANTES de começar a brainstorm"

#### `find-skills` (ao Alisson pedir algo sem skill instalada)

- **Custo de não carregar:** BAIXO. É uma meta-skill
- **Risco de esquecer:** BAIXO. Só é útil em contexto específico
- **Decisão:** **FORÇAR** (condicional) — "quando Alisson pedir algo que você não tem skill pra cobrir"

### Skills OPCIONAIS (deixar agente decidir)

#### `pluggy-open-finance`

- **Por quê opcional:** É um "contexto" sobre Open Finance, não é mandatório. O agente pode trabalhar com Pluggy sem ela, só não vai ter o "guia de boas práticas"

#### `vercel-react-best-practices`

- **Por quê opcional:** É sobre performance e padrões. Útil, mas raramente crítico no momento da execução

#### `browser-use`

- **Por quê opcional:** Raro no contexto de execução (testes manuais via browser são exceção)

## Decisão final

Adotamos **abordagem mista**:

| Tipo | Quantidade | Justificativa |
|---|---|---|
| **Forçadas** | 4 no executor + 2 no planner | Custo de esquecer é alto (UI ruim, bug crítico, modo completo sem skill) |
| **Opcionais** | 4 no executor | Benefício marginal, confia no julgamento do agente |

**Skills FORÇADAS no executor:**
1. `frontend-design` (sempre que mexer em UI)
2. `pluggy-doctor` (ao tocar em código Pluggy)
3. `pluggy-integration` (ao implementar algo novo com Pluggy)
4. `pluggy-payments` (ao implementar pagamento)

**Skills FORÇADAS no planner:**
1. `brainstorming` (ao entrar no modo completo)
2. `find-skills` (ao Alisson pedir algo sem skill instalada)

**Skills opcionais (executor):**
- `pluggy-open-finance`
- `vercel-react-best-practices`
- `find-skills` (também pro executor, caso Alisson peça)
- `browser-use`

## Consequências

### Pró

- Comportamento previsível nas skills críticas (UI consistente, Pluggy revisado)
- Agente ainda tem autonomia nas skills marginais
- Não força skills em todo canto (custo de prompt controlado)
- Cada skill tem critério claro de "quando carregar"

### Contra

- Prompt fica mais longo (tabela com 4-6 skills por agente)
- Se uma skill "opcional" deveria ser "forçada" e esquecida, o agente não carrega
- Mitigação: revisar reporte do executor — se ele esqueceu de carregar, adicionar como forçada

## Como revisar esta decisão

Após 1-2 meses de uso real:
- Alguma skill "forçada" está sendo subutilizada? → mover pra opcional
- Alguma skill "opcional" foi esquecida e causou problema? → mover pra forçada
- Nova skill crítica apareceu? → adicionar à lista forçada

## Referências

- [ADR-004: skills sob demanda](./2026-06-21-skills-carregadas-sob-demanda.md)
- [ADR-002: sintaxe de permissões](./2026-06-21-sintaxe-permissoes-agentes-opencode.md)
- Agente executor atualizado: `.opencode/agents/newapp-executor.md`
- Agente planner atualizado: `.opencode/agents/newapp-planner.md`
- Stack atualizado: `.brain/context/stack.md`
- Skill instalada: `.agents/skills/find-skills/`
