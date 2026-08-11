# Apelido de Descrição para Transações — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário edite a descrição exibida de uma transação (ex: trocar "Mercadolivre*Ohmybag - Parcela 10/12" por "Capa de celular") sem afetar a deduplicação de importação nem a inferência de pessoa da conta compartilhada, que devem continuar lendo o texto original vindo do banco.

**Architecture:** Campo novo e desacoplado `descricaoApelido` em `Transacao` e `TransacaoImportada`, opcional, que nunca substitui `descricao`. Toda a exibição (listagem, relatórios, PDF, busca) usa `descricaoApelido || descricao` como regra de fallback — resolvida no backend para relatórios (`reportEngine`) e via util compartilhado no frontend para as demais telas. `gerarDeduplicationKey()` e `inferenciaPessoaService.js` continuam lendo exclusivamente `descricao`, sem nenhuma alteração de lógica de match.

**Tech Stack:** Node.js/Express + Mongoose (backend), React 19 (frontend). Sem TDD automatizado nesta mudança — o projeto não expande cobertura de teste por padrão (só `ledgerService`/`netWorthService` têm suíte, nenhum dos dois é tocado aqui); validação é manual, roteirizada na Task 9.

## Global Constraints

- Nunca alterar a lógica de `gerarDeduplicationKey()`, `classificarTransacoes()` ou `buscarPossivelDuplicata()` em `backend/src/services/importacaoService.js` — nenhuma dessas funções deve ler `descricaoApelido`.
- Nunca alterar o algoritmo de match de `inferenciaPessoaService.js` (`buscarMatchesHistorico`, `inferirPessoaPorDescricao`) — continuam comparando somente `descricao`.
- Nenhum endpoint deve permitir sobrescrever `descricao` (o texto original do banco) em uma `Transacao` ou `TransacaoImportada` já criada a partir de importação — edições de usuário vão sempre para `descricaoApelido`.
- Campo `descricaoApelido`: `String`, opcional, `default: null`, `trim: true`, `maxlength: 200`, sem índice.
- Sem migration/backfill — transações existentes ficam com `descricaoApelido: null`.

---

### Task 1: Adicionar `descricaoApelido` aos models `Transacao` e `TransacaoImportada`

**Files:**
- Modify: `backend/src/models/transacao.js:28-29`
- Modify: `backend/src/models/transacaoImportada.js:36-39`
- Modify: `backend/src/models/transacaoImportada.js:189-213` (método `paraTransacao`)

**Interfaces:**
- Produces: campo `descricaoApelido` (string ou null) em ambos os schemas; `TransacaoImportada.paraTransacao()` agora inclui `descricaoApelido` no objeto retornado.

- [ ] **Step 1: Adicionar o campo em `Transacao`**

Em `backend/src/models/transacao.js`, logo após a linha 28 (`descricao: { type: String, required: true },`), adicionar:

```js
  descricao: { type: String, required: true },
  descricaoApelido: { type: String, default: null, trim: true, maxlength: 200 },
```

- [ ] **Step 2: Adicionar o campo em `TransacaoImportada`**

Em `backend/src/models/transacaoImportada.js`, logo após o bloco `descricao` (linhas 36-39), adicionar:

```js
  descricao: { 
    type: String, 
    required: true 
  },
  descricaoApelido: {
    type: String,
    default: null,
    trim: true,
    maxlength: 200
  },
```

- [ ] **Step 3: Propagar o campo em `paraTransacao()`**

Em `backend/src/models/transacaoImportada.js`, dentro do método `paraTransacao` (linhas 193-211), adicionar a chave `descricaoApelido` ao objeto `result`, logo após `descricao`:

```js
  const result = {
    tipo: this.tipo,
    descricao: this.descricao,
    descricaoApelido: this.descricaoApelido || null,
    valor: this.valor,
    ...
```

- [ ] **Step 4: Verificar manualmente**

