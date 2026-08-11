# Design: Apelido de descrição para transações

- **Data:** 2026-08-11
- **Status:** Aprovado (aguardando plano de implementação)
- **Autor:** Alisson (com Claude)

## Contexto e problema

Transações vindas de importação em massa (principalmente faturas de cartão, ex: Nubank) chegam com descrições genéricas geradas pelo banco — especialmente compras no Mercado Livre, onde o texto é algo como `Mercadolivre*Ohmybag - Parcela 10/12`, sem indicação nenhuma do que foi comprado. Isso prejudica a leitura de relatórios e da listagem de transações.

O sistema hoje depende do texto cru de `descricao` em dois mecanismos críticos:

1. **Deduplicação na importação em massa** (`backend/src/services/importacaoService.js`): a `deduplicationKey` é um SHA256 de `usuarioId | descricao_normalizada | valor | data | tipo | identificador [| installmentGroupId | installmentNumber]`. Há também um matching fuzzy de "possível duplicata" (`buscarPossivelDuplicata`) por regex exata sobre `descricao` dentro de uma janela de ±7 dias.
2. **Inferência de "provavelmente de X"** (`backend/src/services/inferenciaPessoaService.js`): identifica de qual participante da conta compartilhada é uma transação, comparando `descricao` (com o sufixo de parcela removido) contra o histórico de transações reais via regex exata.

Qualquer alteração no texto ou na normalização de `descricao` quebra os dois mecanismos simultaneamente. Por isso, editar a descrição diretamente não é uma opção segura.

**Achado relevante de investigação:** o parser usado para fatura Nubank (`nubankFatura.js`, formato `date,title,amount`) não interpreta o sufixo `- Parcela X/Y` nem gera `installmentGroupId` — cada parcela importada é uma transação solta, sem vínculo de grupo com as parcelas de outros meses. Isso significa que não existe hoje infraestrutura para ligar automaticamente "Parcela 10/12" de um mês com "Parcela 11/12" do mês seguinte. Um mecanismo de vínculo manual de parcelas fica fora do escopo deste spec (ver "Fora de escopo").

## Objetivo

Permitir que o usuário edite manualmente a descrição exibida de uma transação (ex: trocar `Mercadolivre*Ohmybag - Parcela 10/12` por `Capa de celular`), **sem afetar** a deduplicação de importação nem a inferência de pessoa, que devem continuar operando sobre o texto original vindo do banco.

## Abordagem escolhida

Campo novo e desacoplado — `descricaoApelido` — adicionado a `Transacao` e `TransacaoImportada`, opcional, que nunca substitui `descricao`. Toda a exibição (listagem, relatórios, PDF, busca) passa a usar um campo derivado `descricaoExibicao = descricaoApelido || descricao`. Os mecanismos de deduplicação e inferência de pessoa continuam lendo exclusivamente `descricao`, sem nenhuma alteração de lógica.

### Alternativas consideradas

- **Trocar o papel dos campos** (mover o texto cru do banco para um novo `descricaoOriginal`, deixar `descricao` livremente editável e redirecionar dedup/inferência para ler `descricaoOriginal`): rejeitada por exigir migração de dados em transações existentes e por aumentar o risco de regressão em dois subsistemas sensíveis (dedup e inferência de pessoa) que hoje funcionam. O ganho (não precisar tocar em telas de exibição) não compensa o risco.
- **Nota/anotação secundária exibida ao lado da descrição original** (sem substituir): rejeitada porque o usuário definiu explicitamente que o apelido deve substituir a descrição na exibição principal, com o original disponível como informação secundária (tooltip/expandir), não lado a lado.

## Fora de escopo (fica para spec futuro)

- Vínculo manual entre parcelas de meses diferentes com a mesma descrição-base (modal de sugestão por heurística: descrição-base igual, valor próximo, número de parcela sequencial, espaçamento de data plausível). Depende de decisões de UX próprias e não é necessário para a maioria das transações do Mercado Livre, que não são parceladas.
- Qualquer geração automática/sugerida de apelido (categorização automática, regras). O usuário definiu que quer edição manual pontual nesta rodada.
- Parsing de `installmentGroupId` a partir do texto da fatura Nubank (`nubankFatura.js`) — necessário caso o vínculo de parcelas do item acima seja implementado no futuro, mas não faz parte deste spec.

## Modelo de dados

Em `backend/src/models/transacao.js` e `backend/src/models/transacaoImportada.js`, adicionar:

