---
type: context
status: active
created: 2026-06-21
tags: [meta, vault, memoria]
---

# .brain/ — Vault de Memória de Longo Prazo

## O que é

`.brain/` é a **memória persistente** deste projeto. É uma pasta normal na raiz do projeto que:

1. Funciona como um **vault Obsidian** (pasta interpretável pelo Obsidian, com wikilinks, tags, graph view)
2. Funciona como **fonte da verdade para os agentes** (newapp-planner lê, escreve e atualiza)
3. Funciona como **diário de bordo** das decisões e sessões do projeto

A ideia é que **nada de importante se perca entre sessões**. Quando você fecha o opencode e abre de novo amanhã, a IA precisa conseguir pegar o contexto sem você repetir tudo.

## Por que existe

Sem memória persistente, todo novo chat começa do zero:
- Decisões tomadas há 2 semanas se perdem
- Por que escolhemos X em vez de Y? Ninguém lembra
- A IA sugere soluções que já tentamos e abandonamos
- Você gasta tempo re-explicando o projeto

O vault resolve isso. Cada decisão vira um ADR, cada conversa vira uma sessão, cada padrão vira um playbook.

## Como abrir no Obsidian

1. Abra o Obsidian
2. Clique em **"Open folder as vault"** (ou `Ctrl+O` / `Cmd+O`)
3. Navegue até `C:\PROJETOS\newApp`
4. **Importante:** abra a **raiz do projeto**, não a pasta `.brain/` — assim você vê o código e o vault lado a lado
5. Nas configurações do Obsidian, ative:
   - **"Always update links"** (em Files & Links)
   - **"Show inline title"** (opcional, gosto pessoal)
   - **"New link format"**: shortest path
6. O Obsidian vai detectar a pasta `.brain/` automaticamente pelas notas com frontmatter

Dica: use o **Graph View** (`Ctrl+G`) para visualizar conexões entre decisões, sessões e playbooks. Vai te surpreender como padrões aparecem.

## Estrutura

```
.brain/
├── README.md              # este arquivo
├── decisions/             # ADRs — Architecture Decision Records
├── context/               # informação estável: stack, personas, regras
├── sessions/              # logs de cada conversa de planejamento
└── playbooks/             # procedimentos recorrentes
```

### `decisions/` — ADRs (Architecture Decision Records)

Cada decisão técnica importante vira um ADR. O formato é:

```yaml
---
type: decision
status: active | superseded | deprecated
created: YYYY-MM-DD
tags: [escopo, tecnologia]
---

# <Título da decisão>

## Contexto
Qual era o problema / decisão a tomar.

## Opções consideradas
- Opção A: ...
- Opção B: ...
- Opção C: ...

## Decisão
Escolhemos X porque Y.

## Consequências
- Pró: ...
- Contra: ...
- Impacto em outras áreas: ...
```

Exemplos de quando criar um ADR:
- "Por que MongoDB e não Postgres?"
- "Por que React + CRACO e não Next.js?"
- "Por que JWT no localStorage e não cookies httpOnly?"
- "Por que decimal.js em vez de float nativo?"

Quando uma decisão é substituída, **NÃO delete o ADR antigo** — mude o `status: superseded` e crie um novo referenciando o antigo.

### `context/` — informação estável

Notas que mudam pouco. Stack do projeto, personas de usuário, regras de negócio, glossário.

```yaml
---
type: context
status: active
created: YYYY-MM-DD
tags: [stack, regras, persona]
---

# Stack do projeto

## Backend
- Node.js + Express (porta 3001)
- MongoDB com replica set
- ...

## Frontend
- React 19 + CRACO (porta 3004)
- ...
```

Esta é a primeira coisa que a IA lê quando você pede um plano. Mantenha atualizado.

### `sessions/` — logs de conversa

Uma nota por sessão de planejamento ou execução significativa.

```yaml
---
type: session
status: active
created: YYYY-MM-DD
tags: [planejamento, setup, refactor]
---

# Sessão: <título curto>

## Objetivo
O que eu queria fazer.

## Decisões tomadas
- [link para ADR] - ...

## Mudanças aplicadas
- Arquivo X: ...
- Arquivo Y: ...

## Aprendizados
- O plugin Z não funciona com PowerShell, usar ...
- ...
```

### `playbooks/` — procedimentos recorrentes

Passo a passo de coisas que você faz com frequência.

```yaml
---
type: playbook
status: active
created: YYYY-MM-DD
tags: [procedimento, deploy, debug]
---

# Como <fazer X>

## Pré-requisitos
- ...

## Passos
1. ...
2. ...
3. ...

## Troubleshooting
- Se der erro Y, ...
```

Exemplos:
- Como rodar migrations em produção
- Como debugar um problema de transação Pluggy
- Como abrir o vault no Obsidian
- Como criar um novo agente

## Convenção de frontmatter

Todas as notas têm frontmatter YAML no topo:

```yaml
---
type: decision | context | session | playbook
status: active | superseded | deprecated
created: YYYY-MM-DD
tags: [tag1, tag2]
---
```

- `type`: o tipo de nota (uma das 4 pastas)
- `status`: `active` (padrão), `superseded` (substituída), `deprecated` (não usar mais)
- `created`: data de criação
- `tags`: array de tags para filtrar/buscar

**Não invente novos tipos** sem necessidade. Se precisar de uma nova categoria (ex: `runbook`, `incident`), adicione uma nova pasta primeiro e documente aqui.

## Como o agente lê/escreve no vault

O agente `newapp-planner` é o **único com permissão de escrita** no vault (definido em `.opencode/agents/newapp-planner.md`).

Quando você pedir um plano:
1. Planner lê `.brain/context/` para entender o projeto
2. Planner lê os ADRs recentes em `.brain/decisions/` para não contradizer
3. Planner lê `.brain/sessions/` recentes para entender o histórico
4. Planner escreve um **design doc** em `.brain/sessions/YYYY-MM-DD-<topico>-design.md`
5. Planner te apresenta o plano via `question` pra aprovação

Quando você invoca o `newapp-executor`:
1. Executor lê o design doc
2. Executor aplica mudanças no código
3. Executor **NÃO mexe** no vault (sem permissão)
4. Você (ou o committer depois) atualiza o vault com aprendizados

## Regra de ouro: aberto pra evolução

A estrutura atual (4 pastas) é um **começo**, não uma camisa-de-força. Se você perceber que precisa de:

- `incidents/` para registrar bugs críticos com post-mortem
- `runbooks/` separado de playbooks
- `specs/` para escrever requisitos antes de planejar
- `glossary/` para termos de domínio

**Crie a pasta, documente aqui no README e siga.** Não peça permissão, o vault é seu. Só mantenha o README atualizado pra próxima pessoa (ou você daqui a 6 meses) entender o porquê.

## Status

- **Criado em:** 2026-06-21
- **Última atualização:** 2026-06-21
- **Mantido por:** Alisson + newapp-planner