Rodar `node -e "require('./src/models/transacao'); require('./src/models/transacaoImportada'); console.log('OK')"` a partir de `backend/` para garantir que os schemas carregam sem erro de sintaxe.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/transacao.js backend/src/models/transacaoImportada.js
git commit -m "feat(transacoes): adiciona campo descricaoApelido aos models de Transacao e TransacaoImportada"
```

---

### Task 2: Endpoints de edição passam a aceitar `descricaoApelido` (e param de bloquear edição direta de `descricao`)

**Files:**
- Modify: `backend/src/controllers/transacaoImportadaController.js:74`
- Modify: `backend/src/controllers/controladorTransacao.js:695-708`

**Interfaces:**
- Consumes: campo `descricaoApelido` do model (Task 1).
- Produces: `PUT /api/importacoes/transacoes/:id` e `PUT /api/transacoes/:id` aceitam `descricaoApelido` no body; nenhum dos dois aceita mais `descricao` como campo livremente sobrescrevível vindo do usuário.

- [ ] **Step 1: `transacaoImportadaController.js` — remover `descricao` de `camposPermitidos`, adicionar `descricaoApelido`**

Em `backend/src/controllers/transacaoImportadaController.js:74`, trocar:

```js
      const camposPermitidos = ['descricao', 'valor', 'data', 'tipo', 'observacao', 'pagamentos', 'subconta', 'emprestimoId', 'emprestimoConfig'];
```

por:

```js
      const camposPermitidos = ['descricaoApelido', 'valor', 'data', 'tipo', 'observacao', 'pagamentos', 'subconta', 'emprestimoId', 'emprestimoConfig'];
```

O restante da função (`camposPermitidos.forEach(...)`, linhas 76-118) já trata qualquer campo simples da lista como `transacao[campo] = req.body[campo]`, então `descricaoApelido` é tratado automaticamente sem lógica adicional — só `pagamentos` tem tratamento especial, que não muda.

- [ ] **Step 2: `controladorTransacao.js` — aceitar `descricaoApelido`, parar de aceitar `descricao` do body**

Em `backend/src/controllers/controladorTransacao.js:703`, trocar:

```js
    transacao.descricao = req.body.descricao || transacao.descricao;
```

por:

```js
    if (req.body.descricaoApelido !== undefined) {
      transacao.descricaoApelido = req.body.descricaoApelido || null;
    }
```

Isso remove a única forma pela qual esse endpoint sobrescrevia `descricao` diretamente. Transações criadas manualmente (sem importação) já têm sua `descricao` definida na criação (`POST /api/transacoes`, não tocado por este plano) e não precisam editá-la depois via este fluxo neste momento — se o usuário quiser corrigir a descrição de uma transação manual, o apelido cumpre esse papel igualmente bem.

- [ ] **Step 3: Verificar manualmente**

Com o backend rodando (`npm run dev` em `backend/`), usar um cliente HTTP (ou o próprio frontend após a Task 6/7) para:
1. `PUT /api/importacoes/transacoes/:id` com `{ "descricaoApelido": "Teste" }` → resposta 200 com `descricaoApelido: "Teste"` e `descricao` inalterado.
2. `PUT /api/transacoes/:id` com `{ "descricaoApelido": "Teste 2" }` → resposta 200 com `descricaoApelido: "Teste 2"` e `descricao` inalterado.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/transacaoImportadaController.js backend/src/controllers/controladorTransacao.js
git commit -m "feat(transacoes): endpoints de edição passam a gravar descricaoApelido em vez de sobrescrever descricao"
```

---

### Task 3: Sample de inferência de pessoa passa a expor `descricaoApelido` (sem alterar o match)

**Files:**
- Modify: `backend/src/models/transacaoImportada.js:128-134` (subschema `pessoaSugeridaSample`)
- Modify: `backend/src/services/inferenciaPessoaService.js:50-57` (`.select(...)` da query) e `:124-131` (montagem do `sample`)

**Interfaces:**
- Consumes: `descricaoApelido` do model `Transacao` (Task 1).
- Produces: `pessoaSugeridaSample.descricaoApelido` (string ou null), consumido pelo frontend na Task 9.

- [ ] **Step 1: Adicionar `descricaoApelido` ao subschema `pessoaSugeridaSample`**

Em `backend/src/models/transacaoImportada.js:128-134`, trocar:

```js
  pessoaSugeridaSample: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao' },
    descricao: { type: String },
    data: { type: Date },
    valor: { type: Number },
    pessoa: { type: String }
  },
```

por:

```js
  pessoaSugeridaSample: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao' },
    descricao: { type: String },
    descricaoApelido: { type: String, default: null },
    data: { type: Date },
    valor: { type: Number },
    pessoa: { type: String }
  },
```

- [ ] **Step 2: Incluir `descricaoApelido` na projeção da query de histórico**

Em `backend/src/services/inferenciaPessoaService.js:56`, trocar:

