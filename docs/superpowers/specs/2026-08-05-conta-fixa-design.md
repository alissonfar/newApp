# Conta Fixa — Design

Status: aprovado em 2026-08-05, aguardando review final do usuário antes de writing-plans.

## Contexto e motivação

O usuário sente falta, no Sistema de Controle de Gastos, de um mecanismo pra lançamento recorrente mensal de despesas/receitas (aluguel, assinaturas, financiamentos, salário). Hoje não existe nada equivalente no código (`grep` por `recorrente|contaFixa|fixa` em `backend/src` não retornou nada) nem no vault `.brain/`.

Esta é a primeira fatia de uma lista maior de ideias do usuário (lançamento de conta fixa, relatórios automatizados por fechamento de mês, integração com WhatsApp via Evolution API). As outras ficam na fila, fora de escopo deste spec.

## Modelo de dados

### Entidade nova: `ContaFixa`

Cadastro próprio, independente de `Transacao` — representa a **regra recorrente**, não uma ocorrência específica.

```
nome                 String
tipo                 'despesa' | 'receita'
valorEsperado        Decimal        // valor "padrão"; pode variar mês a mês na prática
diaLancamento        Number (1-31)  // dia em que o cron cria o registro no banco
diaVencimento        Number (1-31)  // data gravada na Transacao (data efetiva pra relatórios/balanço)
vencimentoMesSeguinte Boolean       // true = vencimento cai no mês após o lançamento (ex: financiamento)
categoriaId           ref Categoria
tagsPadrao            [ref Tag]
modo                  'automatico' | 'confirmacao'
pagamentosTemplate    [{ pessoa, percentual, tagsOverride? }]  // divisão percentual, escalada pro valor real de cada ciclo
dataInicio            Date
dataFim               Date (opcional)
totalRepeticoes       Number (opcional)   // ex: financiamento 12x
status                'ativa' | 'pausada' | 'encerrada'
ciclosPulados         [{ mes: Number, ano: Number }]  // ciclos marcados como "pular este mês"
criadoEm / atualizadoEm
```

### Campo novo em `Transacao`

`contaFixaId` (ref `ContaFixa`, opcional) — rastro de que a transação foi originada por uma Conta Fixa. Não há entidade separada de "lançamento pendente": pendência é sempre calculada on-the-fly (ver seção de pendências).

## Decisões de design já validadas com o usuário

- **Editar uma transação gerada não afeta a regra.** O `valorEsperado` da `ContaFixa` só muda se o cadastro da regra for editado diretamente.
- **Dois dias separados (lançamento vs. vencimento), sempre configuráveis, sem valor hardcoded.** Motivação real do usuário: quer que uma despesa futura conhecida (ex: financiamento que debita dia 12) já apareça no saldo/balanço a partir do dia em que o registro é criado (ex: dia 1), mesmo que o dinheiro só saia depois — porque a `Transacao` já existe no banco com a data de vencimento correta.
- **Dia inválido no mês (ex: dia 31 em fevereiro) → usa o último dia do mês.**
- **Vencimento cruzando o mês:** campo explícito `vencimentoMesSeguinte` (não inferido pela comparação numérica dos dias) — decisão do usuário por clareza.
- **Suporta despesa e receita** (mesmo mecanismo serve pra salário, aluguel recebido, etc).
- **Suporta término opcional** (`dataFim` ou `totalRepeticoes`) desde a v1 — cobre financiamentos com número fixo de parcelas.
- **Cron diário verifica atrasados.** Se o servidor cair no dia exato, a próxima execução do cron detecta o ciclo pendente (sem `Transacao` gerada ainda) e gera com a data de vencimento correta (não a data de hoje).
- **`pagamentosTemplate` guarda percentuais**, não valores fixos — necessário porque o valor real de cada mês pode variar (ex: conta de luz), mas a divisão proporcional entre pessoas deve se manter.

## Mecanismo de geração (cron)

`node-cron` dentro do próprio processo Express (sem infraestrutura nova).

