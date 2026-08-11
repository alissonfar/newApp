---
type: context
status: active
created: 2026-08-11
tags: [pagamentos, transacao, divisao, presets]
related:
  - .brain/decisions/2026-08-11-divisoes-pre-configuradas.md
  - .brain/decisions/2026-08-11-descontinuacao-conta-conjunta.md
---

# Divisões Pré-Configuradas — fluxo estável

Presets de divisão de pagamento salvos por usuário, aplicáveis com um clique na aba Pagamentos do form de transação. Não confundir com o extinto módulo de Conta Conjunta ([ADR-019](../decisions/2026-08-11-descontinuacao-conta-conjunta.md)) — aqui não existe vínculo persistente entre transações, saldo devedor ou acerto. É puramente um atalho de preenchimento em cima de `Transacao.pagamentos[]`.

## Modelo (`backend/src/models/divisaoPreset.js`)

- `DivisaoPreset { usuario, nome, partes: [{pessoa, percentual}] }` — mínimo 2 partes, soma dos percentuais deve ser 100% (tolerância 0,1, validada em `divisaoPresetController.validarPartes`).
- **Sem `ativo`/soft-delete** — nada referencia um preset por id (ele só é copiado pro state do form no momento da aplicação), então exclusão é sempre definitiva.
- Índice único `{usuario, nome}` — não dá pra ter dois presets com o mesmo nome pro mesmo usuário.
- `pessoa` é texto livre, igual ao campo `Pessoa` de cada pagamento — **não** está acoplado ao cadastro `/pessoas` (Empréstimos), decisão consciente pra não criar dependência entre os dois módulos.

## Onde vive cada peça

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Backend model | `backend/src/models/divisaoPreset.js` | Schema + validação de partes/soma |
| Backend controller | `backend/src/controllers/divisaoPresetController.js` | CRUD, valida soma=100% |
| Backend rotas | `backend/src/routes/rotasDivisaoPreset.js` | `/api/divisao-presets` (GET/POST/PUT/DELETE) |
| Client HTTP | `controle-gastos-frontend/src/api.js` | `listarDivisaoPresets`, `criarDivisaoPreset`, `atualizarDivisaoPreset`, `excluirDivisaoPreset` |
| Aplicação | `controle-gastos-frontend/src/hooks/usePagamentos.js` | `applyPreset(preset)` |
| UI de aplicação | `controle-gastos-frontend/src/components/Transaction/TabPagamentos.js` | Dropdown "Aplicar divisão" (só aparece com ≥1 preset salvo) |
| Wiring | `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js` | Carrega a lista de presets 1x ao montar o form, passa pra `TabPagamentos` |
| Gerenciamento (CRUD) | `controle-gastos-frontend/src/pages/Profile/Profile.js` | 4ª aba "Divisões" — sem entrada na sidebar |

## Como `applyPreset` calcula os valores

Mesma lógica de arredondamento de `splitInto` (divisão igual em N partes) — `Math.floor` em cada parte exceto a última, que absorve a diferença por `total - somaParcial`, garantindo que a soma bate exatamente com o valor total (nunca sobra/falta centavo). A diferença é que `splitInto` divide igualmente e `applyPreset` divide pelos percentuais de cada `parte`.

## Propagação de tags

`applyPreset` reaproveita `mergeTagsAditivo` (já existente em `usePagamentos.js`, criada para "Rateio igual"/"Dividir em") — as tags do pagamento 1 (índice 0) são propagadas de forma aditiva pros demais pagamentos, sem duplicar e sem apagar tags que já estavam lá manualmente.

## Comportamento ao aplicar

Substitui **todos** os pagamentos da tela pelos N novos calculados a partir do preset — mesmo comportamento de "Dividir em N" já existente. Não é um merge/soma em cima do que já estava preenchido.

## Onde acessar a tela de gerenciamento

`/profile` → aba "Divisões" (4ª aba, ao lado de Perfil/Alterar Senha/Preferências). Decisão explícita do usuário de não adicionar item na sidebar (`menuStructure.js` não foi tocado) — função pouco usada não deveria poluir o menu principal.