```js
    .select('_id descricao valor data pagamentos')
```

por:

```js
    .select('_id descricao descricaoApelido valor data pagamentos')
```

- [ ] **Step 3: Incluir `descricaoApelido` na montagem do `sample`**

Em `backend/src/services/inferenciaPessoaService.js:124-131`, trocar:

```js
      if (!entry.sample) {
        entry.sample = {
          _id: t._id,
          descricao: t.descricao,
          data: t.data,
          valor: t.valor,
          pessoa: pag.pessoa
        };
      }
```

por:

```js
      if (!entry.sample) {
        entry.sample = {
          _id: t._id,
          descricao: t.descricao,
          descricaoApelido: t.descricaoApelido || null,
          data: t.data,
          valor: t.valor,
          pessoa: pag.pessoa
        };
      }
```

Note que `buscarMatchesHistorico` (a query que decide QUAIS transações são consideradas match) continua comparando `descricao` via regex — nenhuma linha dessa função muda. Só passamos a carregar e expor um campo extra do resultado já encontrado.

- [ ] **Step 4: Verificar manualmente**

Rodar o fluxo de importação de uma fatura com uma transação recorrente conhecida (já usada como exemplo em `.brain` ou na fatura de teste) e confirmar via resposta da API (`GET /api/importacoes/:id/transacoes`) que `pessoaSugeridaSample.descricaoApelido` aparece (null se a transação de exemplo nunca recebeu apelido, ou o texto salvo caso tenha).

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/transacaoImportada.js backend/src/services/inferenciaPessoaService.js
git commit -m "feat(inferencia-pessoa): expõe descricaoApelido no sample de sugestão sem alterar o algoritmo de match"
```

---

### Task 4: Relatórios e busca passam a considerar `descricaoApelido`

**Files:**
- Modify: `backend/src/reportEngine/ruleEngine.js:9-40` (`flattenTransactions`)
- Modify: `backend/src/reportEngine/filterService.js:61-68` (`buildMatchFromFilters`, busca por `search`)
- Modify: `backend/src/controllers/controladorTransacao.js:104-111` (`buildMatchStage`, busca por `search`)

**Interfaces:**
- Consumes: `descricaoApelido` do model `Transacao` (Task 1).
- Produces: linhas de relatório (`flattenTransactions`) com `descricao` já resolvida (`descricaoApelido || descricao`); filtro `search` passa a bater em ambos os campos.

- [ ] **Step 1: `ruleEngine.js` — resolver a descrição de exibição ao achatar transações**

Em `backend/src/reportEngine/ruleEngine.js`, a função `flattenTransactions` (linhas 9-40) usa `tr.descricao` em dois pontos (linha 18 e linha 30). Adicionar uma constante local `descricaoExibicao` no início do `forEach` e usá-la nos dois pontos:

```js
function flattenTransactions(transacoes) {
  const flattened = [];
  (transacoes || []).forEach((tr) => {
    const id = tr.id || tr._id;
    const descricaoExibicao = tr.descricaoApelido || tr.descricao;
    if (!tr.pagamentos || tr.pagamentos.length === 0) {
      flattened.push({
        id,
        data: tr.data,
        tipo: tr.tipo,
        descricao: descricaoExibicao,
        valor: tr.valor,
        pessoa: null,
        valorPagamento: 0,
        tagsPagamento: {}
      });
    } else {
      tr.pagamentos.forEach((p) => {
        flattened.push({
          id,
          data: tr.data,
          tipo: tr.tipo,
          descricao: descricaoExibicao,
          valor: tr.valor,
          pessoa: p.pessoa,
          valorPagamento: p.valor,
          tagsPagamento: p.tags || {}
        });
      });
    }
  });
  return flattened;
}
```

- [ ] **Step 2: `filterService.js` — busca por texto considera `descricaoApelido`**

Em `backend/src/reportEngine/filterService.js:61-68`, trocar:

```js
  if (filters.search && filters.search.trim()) {
    const search = filters.search.trim();
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [
      { descricao: regex },
      { 'pagamentos.pessoa': regex }
    ];
  }
```

por:

```js
  if (filters.search && filters.search.trim()) {
    const search = filters.search.trim();
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [
      { descricao: regex },
      { descricaoApelido: regex },
      { 'pagamentos.pessoa': regex }
    ];
  }
