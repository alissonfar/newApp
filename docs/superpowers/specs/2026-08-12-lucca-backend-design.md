# App do Lucca — Fase 1: Domínio `lucca` no backend — Design

Status: aprovado em 2026-08-12 — pronto para writing-plans.

## Contexto e motivação

Alisson quer criar um app mobile próprio (React Native/Expo) para ele e a esposa registrarem eventos do filho recém-nascido, Lucca (nascido 06/08/2026, 37 semanas e 5 dias — late preterm): amamentação/mamadeira, fralda, sono, bombeamento de leite e crescimento. É um produto separado do Controle de Gastos (interface e navegação próprias), mas reaproveita a infraestrutura de backend já em produção na Railway.

Esta spec cobre **só a Fase 1: o domínio `lucca` no backend existente**. O app mobile em si (Expo, telas, tema, navegação) é uma spec separada, a ser desenhada depois que esta API estiver pronta — o mobile depende dela existir para ter algo a consumir.

Documento de origem: spec trazida pelo usuário (`spec-app-lucca.md`), refinada nesta sessão de brainstorming.

## Decisões validadas com o usuário

- **Infra:** mesmo serviço Express + mesmo MongoDB (replica set) do Controle de Gastos, em coleções isoladas sob o namespace `lucca`. Não cria serviço/banco separado na Railway — reaproveita o que já está pago e configurado.
- **Fases:** backend primeiro (esta spec), mobile depois, em specs/planos separados.
- **Usuários:** reaproveita a conta atual de Alisson no `Usuario` existente; cria 1 conta nova para a esposa (mesmo model `Usuario`, sem coleção `User` própria do domínio).
- **Autorização:** campo novo e independente `acessoLucca: Boolean` no `Usuario` (não reaproveita o enum `role` existente, que tem outro significado no Controle de Gastos). Middleware novo `exigirAcessoLucca`, no mesmo padrão de `isAdmin` (`backend/src/middlewares/autenticacao.js:42`).
- **Timers (amamentação, sono, bombeamento):** evento "em andamento" é salvo no backend com `fim: null` assim que iniciado — não fica só local no celular. Isso permite que o outro usuário veja "mamada em andamento desde 14:32" ao abrir o app, e permite a trava de duplicidade abaixo.
- **Cálculos (idade corrigida, próxima mamada estimada, alerta de validade do leite, próxima soneca estimada):** o backend calcula e expõe pronto via `dashboardService`, seguindo o padrão do repo onde a regra de negócio fica no service (ex: `netWorthService`), não duplicada no cliente.
- **Escopo ampliado após pesquisa de mercado (ver seção seguinte):** Crescimento entra no MVP como CRUD simples; wake windows (janela de vigília) entra como config simples + cálculo no dashboard. Módulo de Saúde (vacinas/consultas) fica fora do MVP.

## Pesquisa de mercado (Nara Baby, Huckleberry, Baby Connect)

Pesquisa feita para garantir que o MVP cobre o que apps premium de tracking de bebê oferecem (excluindo recursos de IA/sugestão automática, fora de escopo por decisão do usuário):

