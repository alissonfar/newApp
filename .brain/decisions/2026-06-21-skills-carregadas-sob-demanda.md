---
type: decision
status: active
created: 2026-06-21
tags: [meta, opencode, skills, correção]
---

# ADR-004: Skills são carregadas sob demanda, não injetadas automaticamente

## Contexto

Ao documentar os agentes `newapp-executor` e `newapp-planner` durante a FASE 3 do setup, escrevi errado que "skills são carregadas automaticamente em todo plano" e "6 técnicas já são padrão". Isso foi baseado em suposição, não na doc oficial do opencode.

Alisson percebeu que a skill `brainstorming` não foi injetada automaticamente na sua sessão do planner e questionou. Ao consultar a doc oficial (`https://opencode.ai/docs/skills/`), descobri o comportamento real.

## Comportamento real (validado pela doc oficial)

1. **No início de cada sessão**, o opencode injeta no contexto do agente uma **lista resumida** das skills disponíveis (apenas `name` + `description`, ~100 chars por skill)
2. **O agente decide sozinho** se deve carregar uma skill (chamando a tool `skill` com o nome)
3. **Aí sim** o conteúdo completo da `SKILL.md` é carregado no contexto
4. **Custo:** ~100 chars por skill na lista inicial, conteúdo completo só carrega se o agente decidir usar

## O que isso significa na prática

### O usuário (Alisson) NÃO precisa fazer nada

- Não precisa digitar `@loadskill` nem nada do tipo
- Não precisa pedir pro agente "use a skill X"
- O opencode **automaticamente** dá ao agente a lista de skills no início

### O agente decide sozinho

- Vê a lista de skills
- Avalia se a tarefa atual precisa de uma skill específica
- Se sim, chama `skill({ name: "X" })` e carrega o conteúdo
- Segue usando o conteúdo carregado

### Nem toda skill é sempre útil

- O `newapp-committer` raramente precisa de skill (trabalho mecânico)
- O `newapp-executor` carrega `pluggy-doctor` quando toca em código Pluggy, `frontend-design` quando mexe em UI
- O `newapp-planner` carrega `brainstorming` quando entra no modo completo

## Correção aplicada

Arquivos editados após descobrir o erro:

| Arquivo | O que mudou |
|---|---|
| `.opencode/agents/newapp-executor.md` | Seção "Skills disponíveis (carregadas sob demanda)" substituiu "Skills carregadas por padrão". Tabela agora indica **quando** carregar cada skill, não que está sempre carregada |
| `.opencode/agents/newapp-planner.md` | Tools table atualizada: "Carrega skills sob demanda" |
| `.brain/context/stack.md` | Descrição da skill `brainstorming` corrigida |

## Decisão

Documentar skills como **disponíveis e carregáveis sob demanda**, não como **carregadas por padrão**. O agente decide quando carregar baseado na tarefa.

Quando documentar agentes no futuro, evitar frases como:
- ❌ "Carrega automaticamente..."
- ❌ "Skills carregadas por padrão..."
- ❌ "...são padrão em todo plano"

Preferir:
- ✅ "Skills disponíveis (carregadas sob demanda)"
- ✅ "Você decide quando carregar X"
- ✅ "Vê a lista no início da sessão e carrega o que precisar"

## Consequências

### Pró

- Documentação honesta com o comportamento real
- Não induz o agente a "lembrar" de skills que ele não tem carregadas
- Alisson sabe que não precisa se preocupar com skills — o agente cuida

### Contra

- O agente pode esquecer de carregar uma skill que ajudaria (raro, mas possível)
- Se o agente decidir não carregar, o "conhecimento" da skill não está disponível
- Mitigação: as skills têm descrições claras, e o agente deve ser explícito no reporte sobre quais skills usou

## Referências

- Doc oficial: <https://opencode.ai/docs/skills/>
- ADR anterior: [`2026-06-21-sintaxe-permissoes-agentes-opencode.md`](./2026-06-21-sintaxe-permissoes-agentes-opencode.md)
- Agente executor corrigido: `.opencode/agents/newapp-executor.md`
- Agente planner corrigido: `.opencode/agents/newapp-planner.md`
- Stack corrigido: `.brain/context/stack.md`