```

- [ ] **Step 3: `controladorTransacao.js` — mesma extensão no `buildMatchStage` da listagem paginada**

Em `backend/src/controllers/controladorTransacao.js:104-111`, trocar:

```js
  if (req.query.search && req.query.search.trim()) {
    const search = req.query.search.trim();
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [
      { descricao: regex },
      { 'pagamentos.pessoa': regex }
    ];
  }
```

por:

```js
  if (req.query.search && req.query.search.trim()) {
    const search = req.query.search.trim();
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [
      { descricao: regex },
      { descricaoApelido: regex },
      { 'pagamentos.pessoa': regex }
    ];
  }
```

- [ ] **Step 4: Verificar manualmente**

Definir um apelido em uma transação (via API ou frontend, após Task 6/7), gerar um relatório que a inclua e confirmar que o texto do apelido aparece nas linhas do relatório. Buscar pelo texto do apelido na listagem paginada de transações (`GET /api/transacoes?search=...`) e confirmar que a transação aparece.

- [ ] **Step 5: Commit**

```bash
git add backend/src/reportEngine/ruleEngine.js backend/src/reportEngine/filterService.js backend/src/controllers/controladorTransacao.js
git commit -m "feat(relatorios): relatórios e busca de transações passam a considerar descricaoApelido"
```

---

### Task 5: Util compartilhado de exibição no frontend

**Files:**
- Create: `controle-gastos-frontend/src/utils/descricaoUtils.js`

**Interfaces:**
- Produces: `getDescricaoExibicao(transacao: { descricao: string, descricaoApelido?: string|null }): string` — usado pelas Tasks 6, 8 e 9.

- [ ] **Step 1: Criar o util**

```js
// src/utils/descricaoUtils.js

/**
 * Retorna o texto de descrição a ser exibido: o apelido definido pelo
 * usuário, se existir, ou a descrição original (vinda do banco/import ou
 * digitada manualmente) caso contrário.
 */
export function getDescricaoExibicao(transacao) {
  if (!transacao) return '';
  return transacao.descricaoApelido || transacao.descricao || '';
}
```

- [ ] **Step 2: Verificar manualmente**

Não há suíte de teste de frontend configurada (`npm test` do CRACO ainda sem arquivos de teste, conforme `CLAUDE.md`). Validar via uso real nas Tasks 8 e 9.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/utils/descricaoUtils.js
git commit -m "feat(frontend): adiciona util getDescricaoExibicao para resolver apelido vs. descrição original"
```

---

### Task 6: Tela de revisão de importação — editar `descricaoApelido`, exibir com fallback

**Files:**
- Modify: `controle-gastos-frontend/src/components/ImportacaoMassa/RevisaoImportacao/ListaTransacoesImportadas.js`

**Interfaces:**
- Consumes: `getDescricaoExibicao` (Task 5); endpoint `PUT /api/importacoes/transacoes/:id` aceitando `descricaoApelido` (Task 2).

- [ ] **Step 1: Importar o util**

No topo do arquivo, junto aos demais imports (linha 1-6):

```js
import { getDescricaoExibicao } from '../../../utils/descricaoUtils';
```

- [ ] **Step 2: Pré-preencher o form de edição com o valor de exibição atual**

Em `handleEditarClick` (linhas 41-50), trocar:

```js
  const handleEditarClick = (transacao) => {
    setTransacaoEditando(transacao.id);
    setFormData({
      descricao: transacao.descricao,
      valor: transacao.valor.toString(),
      data: transacao.data,
      categoria: transacao.categoria,
      tipo: transacao.tipo
    });
  };
```

por:

```js
  const handleEditarClick = (transacao) => {
    setTransacaoEditando(transacao.id);
    setFormData({
      descricao: getDescricaoExibicao(transacao),
      valor: transacao.valor.toString(),
      data: transacao.data,
      categoria: transacao.categoria,
      tipo: transacao.tipo
    });
  };
```

- [ ] **Step 3: Enviar a edição como `descricaoApelido`, não como `descricao`**

Em `handleSalvarEdicao` (linhas 63-76), trocar:

```js
  const handleSalvarEdicao = async (transacaoId) => {
    try {
      const transacaoAtualizada = {
        ...formData,
        valor: parseFloat(formData.valor)
      };

      await atualizarTransacao(importacaoId, transacaoId, transacaoAtualizada);
      toast.success('Transação atualizada com sucesso!');
      setTransacaoEditando(null);
    } catch (error) {
      toast.error('Erro ao atualizar transação.');
    }
  };
```

