---
type: context
status: active
created: 2026-08-13
updated: 2026-08-13
tags: [lucca, backend, api, mobile, fase-1]
related:
  - docs/superpowers/specs/2026-08-12-lucca-backend-design.md
  - docs/superpowers/plans/2026-08-12-lucca-backend.md
  - backend/src/routes/lucca/README.md
---

# Domínio `lucca` — app de acompanhamento do bebê (backend Fase 1)

Módulo próprio dentro do backend do Controle de Gastos (mesmo serviço Express/Mongo, coleções isoladas sob `lucca`), pra registrar e visualizar eventos do Lucca (nascido 06/08/2026, 37 semanas e 5 dias — late preterm). Dois usuários (Alisson + esposa), sem isolamento multi-tenant entre eles — é uma família só.

**Referência de API completa, com exemplos reais testados**: [backend/src/routes/lucca/README.md](../../backend/src/routes/lucca/README.md). Este documento aqui é só o resumo de decisões/regras estáveis — pra contrato de endpoint, campo por campo, usar o README.

## Por que módulo separado, não app novo

Reaproveita a infra de backend (Express/Mongo/Railway) já paga e configurada, mas é um **produto mobile próprio e completo** (Expo/React Native), não uma tela a mais dentro do Controle de Gastos. Decisão tomada na sessão de brainstorming de 2026-08-12 — ver spec.

## Autorização: campo novo, não reaproveita `role`

`Usuario.acessoLucca: Boolean` (default `false`) é **independente** do `role` existente (`admin`/`pro`/`comum`, que tem outro significado no Controle de Gastos). Middleware `exigirAcessoLucca` no mesmo padrão de `isAdmin`. Migration `backend/scripts/migrations/010-lucca-acesso-e-seed.js` marca os 2 usuários e cria o `Bebe` singleton — precisa rodar manualmente (`node scripts/migrations/010-lucca-acesso-e-seed.js <email1> <email2>`, sem `--production` = ambiente dev/`.env.development`, com `--production` = `.env.production`). Sem flag, cai em dev por padrão — proteção deliberada contra rodar em produção sem querer.

## Timers: em andamento fica salvo no backend, não só local no app

Sono, Alimentação e Bombeamento suportam "evento em andamento" (`fim: null`). Isso foi decisão explícita pra resolver o requisito de sincronização (seção 9 da spec original do usuário): o outro cuidador precisa ver "mamada em andamento desde 14:32" ao abrir o app, e qualquer um dos dois pode finalizar o timer que o outro abriu — validado no smoke test (Milena finalizou um sono que o Alisson iniciou).

**Trava de duplicidade**: `eventosService.criarEvento` bloqueia um segundo evento do mesmo tipo com `fim` vazio enquanto o primeiro não for fechado — `409` com mensagem identificando quem iniciou e quando. Evita os dois criarem o mesmo registro em paralelo.

## Cálculos ficam no backend, não no mobile

Idade corrigida, próxima mamada estimada, próxima soneca estimada (wake window) e alerta de validade do leite bombeado são todos calculados em `dashboardService.js`, expostos prontos via `GET /dashboard`. Decisão: regra de negócio centralizada (mesmo princípio de `netWorthService`/`ledgerService`), não duplicada em JS do React Native.

## Escopo ampliado após pesquisa de mercado (Nara Baby, Huckleberry, Baby Connect)

A spec original do usuário deixava **Crescimento** só pra fase 3 e não tinha **wake windows**. Pesquisa de apps concorrentes (2026-08-12) mostrou que ambos são centrais em apps premium — decisão: os dois entraram no MVP da Fase 1 (Crescimento como CRUD simples sem curva percentil OMS ainda; wake window como config simples `Bebe.janelaVigiliaAlvoMinutos` + cálculo no dashboard). Módulo de Saúde (vacinas/consultas) e Milestones ficaram de fora — candidatos a fase 2/3, sem schema ainda.

## ⚠️ Pendência conhecida: timezone das pills do dashboard

`dashboardService.obterDashboard` calcula o boundary de "hoje" (pra pills e pra `proximaMamadaEstimada`) usando **hora local do processo Node** (`new Date().getFullYear/Month/Date()`), não UTC explícito. Em dev isso é `America/Sao_Paulo` (confirmado), então funciona certo. **Ainda não decidido** o que fazer no deploy da Railway — se o container não tiver `TZ=America/Sao_Paulo`, "hoje" vira o dia UTC e as pills resetariam por volta das 21h de Brasília em vez de meia-noite. Duas opções à mesa: setar `TZ` como env var no serviço Railway, ou tornar o cálculo timezone-aware explicitamente no código (mais robusto, não depende de config externa). Decisão adiada pelo usuário pra quando chegarmos na etapa de deploy — não esquecer de revisitar.

## Testado (smoke test manual, 2026-08-12/13)

Login real dos 2 usuários, todos os 12 endpoints, trava de timer duplicado nos 3 tipos, sincronização entre usuários, pills/estimativas/alertas do dashboard, erros `401`/`404`/`409`. Ver conversa da sessão — não há doc de sessão dedicado ainda em `.brain/sessions/` (pendente, ver nota de migração incremental do vault).
