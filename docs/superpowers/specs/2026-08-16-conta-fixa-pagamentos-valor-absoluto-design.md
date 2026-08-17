# Conta Fixa — Migração de divisão percentual para valor absoluto (reuso da aba Pagamentos)

Status: aprovado em 2026-08-16, aguardando review final do usuário antes de writing-plans.

## Contexto e motivação

O spec original de Conta Fixa (`2026-08-05-conta-fixa-design.md`) definiu `pagamentosTemplate` como uma divisão por **percentual**, justificada por: "o valor real de cada mês pode variar (ex: conta de luz), mas a divisão proporcional entre pessoas deve se manter".

O usuário revisou essa decisão: quer que a divisão de pagamento na Conta Fixa funcione **exatamente igual** ao módulo de lançamento de transação (`usePagamentos` / `TabPagamentos`), que trabalha com **valor absoluto em R$** por pessoa, não percentual. Na visão do usuário, o modelo percentual foi uma escolha equivocada do design original — ele prefere reaproveitar a mesma estrutura/UI já validada e usada no dia a dia, em vez de manter dois modelos de divisão diferentes no sistema (um percentual, outro absoluto).

Não existem Contas Fixas cadastradas em produção/dev no momento — não é necessária migration de dados para registros existentes.

## Decisão

Substituir o modelo percentual por valor absoluto em toda a feature de Conta Fixa, reaproveitando o hook `usePagamentos` e o componente `TabPagamentos` (já usados em `NovaTransacaoForm`) tanto no cadastro da regra quanto na tela de confirmação manual.

**Fora do reuso:** as sub-funcionalidades de Parcelamento-por-pagamento e Empréstimo-por-pagamento do `TabPagamentos` não se aplicam — são ações de uma transação pontual, sem sentido num template que se repete todo mês. `TabPagamentos` ganha uma prop `enableEmprestimo` (default `true`, preservando o comportamento atual na transação) que a Conta Fixa passa como `false`. A seção de parcelamento já é condicionada pela prop existente `showInForm`, que a Conta Fixa simplesmente não passa.

## Modelo de dados

### `backend/src/models/contaFixa.js`

- `PagamentoTemplateSchema` (percentual + tagsOverride) é removido.
- `pagamentosTemplate` passa a usar o mesmo sub-schema de pagamento já definido em `Transacao` (`PagamentoSchema`: `{ pessoa: String required, valor: Number required, tags: Object }`), exportado de `transacao.js` para reuso — evita duas definições divergentes do mesmo conceito.
- Campo `tagsPadrao` é **removido** do nível da Conta Fixa. Cada linha de `pagamentosTemplate` passa a carregar suas próprias `tags` diretamente (mesmo formato de `Transacao.pagamentos[].tags`), sem conceito de fallback herdado — replica exatamente o comportamento da aba Pagamentos da transação.
- Nome do campo `pagamentosTemplate` é mantido (continua sendo "o modelo que se repete a cada ciclo"; só o conteúdo interno mudou).
- Resto do schema (`valorEsperado`, `diaLancamento`, `diaVencimento`, `vencimentoMesSeguinte`, `modo`, `dataInicio`, `dataFim`, `totalRepeticoes`, `totalGerados`, `status`, `ciclosPulados`, `ultimoCicloProcessado`) não muda.

### `Transacao.pagamentos[].contaFixaId`

Sem alteração.

## Backend — serviço e validação

### `backend/src/services/contaFixaService.js`

- `montarPagamentos()` (calculava por percentual via `decimal.js`) é **removido**. Os valores por pessoa já vêm prontos no `pagamentosTemplate`, não precisam de cálculo.
- `gerarTransacaoParaCiclo` (modo automático): copia `contaFixa.pagamentosTemplate` diretamente para os `pagamentos` da `Transacao` gerada (cópia defensiva — novo array/objetos, não referência ao subdocumento do Mongoose).
- `confirmarPendencia` (modo confirmação manual):
  - Passa a **exigir** `dadosConfirmados.pagamentos` (array completo vindo da tela de Pendências, montado pelo mesmo `buildPagamentosPayload()` do `usePagamentos`) em vez do fallback por percentual.
  - `dadosConfirmados.valor` continua existindo como o total de referência (equivalente ao `valorTotal` da aba Principal na transação) — mas quem garante a divisão é o array `pagamentos` enviado.
  - **Adiciona validação de soma no backend**, reaproveitando `transacaoService.validarSomaPagamentos({ valor }, pagamentos)` — hoje essa rota não validava nada, então uma chamada direta à API (sem passar pela UI) podia gravar pagamentos que não batem com o valor. Mesma tolerância de R$0,01 usada em toda a validação de soma do sistema.