por:

```js
  const handleSalvarEdicao = async (transacaoId) => {
    try {
      const { descricao, ...resto } = formData;
      const transacaoAtualizada = {
        ...resto,
        descricaoApelido: descricao,
        valor: parseFloat(formData.valor)
      };

      await atualizarTransacao(importacaoId, transacaoId, transacaoAtualizada);
      toast.success('Transação atualizada com sucesso!');
      setTransacaoEditando(null);
    } catch (error) {
      toast.error('Erro ao atualizar transação.');
    }
  };
```

- [ ] **Step 4: Exibir o texto resolvido na célula de descrição (modo leitura)**

Na tabela (linhas 136-147), trocar:

```jsx
                <td>
                  {transacaoEditando === transacao.id ? (
                    <input
                      type="text"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="edit-input"
                    />
                  ) : (
                    transacao.descricao
                  )}
                </td>
```

por:

```jsx
                <td>
                  {transacaoEditando === transacao.id ? (
                    <input
                      type="text"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="edit-input"
                    />
                  ) : (
                    <span
                      title={
                        transacao.descricaoApelido
                          ? `Original do banco: ${transacao.descricao}`
                          : undefined
                      }
                    >
                      {getDescricaoExibicao(transacao)}
                    </span>
                  )}
                </td>
```

O atributo `title` é um tooltip nativo do navegador (aparece ao passar o mouse) — cumpre o requisito de "original disponível como informação secundária" sem exigir um componente novo.

- [ ] **Step 5: Verificar manualmente**

Com backend e frontend rodando: importar a fatura de teste, editar a descrição de "Mercadolivre*Ohmybag - Parcela 10/12" para "Capa de celular", salvar, e confirmar que (a) a célula passa a mostrar "Capa de celular", (b) passar o mouse sobre o texto mostra "Original do banco: Mercadolivre*Ohmybag - Parcela 10/12" no tooltip.

- [ ] **Step 6: Commit**

```bash
git add controle-gastos-frontend/src/components/ImportacaoMassa/RevisaoImportacao/ListaTransacoesImportadas.js
git commit -m "feat(importacao): edição de descrição na revisão de importação grava em descricaoApelido"
```

---

### Task 7: Edição de transação já finalizada — mesmo comportamento quando a transação veio de importação

**Files:**
- Modify: `controle-gastos-frontend/src/hooks/useTransacaoForm.js`
- Modify: `controle-gastos-frontend/src/components/Transaction/TabPrincipal.js`

**Interfaces:**
- Consumes: `getDescricaoExibicao` (Task 5); `isImportada` (já existente no hook, `useTransacaoForm.js:17`); endpoint `PUT /api/transacoes/:id` aceitando `descricaoApelido` (Task 2).
- Produces: `buildPayload()` do hook emite `descricaoApelido` (não `descricao`) quando `isImportada === true`.

O form de transação é reusado em 5 contextos (nova transação manual, edição de transação, etc. — ver `CLAUDE.md`). Transações **manuais** (não vindas de importação) continuam editando `descricao` normalmente, porque nelas não existe "texto original do banco" a preservar — o texto digitado pelo usuário É a descrição. Só transações com `isImportada === true` passam a gravar em `descricaoApelido`.

- [ ] **Step 1: Pré-preencher o campo `descricao` do hook com o valor de exibição**

Em `controle-gastos-frontend/src/hooks/useTransacaoForm.js`, trocar as duas ocorrências de `transacao.descricao` usadas para inicializar/atualizar o estado (linha 7 e linha 34):

Linha 7:
```js
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
```
vira:
```js
  const [descricao, setDescricao] = useState(transacao ? (transacao.descricaoApelido || transacao.descricao) : '');
```

Linha 34:
```js
      setDescricao(transacao.descricao);
```
vira:
```js
      setDescricao(transacao.descricaoApelido || transacao.descricao);
```

- [ ] **Step 2: `buildPayload` emite `descricaoApelido` para transações importadas**

Em `controle-gastos-frontend/src/hooks/useTransacaoForm.js`, `buildPayload` (linhas 67-78), trocar:

```js
  const buildPayload = useCallback((overrides = {}) => {
    const payload = {
      _id,
      tipo,
      descricao,
      data: toISOStringBR(data),
      valor: parseFloat(valorTotal),
      observacao,
      ...overrides
    };
    return payload;
  }, [_id, tipo, descricao, data, valorTotal, observacao]);
```