```js
descricaoApelido: { type: String, default: null, trim: true, maxlength: 200 }
```

- Sem índice — o campo não participa de dedup nem de query de match, só de exibição e busca textual simples.
- Sem migração/backfill: transações existentes ficam com `descricaoApelido: null`; a regra de exibição já cai para `descricao` original nesse caso.
- `TransacaoImportada.paraTransacao()` propaga `descricaoApelido` para a `Transacao` real ao finalizar a importação.

## Backend — o que muda

- Endpoint de edição de transação importada (rota de atualização em `transacaoImportadaController.js`, usada na tela de revisão) passa a aceitar `descricaoApelido` no body.
- Endpoint de edição de transação já finalizada (`controladorTransacao.js`) passa a aceitar `descricaoApelido` no body. Validação: string opcional, até 200 caracteres, sem envolvimento de `decimal.js` (não é campo financeiro).
- Serialização de transação para qualquer resposta de API (listagem, relatório, PDF) expõe um campo derivado `descricaoExibicao = descricaoApelido || descricao`, centralizando a regra de fallback em vez de replicá-la em cada tela do frontend.

## Backend — o que explicitamente NÃO muda

- `gerarDeduplicationKey()` continua lendo somente `descricao`.
- `classificarTransacoes()` e `buscarPossivelDuplicata()` continuam comparando somente `descricao`.
- `inferenciaPessoaService.js` continua fazendo o match de pessoa somente por `descricao` (com o sufixo de parcela removido, como hoje).
- Único ajuste cosmético permitido: ao montar `pessoaSugeridaSample` (a transação de exemplo mostrada no badge "Provavelmente de X" e no modal de sugestão), se a transação de exemplo tiver `descricaoApelido`, usar esse valor na exibição do exemplo em vez do texto cru — apenas para facilitar o reconhecimento visual da compra pelo usuário ao decidir aceitar a sugestão. Isso não altera o algoritmo de match, só o texto mostrado de um resultado já calculado.

## Frontend — edição

- **Tela de revisão de importação** (`ListaTransacoesImportadas.js`): campo de descrição passa a ser editável inline. Input pré-preenchido com `descricao` original; ao salvar uma edição, grava em `descricaoApelido` (nunca sobrescreve `descricao`).
- **Tela de Transações** (fluxo de edição em `TransactionRow.js` / modal de edição de transação): mesmo padrão — input pré-preenchido com o valor atual de exibição (`descricaoApelido || descricao`), salva em `descricaoApelido`.
- Indicador visual sutil quando `descricaoApelido` existe e diverge do texto original (ex: ícone ou estilo diferenciado), com o texto original acessível via tooltip/expandir.

## Frontend — exibição e busca

- `TransactionRow.js`, `TransactionsTable.js` (PDF) e as telas/serviços de relatório (`ruleEngine.js`, `filterService.js`) passam a exibir `descricaoExibicao` em vez de `descricao` diretamente.
- Busca e filtro por texto (ex: `Transacoes.js`, filtro de relatório) passam a buscar em `descricaoApelido` OU `descricao`, preservando a busca por transações antigas sem apelido e por quem lembrar do texto original do banco.

## Teste

Esta mudança não toca `ledgerService` nem `netWorthService`, então não exige rodar `npm test` do backend como critério de aceite — mas deve ser validada manualmente:

1. Importar uma fatura com uma linha como `Mercadolivre*Ohmybag - Parcela 10/12`.
2. Na tela de revisão, editar a descrição para algo específico (ex: "Capa de celular").
3. Finalizar a importação e conferir que a transação aparece com o apelido na listagem de Transações, no relatório e no PDF exportado.
4. Reimportar a mesma fatura (ou uma fatura do mês seguinte com uma linha equivalente) e confirmar que a deduplicação continua funcionando normalmente (nenhuma duplicata indevida, nenhuma transação nova perdida).
5. Confirmar que o badge "Provavelmente de X" continua aparecendo corretamente para transações recorrentes conhecidas, mesmo após um apelido ser definido em uma delas.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Alguém assumir que editar o apelido também muda a chave de dedup | Documentado explicitamente neste spec; nenhum código de dedup é tocado, então não há como isso acontecer por engano |
| Campo `descricaoExibicao` não sincronizado entre as várias telas que exibem descrição | Centralizado na serialização do backend, não implementado individualmente em cada tela do frontend |
| Confusão do usuário sobre qual é o texto "real" da transação | Indicador visual + acesso ao texto original via tooltip/expandir |
