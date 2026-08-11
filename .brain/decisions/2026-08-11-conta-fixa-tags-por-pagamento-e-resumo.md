---
type: decision
status: active
created: 2026-08-11
tags: [conta-fixa, tags, categorias, pagamentos, ui, arquitetura]
related:
  - .brain/context/conta-fixa.md
  - .brain/context/tags-categorias.md
  - .brain/decisions/2026-08-11-mostrar-no-lancamento.md
---

# ADR-023: Conta Fixa — tags por pagamento (não mais globais) e aba de Resumo

## Contexto

O modal de Conta Fixa (`ContaFixaFormModal.js`) tinha uma estrutura diferente do modal de Transações normais: a lista de pagamentos (pessoa + percentual) era uma seção, e as tags/categorias eram outra seção **separada e global** (`TagSelector` único, fora do loop, ligado a `form.tagsPadrao`) — uma categoria só, valendo pra conta fixa inteira, independente de quem é a pessoa.

No modal de Transações (`TabPagamentos.js`), o `TagSelector` é renderizado **dentro do loop** de cada pagamento, ligado a `pag.paymentTags` — cada pagamento é uma unidade fechada: pessoa + valor + tags. Usuário pediu para igualar o comportamento.

Achado durante a investigação: o schema do backend (`ContaFixa.pagamentosTemplate[].tagsOverride`) e o serviço de geração (`contaFixaService.js` → `montarPagamentos`) **já suportavam** tags por pagamento, com fallback pro `tagsPadrao` global — só a UI nunca escrevia nesse campo. Não foi necessária nenhuma mudança de backend/schema.

## Decisão

- **Tags por pagamento na UI:** o `TagSelector` foi movido para dentro do loop de `pagamentosTemplate` em `ContaFixaFormModal.js`, escrevendo em `tagsOverride` de cada item (mesmo padrão de `paymentTags` em Transações). A seção separada "Categoria/tags padrão" foi removida da UI.
- **Compatibilidade com dados antigos:** ao editar uma `ContaFixa` já existente (que só tem `tagsPadrao` preenchido, sem `tagsOverride` por item), a exibição de cada pagamento usa `tagsOverride ?? tagsPadrao` como fallback — o usuário não vê tags "sumindo" ao abrir para editar. A partir do momento em que ele mexe nas tags de qualquer pagamento específico, esse item passa a ter seu próprio `tagsOverride`, e os demais continuam caindo no `tagsPadrao` antigo até serem editados também.
- **`tagsPadrao` não foi removido do schema** — continua existindo como fallback de leitura para registros antigos e é o que `montarPagamentos()` usa quando um item não tem `tagsOverride`. Não há migration: dado legado continua funcionando sem alteração.
- **Aba "Resumo" nova:** o modal, que antes era um formulário de rolagem única, ganhou duas abas (reusando os componentes visuais `transacao-tabs-bar`/`transacao-tab` e as classes de `TabResumo.css`, já existentes para o modal de Transações): "Principal" (o formulário) e "Resumo" — mostra dados básicos, soma de percentuais (badge OK/Divergente), valor calculado por pessoa (percentual × valor esperado) com suas tags, e uma seção de "Consistência" (pessoa sem nome, percentual zerado, pessoas duplicadas, nenhuma tag aplicada). Implementado inline no próprio `ContaFixaFormModal.js` (não como componente `TabResumo` compartilhado), porque a estrutura de dados de Conta Fixa (`pagamentosTemplate`/percentual) é diferente o suficiente da de Transação (`pagamentos`/valor) para não valer a pena abstrair uma única fonte agora.

## Consequências

- Pró: modelo mental único entre os dois modais — "um pagamento é pessoa + valor/percentual + tags", sem exceção pra Conta Fixa.
- Pró: sem mudança de backend/migration — o campo `tagsOverride` já existia, só não era escrito pela UI.
- Pró: aba de Resumo dá visibilidade prévia do que vai ser gerado a cada ciclo (valor por pessoa, tags aplicadas) antes de salvar a regra recorrente.
- Contra: cada pagamento agora pode divergir de tag entre si (era garantido ser uniforme antes, por só existir um `tagsPadrao` editável). Efeito colateral aceito, é o mesmo comportamento que já existe em Transações.
- Contra: `tagsPadrao` fica um campo "morto" no schema pra registros novos (sempre vai ter `tagsOverride` preenchido em cada item pela UI atual) — mantido só por compatibilidade com dado legado, não interromper se um dia quiser limpar via migration.