por:

```js
  const buildPayload = useCallback((overrides = {}) => {
    const payload = {
      _id,
      tipo,
      data: toISOStringBR(data),
      valor: parseFloat(valorTotal),
      observacao,
      ...(isImportada ? { descricaoApelido: descricao } : { descricao }),
      ...overrides
    };
    return payload;
  }, [_id, tipo, descricao, data, valorTotal, observacao, isImportada]);
```

- [ ] **Step 3: Indicar visualmente no campo quando a transação é importada**

`TabPrincipal` (`controle-gastos-frontend/src/components/Transaction/TabPrincipal.js`) hoje **não** recebe `isImportada` como prop — precisa ser adicionada em dois pontos.

3a. Em `controle-gastos-frontend/src/components/Transaction/TabPrincipal.js:7-15`, adicionar `isImportada` à desestruturação de props:

```js
const TabPrincipal = ({
  tipo, setTipo, tipoRef,
  descricao, setDescricao, descricaoRef,
  data, setData,
  valorTotal, onValorTotalChange, valorRef,
  observacao, setObservacao,
  onToday, onYesterday,
  showValidationWarning,
  isImportada
}) => {
```

3b. No mesmo arquivo, linha 27, trocar:

```jsx
        <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} required ref={descricaoRef} tabIndex={2} />
```

por:

```jsx
        <input
          type="text"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          required
          ref={descricaoRef}
          tabIndex={2}
          title={isImportada ? 'Apelido de exibição — o texto original da importação é preservado para deduplicação' : undefined}
        />
```

3c. Em `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js:368-375` (onde `TabPrincipal` é renderizado), adicionar a prop `isImportada`:

```jsx
        <TabPrincipal
          data-tab="principal"
          tipo={formState.tipo}
          setTipo={fsSetters.setTipo}
          tipoRef={refs.tipoRef}
          descricao={formState.descricao}
          setDescricao={fsSetters.setDescricao}
          descricaoRef={refs.descricaoRef}
          isImportada={formState.isImportada}
```

(mantendo as demais props já existentes nas linhas seguintes inalteradas). `formState.isImportada` já existe no retorno do hook (`useTransacaoForm.js:100`), não precisa de nenhuma mudança adicional no hook para este passo.

- [ ] **Step 4: Verificar manualmente**

1. Criar uma transação manual nova, editar a descrição, salvar, confirmar que o texto salvo aparece em `descricao` (via API ou banco) e `descricaoApelido` continua `null`.
2. Editar uma transação que veio de importação (`isImportada: true`), mudar a descrição, salvar, confirmar que `descricaoApelido` foi gravado e `descricao` original permaneceu intocado.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/hooks/useTransacaoForm.js controle-gastos-frontend/src/components/Transaction/TabPrincipal.js
git commit -m "feat(transacoes): edição de transação importada grava descricaoApelido, preservando descricao original"
```

---

### Task 8: Exibição — listagem de Transações, dashboard e PDF passam a usar o texto resolvido

**Files:**
- Modify: `controle-gastos-frontend/src/components/Transaction/TransactionCard.js:66`
- Modify: `controle-gastos-frontend/src/pages/Home/Home.js:489`
- Modify: `controle-gastos-frontend/src/pages/Transacoes/Transacoes.js:88` e `:188`
- Modify: `controle-gastos-frontend/src/components/PDF/TransactionsTable.js:178`

**Interfaces:**
- Consumes: `getDescricaoExibicao` (Task 5).

- [ ] **Step 1: `TransactionCard.js`**

Em `controle-gastos-frontend/src/components/Transaction/TransactionCard.js:6`, adicionar o import junto aos existentes:

```js
import { getDescricaoExibicao } from '../../utils/descricaoUtils';
```

E trocar a linha 66 de:

```js
            {transacao.descricao}
```

por:

```js
            {getDescricaoExibicao(transacao)}
```

- [ ] **Step 2: `Home.js`**

Importar o util e trocar, na linha 489:

```jsx
                            description={
                              <>
                                {t.descricao}
                                {t.emprestimoInfo && <EmprestimoBadge emprestimoInfo={t.emprestimoInfo} variant="chip" />}
                              </>
                            }
```

por:

```jsx
                            description={
                              <>
                                {getDescricaoExibicao(t)}
                                {t.emprestimoInfo && <EmprestimoBadge emprestimoInfo={t.emprestimoInfo} variant="chip" />}
                              </>
                            }