- **Nara Baby**: grátis, sem paywall — timers de amamentação/bombeamento por lado, mamadeira por volume/tempo, fralda rápida, sincronização entre cuidadores e dispositivos, múltiplos bebês, wake windows configuráveis, gráficos de crescimento com percentil OMS (peso/altura/perímetro cefálico), saúde da mãe no pós-parto. ([Nara Organics](https://nara.com/pages/nara-baby-tracker-app), [App Store](https://apps.apple.com/us/app/nara-baby-mom-tracker/id1444639029))
- **Huckleberry**: tracking de sono/fralda/alimentação/bombeamento/crescimento/medicação, sincronização entre cuidadores, sleep summaries. ([App Store](https://apps.apple.com/us/app/huckleberry-baby-tracker/id1169136078))
- **Baby Connect**: adiciona módulo de saúde (medicação com dose/horário, temperatura, consultas, vacinas) e percentis de crescimento. (via [comparativo Pebbi 2026](https://pebbi.co/blog/best-baby-tracker-apps-2026))

Gaps identificados na spec original e decisão tomada para cada um:

| Gap | Decisão |
|---|---|
| Crescimento (peso/altura/perímetro cefálico) — spec original jogava para "fase 3" | **Entra no MVP** como CRUD simples (sem curva percentil OMS ainda — isso fica pra fase 2). Motivo: dados de peso/altura das primeiras semanas não dá pra reconstruir depois se não forem capturados a tempo. |
| Wake windows (lembrete de janela de vigília entre sonecas) | **Entra no MVP** como config simples no `Bebe` + cálculo no dashboard. Reaproveita o `EventoSono` já existente, custo baixo. |
| Módulo de Saúde (vacinas/temperatura/consultas) | **Fora do MVP.** Documentado aqui como candidato a fase 2/3 — módulo novo inteiro, mais escopo do que o MVP pede agora. |
| Marcos/Milestones (primeiro sorriso, etc.) | **Fora do MVP** — não foi levantado como prioridade pelo usuário nesta sessão. |

## Estrutura de arquivos

Segue o padrão em camadas já usado no resto do backend (`routes/ → controllers/ → services/ → models/`):

```
backend/src/
  models/lucca/
    bebe.js
    eventoAlimentacao.js
    eventoBombeamento.js
    eventoFralda.js
    eventoSono.js
    eventoCrescimento.js
  services/lucca/
    dashboardService.js   // idade corrigida, pills, próxima mamada, alerta validade leite, próxima soneca
    eventosService.js     // CRUD + regra "1 timer em andamento por tipo"
  controllers/lucca/
    bebeController.js
    eventosController.js
    dashboardController.js
  routes/lucca/
    rotasLucca.js          // registra tudo sob /api/lucca, aplica autenticacao + exigirAcessoLucca
  middlewares/
    autenticacao.js        // adiciona exigirAcessoLucca (edição no arquivo existente)
```

## Autorização

- Migration adiciona `acessoLucca: { type: Boolean, default: false }` ao schema `Usuario` (`backend/src/models/usuarios.js`).
- Migration marca `acessoLucca: true` na conta atual de Alisson e cria a conta nova da esposa já com `acessoLucca: true`.
- Novo middleware `exigirAcessoLucca(req, res, next)` em `autenticacao.js`, no mesmo formato de `isAdmin`: busca o usuário por `req.userId`, checa `acessoLucca === true`, senão `403`.
- Todas as rotas `/api/lucca/*` exigem `autenticacao` + `exigirAcessoLucca`, nessa ordem.

## Modelo de dados

Todas as coleções referenciam `Usuario` existente via `registradoPor` (quem logou o evento) — não há coleção `User` própria do domínio.

```js
// Bebe (singleton — 1 documento nesta fase)
{
  nome: String,
  dataNascimento: Date,
  idadeGestacionalNascimento: { semanas: Number, dias: Number },
  janelaVigiliaAlvoMinutos: Number   // wake window configurável, usado no cálculo de "próxima soneca estimada"
}

// EventoAlimentacao
{
  bebeId, registradoPor: ObjectId(Usuario),
  tipo: 'amamentacao' | 'mamadeira_formula' | 'mamadeira_leite_materno',
  inicio: Date, fim: Date | null,       // fim null = timer em andamento
  lado: 'esquerdo' | 'direito' | 'ambos',
  qualidadePega: 'boa' | 'dificil' | 'nenhuma',
  volumeMl: Number,
  observacoes: String
}

// EventoBombeamento
{
  bebeId, registradoPor,
  inicio: Date, fim: Date | null,
  lado: 'esquerdo' | 'direito' | 'ambos',
  volumeMl: Number,
  armazenadoComo: 'geladeira' | 'freezer' | 'uso_imediato',
  observacoes: String
}

// EventoFralda
{
  bebeId, registradoPor,
  horario: Date,
  tipo: 'xixi' | 'coco' | 'ambos',
  observacoes: String
}

// EventoSono
{
  bebeId, registradoPor,
  inicio: Date, fim: Date | null,
  local: 'berco' | 'colo' | 'cama_compartilhada' | 'outro',
  observacoes: String
}

// EventoCrescimento
{
  bebeId, registradoPor,
  data: Date,
  pesoGramas: Number,
  alturaCm: Number,
  perimetroCefalicoCm: Number,
  observacoes: String
}
```

## Regra de negócio: 1 evento em andamento por tipo

`eventosService` bloqueia a criação de um novo evento com `fim: null` se já existir outro do **mesmo tipo** (sono, amamentação ou bombeamento) em andamento — retorna erro claro identificando quem iniciou e quando (ex: "já existe um sono em andamento, iniciado às 14:32 por Alisson"). Evita que os dois usuários registrem o mesmo evento em paralelo sem perceber, já que timers ficam salvos no backend desde o início (não só localmente).

## Endpoints da API

Todos sob `/api/lucca`, exigindo `autenticacao` + `exigirAcessoLucca`. Resposta de erro no padrão do repo (`{ erro: '...' }`).

```
GET    /bebe                    → dados do Lucca + idade cronológica calculada
PATCH  /bebe                    → editar (nome, dataNascimento, idadeGestacional, janelaVigiliaAlvoMinutos)

GET    /alimentacao             → lista (filtros: data, tipo)
POST   /alimentacao             → cria (com ou sem fim = timer em andamento)
PATCH  /alimentacao/:id         → editar (ex: finalizar timer)
DELETE /alimentacao/:id

GET    /bombeamento             → lista + alerta de validade calculado por item
POST   /bombeamento
PATCH  /bombeamento/:id
DELETE /bombeamento/:id

GET    /fralda                  → lista + contador do dia
POST   /fralda
DELETE /fralda/:id

GET    /sono                    → lista + total de horas do dia
POST   /sono
PATCH  /sono/:id
DELETE /sono/:id

GET    /crescimento             → lista histórica (peso/altura/perímetro cefálico)
POST   /crescimento
PATCH  /crescimento/:id
DELETE /crescimento/:id

GET    /dashboard               → tudo calculado pro Painel (ver seção seguinte)
```

## `GET /dashboard` — cálculos expostos

- **Idade cronológica e corrigida**: `idade corrigida = idade cronológica − (40 semanas − idade gestacional ao nascer)`. Aritmética de datas pura (não envolve dinheiro, não usa `decimal.js`), mas centralizada em `dashboardService` e testável isoladamente, seguindo o mesmo princípio de isolar regra de negócio em service.
- **Pills do dia**: soma de horas de sono, nº de mamadas/mamadeiras, nº de trocas de fralda, nº de bombeamentos — filtrado por "hoje".
- **Próxima janela estimada de mamada**: heurística simples (média do intervalo entre as últimas N mamadas + horário da última). Sem IA/ML, por decisão explícita do usuário.
- **Próxima soneca estimada**: horário que o Lucca acordou do último sono + `janelaVigiliaAlvoMinutos` do `Bebe`.
- **Alertas de validade do leite bombeado**: para cada `EventoBombeamento` com `armazenadoComo != uso_imediato` ainda ativo (sem marcação de usado), calcula prazo (24h geladeira / 6 meses freezer, conforme OMS/CDC) e marca `pertoDeVencer: boolean`.
- **Eventos em andamento**: lista dos timers ativos agora (sono, amamentação, bombeamento), para o app mostrar "em andamento desde X" para os dois usuários.

## Testes

Cobertura automatizada não é prioridade padrão do projeto, mas `dashboardService` concentra lógica de data pura (idade corrigida, janela de mamada, validade do leite, wake window) que vale testar isolada — mesmo critério já aplicado a `ledgerService`/`netWorthService`. Testes Jest cobrem só esse service.

## Fora de escopo desta fase

- App mobile (Expo/React Native) — spec separada, depende desta API existir.
- Notificações push (lembretes) — fase 2, depende do mobile existir.
- Módulo de Saúde (vacinas/temperatura/consultas).
- Marcos/Milestones.
- Curva percentil OMS visual para crescimento (dados já coletados, cálculo/visualização fica pra fase 2).
- Editor de temas customizados — é responsabilidade do mobile, não do backend.
