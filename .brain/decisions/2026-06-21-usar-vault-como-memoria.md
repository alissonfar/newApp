---
type: decision
status: active
created: 2026-06-21
tags: [meta, vault, memoria, agentes]
---

# ADR-001: Usar vault Obsidian (.brain/) como memória de longo prazo

## Contexto

O projeto é tocado por uma IA (opencode) que esquece tudo entre sessões. Cada novo chat começa do zero:

- Decisões técnicas importantes se perdem
- Não há registro de "por que escolhemos X em vez de Y"
- A IA repete sugestões que já tentamos
- O usuário (Alisson) gasta tempo re-explicando contexto

Precisamos de uma **memória persistente** que:
1. Seja legível pela IA (formato texto/markdown)
2. Seja legível por humanos (visualização rica, busca, links)
3. Seja versionável (Git)
4. Seja fácil de manter (mínima fricção pra escrever)
5. Sirva como diário de bordo

## Opções consideradas

### Opção A: Notas soltas no README/AGENTS.md

- **Pró:** simples, já temos AGENTS.md
- **Contra:** vira um documento monolítico impossível de navegar; sem histórico de mudanças; sem graph view
- **Veredito:** ❌ não escala

### Opção B: Planilha ou Notion

- **Pró:** UI rica, fácil de buscar
- **Contra:** fora do repo, IA não acessa facilmente, sem versionamento, lock-in de fornecedor
- **Veredito:** ❌ quebra o critério 1 e 3

### Opção C: Vault Obsidian em pasta `.brain/` no próprio repo

- **Pró:**
  - Markdown puro (IA lê e escreve nativamente)
  - Wikilinks + tags + graph view (humano navega)
  - Versionado no Git (histórico de mudanças)
  - Sem dependência externa
  - Obsidian é gratuito
  - Estrutura de pastas evolui com o projeto
- **Contra:**
  - Precisa disciplina de manter atualizado
  - Obsidian não é obrigatório (vault funciona como pasta de markdowns)
- **Veredito:** ✅ escolhido

### Opção D: Comentários inline no código + ADRs em `/docs/adr/`

- **Pró:** decisões ficam perto do código
- **Contra:** IA não consegue fazer grep semântico; perde o "diário de bordo" das sessões
- **Veredito:** ❌ complemento, não substituto

## Decisão

Escolhemos **Opção C**: vault Obsidian na pasta `.brain/` do próprio projeto, com 4 subpastas:

- `decisions/` — ADRs (Architecture Decision Records)
- `context/` — informação estável (stack, personas, regras de negócio)
- `sessions/` — log de cada conversa significativa
- `playbooks/` — procedimentos recorrentes

A IA `newapp-planner` é a única com permissão de escrita no vault. Ela lê contexto + decisões + sessões recentes antes de planejar qualquer coisa, e escreve um design doc em `sessions/` para registro.

A estrutura é **aberta pra evolução**: se surgir necessidade de `incidents/`, `runbooks/`, `glossary/`, criamos sem pedir permissão, só atualizamos o README.

## Consequências

### Pró

- IA sempre começa com contexto atualizado do projeto
- Decisões antigas ficam acessíveis e referenciáveis
- Obsidian graph view revela padrões inesperados
- Tudo versionado no Git, sem dependência externa
- Custo zero de tooling (Obsidian é grátis)

### Contra

- Mais uma responsabilidade de manutenção (escrever ADR/sessão/playbook)
- Se a disciplina cair, o vault desatualiza e vira lixo
- Obsidian não é obrigatório pra funcionar, mas ajuda muito a navegar

### Impacto em outras áreas

- **Agentes:** `newapp-planner` ganha permissão de escrita em `.brain/`. `newapp-executor` e `newapp-committer` NÃO mexem no vault.
- **Git:** `.brain/` vai pro repo (não no `.gitignore`). Memória é parte do projeto.
- **Onboarding:** quando alguém novo entrar no projeto, o `README.md` da `.brain/` explica tudo.

## Referências

- [README.md do vault](../../README.md)
- [.opencode/agents/newapp-planner.md](../../../opencode/agents/newapp-planner.md) — agente que lê/escreve no vault
- Próximo ADR a ser criado: [sintaxe de permissões dos agentes](./2026-06-21-sintaxe-permissoes-agentes-opencode.md) (planejado)