```

- [ ] **Step 3: `Transacoes.js` — busca por texto (linha 88)**

Trocar:

```js
        const matchDescricao = tr.descricao.toLowerCase().includes(search);
```

por:

```js
        const matchDescricao = getDescricaoExibicao(tr).toLowerCase().includes(search);
```

Adicionar o import do util no topo do arquivo.

- [ ] **Step 4: `Transacoes.js` — template inline de impressão/exportação (linha 188)**

Trocar:

```js
                  <td style="padding:4px 8px;text-align:left">${t.descricao || '—'}</td>
```

por:

```js
                  <td style="padding:4px 8px;text-align:left">${getDescricaoExibicao(t) || '—'}</td>
```

- [ ] **Step 5: `TransactionsTable.js` (PDF)**

Importar o util e trocar a linha 178:

```jsx
                <Text style={styles.tableCell}>{row.descricao || '-'}</Text>
```

por:

```jsx
                <Text style={styles.tableCell}>{getDescricaoExibicao(row) || '-'}</Text>
```

Nota: se `row` aqui já vier pré-processado pelo `ruleEngine.js` (Task 4, que já resolve `descricao` para o valor de exibição antes de montar as linhas do relatório), `row.descricao` já seria o texto certo e essa troca é redundante mas inofensiva — usar `getDescricaoExibicao` mantém o componente correto independente da origem dos dados (relatório processado ou export direto da lista de transações).

- [ ] **Step 6: Verificar manualmente**

1. Definir um apelido em uma transação.
2. Confirmar que ela aparece com o apelido no dashboard (Home), na listagem de Transações, na busca por texto (buscando pelo apelido) e no PDF exportado.

- [ ] **Step 7: Commit**

```bash
git add controle-gastos-frontend/src/components/Transaction/TransactionCard.js controle-gastos-frontend/src/pages/Home/Home.js controle-gastos-frontend/src/pages/Transacoes/Transacoes.js controle-gastos-frontend/src/components/PDF/TransactionsTable.js
git commit -m "feat(frontend): listagem, dashboard, busca e PDF passam a exibir descricaoApelido quando definido"
```

---

### Task 9: Modal de sugestão de pessoa exibe o apelido do exemplo, quando existir

**Files:**
- Modify: `controle-gastos-frontend/src/components/ImportacaoMassa/DetalhesImportacao/ModalSugestaoPessoa.js`
- Modify: `controle-gastos-frontend/src/components/ImportacaoMassa/RevisaoImportacao/ListaTransacoesImportadas.js:1055-1077` (badge "Provavelmente de X")

**Interfaces:**
- Consumes: `pessoaSugeridaSample.descricaoApelido` (Task 3); `getDescricaoExibicao` (Task 5).

- [ ] **Step 1: Card "Como está agora" em `ModalSugestaoPessoa.js` — usar o apelido da própria transação em revisão**

Em `controle-gastos-frontend/src/components/ImportacaoMassa/DetalhesImportacao/ModalSugestaoPessoa.js:149-151`, trocar:

```jsx
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              {transacao.descricao}
            </div>
```

por:

```jsx
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              {transacao.descricaoApelido || transacao.descricao}
            </div>
```

- [ ] **Step 2: Linha de evidência (`EvidenciaLinha`) — usar o apelido do sample histórico**

No mesmo arquivo, linhas 186-195, o componente `EvidenciaLinha` é alimentado por `t.descricao` a partir de `transacoesExemplo = [sample]` (linha 59, onde `sample = transacao.pessoaSugeridaSample || {}`). Trocar:

```jsx
                <EvidenciaLinha
                  key={idx}
                  descricao={t.descricao}
                  data={t.data}
                  valor={t.valor}
                  pessoa={t.pessoa}
                />
```

por:

```jsx
                <EvidenciaLinha
                  key={idx}
                  descricao={t.descricaoApelido || t.descricao}
                  data={t.data}
                  valor={t.valor}
                  pessoa={t.pessoa}
                />