Execução diária:

1. Busca `ContaFixa` com `status: 'ativa'`.
2. Para cada uma, verifica se atingiu `dataFim`/`totalRepeticoes` → se sim, marca `status: 'encerrada'` e pula.
3. Calcula a data de lançamento e vencimento do ciclo atual (ajustando dia inválido pro último dia do mês; aplicando `vencimentoMesSeguinte` quando configurado).
4. Se hoje ≥ data de lançamento do ciclo **e** não existe `Transacao` com esse `contaFixaId` para esse ciclo **e** o ciclo não está em `ciclosPulados`:
   - **Modo automático:** gera a `Transacao` real agora, com `data` = data de vencimento calculada, `pagamentos[]` montado a partir do `pagamentosTemplate` escalado pelo `valorEsperado` via `decimal.js`.
   - **Modo confirmação:** não gera nada — fica disponível como pendência (calculada, não persistida) até confirmação manual.

## Fluxo de confirmação manual (modo `confirmacao`)

Reaproveita o padrão já existente de "revisão antes de materializar" (igual ao fluxo de importações: upload → revisão → finalizar).

1. Dashboard/Home mostra contador "N contas fixas pendentes este mês".
2. Tela de revisão lista cada pendência com valor esperado, data de vencimento, categoria/tags e split de pagamentos — todos editáveis antes de confirmar.
3. Confirmar → materializa a `Transacao` com o valor real informado (pode diferir do `valorEsperado`; isso não altera a regra).
4. "Pular este mês" → adiciona `{mes, ano}` em `ContaFixa.ciclosPulados`, sem gerar transação, sem remover a regra.

## API (backend)

Seguindo o padrão em camadas do projeto (`routes/` → `controllers/` → `services/` → `models/`):

- `src/models/contaFixa.js`
- `src/services/contaFixaService.js` — cálculo de datas de ciclo, geração de transação a partir do template, cálculo de pendências
- Job de cron registrado no bootstrap do servidor (mesmo arquivo de service ou um `contaFixaCronService.js` dedicado)
- `src/controllers/controladorContaFixa.js`
- `src/routes/rotasContaFixa.js`:
  - CRUD `/api/contas-fixas`
  - `GET /api/contas-fixas/pendencias`
  - `POST /api/contas-fixas/:id/confirmar`
  - `POST /api/contas-fixas/:id/pular`

## Frontend

- Novo item de menu de primeiro nível: "Contas Fixas" — lista de regras, criar/editar/pausar/encerrar.
- Card/seção na Home: contador de pendências, leva pra tela de revisão (reaproveitando visual do fluxo de revisão de importação).
- Form de Conta Fixa reaproveita componentes de categoria/tags existentes e, na medida do possível, a lógica de split de `pagamentos[]` já usada no form de transação (`usePagamentos`).

## Casos de borda

- **Concorrência do cron:** a verificação "já existe `Transacao` com esse `contaFixaId` + ciclo" evita duplicar lançamento em reinícios do servidor.
- **Encerramento automático:** ao atingir `totalRepeticoes` ou passar `dataFim`, `status` vira `encerrada`; histórico de transações já geradas permanece intacto.

## Testes

- **Automatizados (novidade para o usuário — primeira vez usando testes neste projeto):** cobertura unitária dedicada em `contaFixaService`, focada em lógica pura de datas e valores (cálculo de ciclo, dia inválido no mês, virada de mês via `vencimentoMesSeguinte`, escala de `pagamentosTemplate` por `decimal.js`). Não cobre UI/fluxos visuais.
- **Manual:** roteiro guiado (conforme `CLAUDE.md`) pra tudo visível/clicável — criação de regra, geração automática, fluxo de confirmação/pular.

## Fora de escopo (fila para depois)

- Descontinuação de conta conjunta — spec separado (`2026-08-05-descontinuacao-conta-conjunta-design.md`).
- Relatórios automatizados por fechamento de mês.
- Integração com Evolution API / WhatsApp.