### `backend/src/controllers/contaFixaController.js`

- `criar` e `atualizar`: a validação `somaPercentual === 100` é substituída por `validarSomaPagamentos({ valor: valorEsperado }, pagamentosTemplate)` (reuso da mesma função de `transacaoService` usada na criação de transação) — unifica a regra de "soma bate com o total" numa única implementação em todo o sistema, em vez de duas paralelas.
- Campo obrigatório `pagamentosTemplate` (array não-vazio) continua sendo checado.

## Frontend

### `controle-gastos-frontend/src/components/Transaction/TabPagamentos.js`

- Nova prop `enableEmprestimo` (default `true`). A condição que hoje é `mostrarColunaEmprestimo = pagamentos.length > 1` passa a ser `enableEmprestimo && pagamentos.length > 1`.
- `NovaTransacaoForm` continua funcionando sem alteração (usa o default `true`).
- Nenhuma outra mudança no componente — todo o resto (adicionar/remover/duplicar, rateio igual, dividir em N, presets, fixar valor, distribuir restante, tags por pagamento) é reaproveitado como está.

### `controle-gastos-frontend/src/hooks/usePagamentos.js`

Sem alteração — já lida corretamente com a ausência de dados de parcelamento/empréstimo.

### `controle-gastos-frontend/src/pages/ContasFixas/ContaFixaFormModal.js`

- A seção manual de "Divisão de pagamento" (inputs de pessoa/percentual montados à mão) é substituída por `usePagamentos` + `<TabPagamentos enableEmprestimo={false} valorTotal={form.valorEsperado} ... />`, mesma composição usada em `NovaTransacaoForm`.
- Aba "Resumo" do modal: blocos de consistência atualizados para refletir valor em R$ em vez de percentual (mesma estrutura de blocos, só o texto/cálculo muda).

### `controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js`

- Cada card de pendência passa a abrir com `usePagamentos` + `<TabPagamentos enableEmprestimo={false} />`, pré-preenchida com os valores de `pagamentosTemplate` daquela conta fixa, permitindo reajustar por pessoa antes de confirmar (em vez do único campo de "valor total" editável que existe hoje).
- Botão "Confirmar lançamento" envia o array `pagamentos` completo (via `buildPagamentosPayload()`), não mais um `valor` solto.
- Botão "Confirmar" só habilita quando a soma bate com o total (mesma regra `isValid()` do `usePagamentos`), evitando depender só da validação do backend.

## Casos de borda

- **Editar uma Conta Fixa existente mudando `valorEsperado` sem reajustar a divisão**: a soma fica desbalanceada e o formulário bloqueia o salvamento — mesmo comportamento já existente hoje ao editar o valor total de uma transação com múltiplos pagamentos.
- **Formato antigo (`percentual`) deixa de ser aceito pela API** a partir dessa mudança. Sem impacto em dados existentes (nenhuma Conta Fixa cadastrada ainda).

## Testes

- `backend/src/services/__tests__/contaFixaService.test.js` cobre hoje a lógica antiga (`montarPagamentos` por percentual) — precisa ser reescrito para o novo formato (valor direto, sem cálculo de escala). Não é regressão, é atualização esperada da suíte para acompanhar a mudança de modelo.
- Segue a mesma cobertura de lógica pura já existente: cálculo de ciclo, dia inválido no mês, `vencimentoMesSeguinte`, geração de transação a partir do template.
- Manual: roteiro guiado (conforme `CLAUDE.md`) cobrindo criação/edição de Conta Fixa com a nova aba de Pagamentos, geração automática, e fluxo de confirmação/pular com divisão editável.

## Relação com o spec anterior

Este documento **substitui** a seção "`pagamentosTemplate` guarda percentuais" e o trecho correspondente do modelo de dados em `2026-08-05-conta-fixa-design.md`. O restante daquele spec (mecanismo de cron, dois modos automático/confirmação, cálculo de ciclo, encerramento automático) permanece válido e não é alterado por esta mudança.

## Fora de escopo

- Migration de dados (não há Contas Fixas cadastradas).
- Qualquer alteração no mecanismo de cron, cálculo de ciclo, ou fluxo automático x confirmação manual — só a estrutura de divisão de pagamento muda.