```

Isso usa o campo `pessoaSugeridaSample.descricaoApelido` adicionado na Task 3. Nenhuma mudança é necessária no componente `EvidenciaLinha` em si (linhas 25-44) — ele só recebe `descricao` como string via prop, já resolvida pelo chamador.

- [ ] **Step 3: Badge "Provavelmente de X" em `ListaTransacoesImportadas.js`**

Nas linhas 1055-1077 (badge `sugestao-pessoa-badge`), o badge mostra `transacao.pessoaSugerida` e `transacao.pessoaSugeridaCount`, sem exibir o texto do sample — não há nada a trocar nesse trecho. Este passo existe apenas para registrar que o badge foi conferido e não precisa de alteração.

- [ ] **Step 4: Verificar manualmente**

Gerar uma sugestão de pessoa (importar uma fatura com ≥2 transações recorrentes de uma pessoa não-titular já conhecidas no histórico), definir um apelido em uma das transações históricas usadas como exemplo, reimportar/gerar nova sugestão e confirmar que o modal mostra o apelido (tanto no card "Como está agora" quanto na evidência) em vez do texto cru — sem que isso afete se a sugestão aparece ou não (o match continua por `descricao`).

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/components/ImportacaoMassa/DetalhesImportacao/ModalSugestaoPessoa.js controle-gastos-frontend/src/components/ImportacaoMassa/RevisaoImportacao/ListaTransacoesImportadas.js
git commit -m "feat(inferencia-pessoa): modal e badge de sugestão exibem apelido do exemplo quando definido"
```

---

### Task 10: Roteiro de teste manual completo (smoke test guiado)

Conforme `CLAUDE.md`, toda mudança visível/clicável precisa de um roteiro de teste manual. Esta task não edita código — é o roteiro final, cobrindo o fluxo ponta a ponta descrito no spec.

**Pré-requisito:** detectar a porta real do frontend rodando (`npm start` a partir de `controle-gastos-frontend/`, tipicamente 3004, mas confirmar no terminal antes de montar as URLs).

- [ ] **Passo 1 — Importar e editar na revisão:**
  1. Acesse `[URL]/transacoes/importacao/nova` (ou o caminho atual do fluxo "Nova Importação").
  2. Suba a fatura CSV de teste (ex: a mesma fornecida na spec, com a linha `Mercadolivre*Ohmybag - Parcela 10/12`).
  3. Na tela de revisão, edite a descrição dessa linha para "Capa de celular" e salve.
  4. **Critério de sucesso:** a célula mostra "Capa de celular"; passar o mouse sobre o texto mostra o texto original em um tooltip.

- [ ] **Passo 2 — Finalizar e conferir na listagem:**
  1. Finalize a importação.
  2. Acesse `[URL]/transacoes` e localize a transação.
  3. **Critério de sucesso:** aparece como "Capa de celular", não o texto original do banco.

- [ ] **Passo 3 — Conferir em relatório e PDF:**
  1. Gere um relatório/exportação em PDF que inclua essa transação.
  2. **Critério de sucesso:** o apelido aparece no relatório e no PDF.

- [ ] **Passo 4 — Confirmar que a deduplicação não quebrou:**
  1. Reimporte a mesma fatura (ou uma fatura simulando o mês seguinte, reaproveitando a mesma descrição original de banco para uma parcela subsequente, ex: "Parcela 11/12").
  2. **Critério de sucesso:** a linha original ("Parcela 10/12") é corretamente identificada como já importada (não duplica); uma nova parcela com número diferente ("Parcela 11/12") é tratada como transação nova, não como duplicata.

- [ ] **Passo 5 — Confirmar que a inferência de pessoa não quebrou:**
  1. Em uma conta com histórico de "provavelmente de X" já funcionando (≥2 transações reais da mesma pessoa com descrição recorrente), importe uma nova ocorrência dessa mesma descrição.
  2. **Critério de sucesso:** o badge "Provavelmente de [pessoa]" continua aparecendo normalmente, mesmo que uma das transações históricas usadas como exemplo tenha um apelido definido.

**Problemas comuns a observar:**
- Se a descrição voltar a mostrar o texto original após reload da página, o `descricaoApelido` provavelmente não foi persistido — checar se o payload do PUT realmente incluiu o campo.
- Se a reimportação da fatura gerar duplicata indevida, algo na Task 2 pode ter afetado sem querer o campo `descricao` usado pelo hash de deduplicação — comparar `deduplicationKey` antes/depois via `mongosh`.
- Se a busca por apelido não encontrar a transação, confirmar que a Task 4 (extensão do `$or` de busca) foi aplicada em todos os três pontos (listagem paginada, listagem não-paginada não tem busca própria, e `filterService.js` de relatório).
