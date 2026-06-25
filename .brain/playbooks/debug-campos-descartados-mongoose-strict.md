---
type: playbook
status: active
created: 2026-06-25
tags: [mongoose, strict-mode, debug, schema, backend, emprestimos, lição-aprendida]
---

# Como debugar campos descartados pelo Mongoose strict mode

> **Lição aprendida:** Mongoose tem `strict: true` por padrão. Campos extras no body do request são **descartados silenciosamente** — sem erro, sem warning. Isso causa bugs onde "o frontend envia X mas o backend não persiste X" e o developer não entende por quê.
>
> Esta playbook é o resultado de um bug real que aconteceu em 2026-06-25 no módulo de Empréstimos: o frontend enviava `pagamentos[i].valorEsperadoRetorno = 500` mas o Mongoose descartava silenciosamente porque o `PagamentoSchema` não tinha esse campo. Resultado: o `calcularTotais` lia `null` e o "Valor esperado" do Empréstimo aparecia zerado na UI.

## Sintomas clássicos

Você está convencido de que está enviando um campo no payload, mas o backend não está persistindo. Possíveis sintomas:

1. **Frontend envia o campo, mas UI mostra valor zerado/errado** ao recarregar.
2. **Backend retorna sucesso** (HTTP 200/201), mas o documento no banco **não tem o campo** que você esperava.
3. **Sem nenhum erro no console** — o `Mongoose strict` engole campos extras sem aviso.
4. **O `await model.save()` retorna o documento** (sem throw), mas o `model.valor` no banco está `undefined` ou `null`.

## Como confirmar que é strict mode (diagnóstico em 3 passos)

### Passo 1 — Verificar se o schema tem o campo

```bash
# Abra o schema Mongoose
code backend/src/models/<recurso>.js
# Procure pelo nome do campo
```

Se o campo **NÃO** está no schema, **é strict mode descartando**.

### Passo 2 — Verificar o que o frontend envia

No DevTools do browser, abra a aba Network, dispare a request, e veja o body (em JSON ou form-data). Confirme que o campo está lá.

### Passo 3 — Verificar o que o backend persiste

Rode direto no MongoDB (via Compass, `mongosh`, ou um `console.log` no controller após o `save()`):

```js
// No controller, ANTES do save:
console.log('Body recebido:', JSON.stringify(req.body, null, 2));
// DEPOIS do save:
const salvo = await model.save();
console.log('Doc salvo:', JSON.stringify(salvo.toObject(), null, 2));
```

Se o campo está no body mas **NÃO** está no doc salvo → **é strict mode**.

## Causa raiz

Por padrão, Mongoose cria Schemas com `strict: true`. Isso significa:

```js
const TransacaoSchema = new mongoose.Schema({
  // campo: 'descricao', valor: 'Pix', ...
  // sem `valorEsperadoRetorno` definido
});

// Mongoose descarta silenciosamente o campo extra
const t = new Transacao({ valorEsperadoRetorno: 500 });
await t.save();
// t.valorEsperadoRetorno === undefined (sem erro, sem warning)
```

**Comportamento documentado:** https://mongoosejs.com/docs/guide.html#strict — "The strict option ensures that values passed to our model constructor that were not specified in our schema do not get saved to the db."

## Como resolver

### Solução 1 — Adicionar o campo no schema (RECOMENDADO na maioria dos casos)

Se o campo é legítimo e deveria ser persistido, adicione ele no schema:

```js
const PagamentoSchema = new mongoose.Schema({
  pessoa: { type: String, required: true },
  valor: { type: Number, required: true },
  // ... outros campos ...
  // ADICIONAR:
  valorEsperadoRetorno: { type: Number, min: 0, default: null }
});
```

Depois rodar o código que cria/salva e verificar que o campo aparece no banco.

### Solução 2 — Definir o schema como `strict: false` (NÃO recomendado)

```js
const TransacaoSchema = new mongoose.Schema({ ... }, { strict: false });
```

⚠️ **NÃO faça isso em produção** — desabilita a proteção contra typos e campos órfãos. Só use em seeds/mocks/migrations controladas.

### Solução 3 — Usar o `Schema.Types.Mixed` para campos dinâmicos (raro)

```js
const metadataSchema = new mongoose.Schema({}, { strict: false });
```

Útil para metadata flexível (ex: `payload.importacao`). Mas evite para campos de negócio que têm schema definido.

## Como PREVENIR no design doc

Quando for adicionar um campo novo no schema (em qualquer projeto Mongoose), o design doc deve ter:

- [ ] **Schema Mongoose** — o campo novo declarado
- [ ] **Controller** — o controller que recebe o campo via `req.body.<campo>` e atribui via `model.<campo> = valor`
- [ ] **Teste manual** — após `save()`, ler o documento do banco (não apenas confiar no retorno do save) e confirmar que o campo foi persistido

## Como PREVENIR no code review

Ao revisar uma PR que adiciona campo novo no schema, conferir:

1. O frontend envia o campo no payload correto (Network tab)
2. O controller **explicitamente** lê `req.body.<campo>` e atribui no model (não basta confiar que o `new Model(req.body)` vai funcionar)
3. O Mongoose schema tem o campo declarado
4. Existe teste que verifica que o campo foi persistido (lendo o doc do banco, não apenas o retorno do `save()`)

## Lição mais ampla: "Mongoose strict mode é traiçoeiro"

O Mongoose strict mode é uma feature de segurança (protege contra typos, campos órfãos, injeção de campos não-documentados). Mas é **traiçoeiro** porque o comportamento é **silencioso** — não dá erro, não dá warning. O developer precisa saber que existe pra diagnosticar.

**Regra de ouro:** sempre que o frontend enviar um campo novo, o backend **explicitamente** precisa ler e atribuir. Não confiar em `new Model(req.body)` sozinho.

## Quando aconteceu (referência histórica)

- **Data:** 2026-06-25
- **Sintoma:** rota `/emprestimos/6a3d89d247d8139331d2ab42` (Empréstimo "Estrela") mostrava "Valor esperado R$ 0,00" na UI, mas o frontend enviava `valorEsperadoRetorno: 500` no payload
- **Causa raiz:** `PagamentoSchema` (em `backend/src/models/transacao.js`) não tinha o campo `valorEsperadoRetorno`. Mongoose strict mode descartava silenciosamente.
- **Solução:** adicionou o campo no `PagamentoSchema`. 4 testes novos cobrindo o cenário.
- **Aprendizado:** sempre verificar persistência lendo o banco, não apenas o retorno do `save()`.

## Links relacionados

- Sessão: [`2026-06-25-emprestimos-pos-execucao-consolidada.md`](../sessions/2026-06-25-emprestimos-pos-execucao-consolidada.md)
- ADR: [`2026-06-25-emprestimo-dois-caminhos.md`](../decisions/2026-06-25-emprestimo-dois-caminhos.md)
- Mongoose docs: https://mongoosejs.com/docs/guide.html#strict
