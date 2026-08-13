# API do domínio `lucca`

Referência de contrato da API — pensada pra quem for construir o app mobile (React Native/Expo) numa sessão futura sem precisar reler o backend inteiro. Todos os exemplos abaixo foram testados de verdade contra um backend rodando localmente (não são hipotéticos).

Spec de origem: [docs/superpowers/specs/2026-08-12-lucca-backend-design.md](../../../../docs/superpowers/specs/2026-08-12-lucca-backend-design.md).
Plano de implementação: [docs/superpowers/plans/2026-08-12-lucca-backend.md](../../../../docs/superpowers/plans/2026-08-12-lucca-backend.md).

## Autenticação

Todas as rotas abaixo exigem duas coisas, nessa ordem (`backend/src/routes/lucca/rotasLucca.js`):

1. **JWT válido** — mesmo sistema de login do Controle de Gastos. `POST /api/usuarios/login` com `{ email, senha }` retorna `{ token, usuario }`. Manda o token em todo request como `Authorization: Bearer <token>`.
2. **Flag `acessoLucca: true`** no usuário — nem todo usuário do sistema tem acesso a `/api/lucca/*`, só quem foi marcado pela migration `backend/scripts/migrations/010-lucca-acesso-e-seed.js`. Sem essa flag, toda rota devolve `403`.

Sem token: `401 { "erro": "Token não fornecido." }`
Token válido mas sem `acessoLucca`: `403 { "erro": "Acesso negado. Este usuário não tem acesso ao módulo do Lucca." }`

```bash
curl -X POST http://localhost:3001/api/usuarios/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alissonfariascamargo@gmail.com","senha":"<senha>"}'

# resposta:
# { "mensagem": "Login bem-sucedido!", "token": "eyJ...", "usuario": { "_id": "...", "nome": "...", "role": "admin" } }
```

## Convenções gerais

- Todas as rotas são prefixadas por `/api/lucca`.
- Todo body de request e response é JSON.
- Erros sempre no formato `{ "erro": "<mensagem>" }`, com o status HTTP correspondente (`400`, `401`, `403`, `404`, `409`, `500`).
- **Não há isolamento multi-tenant por usuário** — é uma família só. Todo mundo com `acessoLucca:true` lê/escreve os mesmos dados. `registradoPor` só registra quem logou o evento (aparece populado com `{ _id, nome }` nas listagens e no `eventosEmAndamento` do dashboard).
- Datas são sempre ISO 8601 UTC (`"2026-08-12T12:00:00.000Z"`). O mobile é responsável por converter para o horário local do usuário.
- **Timers**: `sono`, `alimentacao` e `bombeamento` suportam "evento em andamento" — criar com `fim` omitido (ou `null`) deixa o evento aberto. Só pode existir **1 evento em andamento por tipo** ao mesmo tempo — uma segunda tentativa de criar com `fim` vazio devolve `409` antes de criar duplicata. Isso é o que permite ao app mostrar "mamada em andamento desde 14:32, iniciada pela Milena" pro outro usuário.

---

## `GET /api/lucca/bebe`

Retorna o documento singleton do bebê.

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/lucca/bebe
```

```json
{
  "_id": "6a7d12bbb25434e63931d197",
  "nome": "Lucca",
  "dataNascimento": "2026-08-06T00:00:00.000Z",
  "idadeGestacionalNascimento": { "semanas": 37, "dias": 5 },
  "janelaVigiliaAlvoMinutos": 90,
  "createdAt": "2026-08-13T00:41:31.140Z",
  "updatedAt": "2026-08-13T00:41:31.140Z"
}
```

Se a migration de seed ainda não rodou: `404 { "erro": "Bebê ainda não cadastrado. Rode a migration de seed." }`

## `PATCH /api/lucca/bebe`

Campos aceitos (todos opcionais, manda só o que quer mudar): `nome`, `dataNascimento`, `idadeGestacionalNascimento`, `janelaVigiliaAlvoMinutos`.

```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"janelaVigiliaAlvoMinutos": 100}' \
  http://localhost:3001/api/lucca/bebe
```

---

## Sono — `/api/lucca/sono`

Model: `bebeId, registradoPor, inicio, fim (null = em andamento), local ('berco'|'colo'|'cama_compartilhada'|'outro'), observacoes`.

**Criar (timer em andamento — sem `fim`):**
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bebeId":"<idDoBebe>","inicio":"2026-08-13T10:00:00Z"}' \
  http://localhost:3001/api/lucca/sono
# 201 → { "_id": "...", "fim": null, "local": "berco", ... }
```

**Tentar criar outro enquanto o primeiro está aberto:**
```bash
# 409 → { "erro": "Já existe um evento em andamento, iniciado às 07:00 por Alisson Farias Camargo." }
```

**Finalizar o timer (qualquer um dos dois usuários pode):**
```bash
curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fim":"2026-08-13T11:30:00Z"}' \
  http://localhost:3001/api/lucca/sono/<id>
```

**Listar:** `GET /sono` (opcional `?data=2026-08-12` filtra por dia, comparando com `inicio`) · **Excluir:** `DELETE /sono/:id`

---

## Alimentação (amamentação/mamadeira) — `/api/lucca/alimentacao`

Model: `bebeId, registradoPor, tipo ('amamentacao'|'mamadeira_formula'|'mamadeira_leite_materno'), inicio, fim, lado ('esquerdo'|'direito'|'ambos'), qualidadePega ('boa'|'dificil'|'nenhuma'), volumeMl, observacoes`.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bebeId":"<id>","tipo":"amamentacao","inicio":"2026-08-12T12:00:00Z","fim":"2026-08-12T12:20:00Z","lado":"esquerdo","qualidadePega":"boa"}' \
  http://localhost:3001/api/lucca/alimentacao
```

Mesmas regras de timer (criar sem `fim` = em andamento, trava de duplicidade, `409`) e mesmas rotas (`GET` com `?data=` e `?tipo=`, `PATCH /:id`, `DELETE /:id`) do módulo de Sono.

---

## Bombeamento — `/api/lucca/bombeamento`

Model: `bebeId, registradoPor, inicio, fim, lado, volumeMl, armazenadoComo ('geladeira'|'freezer'|'uso_imediato', default 'geladeira'), observacoes`.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bebeId":"<id>","inicio":"2026-08-12T03:30:00Z","fim":"2026-08-12T03:50:00Z","lado":"esquerdo","volumeMl":80,"armazenadoComo":"geladeira"}' \
  http://localhost:3001/api/lucca/bombeamento
```

Mesmas regras de timer/rotas do Sono. O que sai daqui alimenta `alertasValidadeLeite` no dashboard (ver abaixo).

---

## Fralda — `/api/lucca/fralda`

Model: `bebeId, registradoPor, horario, tipo ('xixi'|'coco'|'ambos'), observacoes`. **Sem timer, sem PATCH** — só `GET` (com `?data=`), `POST`, `DELETE /:id`.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bebeId":"<id>","horario":"2026-08-12T14:00:00Z","tipo":"coco"}' \
  http://localhost:3001/api/lucca/fralda
```

---

## Crescimento — `/api/lucca/crescimento`

Model: `bebeId, registradoPor, data, pesoGramas, alturaCm, perimetroCefalicoCm, observacoes`. Sem timer. `GET` (lista tudo, sem filtro de dia — é histórico), `POST`, `PATCH /:id`, `DELETE /:id`.

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"bebeId":"<id>","data":"2026-08-13","pesoGramas":3200,"alturaCm":48.5}' \
  http://localhost:3001/api/lucca/crescimento
```

---

## `GET /api/lucca/dashboard`

O endpoint que alimenta a tela de Painel do app. Não recebe parâmetros — sempre calcula em cima do `Bebe` singleton e do dia corrente.

```json
{
  "idadeCronologica": { "semanas": 1, "dias": 0, "diasTotais": 7 },
  "idadeCorrigida": { "semanas": 0, "dias": 0, "diasTotais": 0 },
  "pills": {
    "horasSonoHoje": 1.5,
    "numeroMamadasHoje": 2,
    "numeroFraldasHoje": 1,
    "numeroBombeamentosHoje": 1
  },
  "proximaMamadaEstimada": "2026-08-12T18:00:00.000Z",
  "proximaSonecaEstimada": "2026-08-13T13:00:00.000Z",
  "alertasValidadeLeite": [
    { "eventoId": "6a7d147018f397faab26ba14", "pertoDeVencer": true, "expiraEm": "2026-08-13T03:50:00.000Z" }
  ],
  "eventosEmAndamento": {
    "sono": null,
    "alimentacao": null,
    "bombeamento": {
      "_id": "...", "inicio": "...", "fim": null,
      "registradoPor": { "_id": "...", "nome": "Alisson Farias Camargo" }
    }
  }
}
```

Detalhes de cada campo:

- **`idadeCronologica` / `idadeCorrigida`**: `{ semanas, dias, diasTotais }`. `idadeCorrigida` nunca fica negativa — é clampada em `0` até a data provável do parto (40 semanas de gestação).
- **`pills.*Hoje`**: contam eventos cujo `inicio`/`horario` cai no **dia local do servidor** (`new Date().getFullYear/Month/Date()`, não UTC puro). Em dev isso já é `America/Sao_Paulo`. **Atenção pro deploy na Railway**: se o container não tiver a timezone certa, "hoje" vira o dia UTC, e as pills resetam ~21h (horário de Brasília) em vez de meia-noite. Decisão de como resolver isso (setar `TZ` no Railway vs. tornar o cálculo timezone-aware no código) ainda está em aberto — ver `.brain/context/lucca-dominio.md`.
- **`proximaMamadaEstimada`**: `null` se houver menos de 2 mamadas/mamadeiras concluídas nas últimas registradas. Senão, é a média do intervalo entre as últimas até 5 mamadas somada ao horário da mais recente.
- **`proximaSonecaEstimada`**: `null` se não houver nenhum sono concluído ainda. Senão, é o horário que o Lucca acordou do último sono + `Bebe.janelaVigiliaAlvoMinutos`.
- **`alertasValidadeLeite`**: só contém itens de `Bombeamento` com `armazenadoComo != 'uso_imediato'` cujo prazo está perto de vencer (geladeira: alerta faltando ≤4h pro limite de 24h; freezer: alerta faltando ≤1 semana pro limite de 6 meses). Array vazio quando nada está perto de vencer.
- **`eventosEmAndamento`**: os 3 timers (sono/alimentação/bombeamento), `null` quando não há nada em andamento daquele tipo, ou o documento completo (com `registradoPor` populado) quando há.

---

## Referência rápida de todas as rotas

| Método | Rota | Timer? |
|---|---|---|
| GET/PATCH | `/bebe` | — |
| GET/POST/PATCH/DELETE | `/sono`, `/sono/:id` | sim |
| GET/POST/PATCH/DELETE | `/alimentacao`, `/alimentacao/:id` | sim |
| GET/POST/PATCH/DELETE | `/bombeamento`, `/bombeamento/:id` | sim |
| GET/POST/DELETE | `/fralda`, `/fralda/:id` | não |
| GET/POST/PATCH/DELETE | `/crescimento`, `/crescimento/:id` | não |
| GET | `/dashboard` | — |
