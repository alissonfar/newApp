# Reduzir Tags/Categorias no Lançamento (mostrarNoLancamento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir ocultar tags/categorias especificamente das telas de lançamento de transação (novo/edição, conta fixa, recebimentos), sem afetar sua visibilidade em relatórios/filtros e sem perder nenhum dado — curadoria manual via um novo campo booleano.

**Architecture:** Novo campo `mostrarNoLancamento` (boolean, default `true`) em `Tag` e `Categoria`, persistido pelos controllers já existentes. A filtragem acontece inteiramente no frontend, num utilitário puro reusado nos 3 pontos onde se escolhe tag/categoria para lançar algo novo (`TagSelector.js`, `TabConfiguracao.js`, `ConfiguracaoRecebimentosModal.js`) — sempre preservando qualquer tag/categoria já selecionada, mesmo que oculta. Telas de relatório/filtro e exibição read-only não mudam.

**Tech Stack:** Backend: Express + Mongoose. Frontend: React 19, `react-select`.

## Global Constraints

- Fonte de verdade: `docs/superpowers/specs/2026-08-11-mostrar-no-lancamento-design.md`.
- Sem TDD/testes automatizados novos (regra do projeto — cobertura pequena, não é prioridade padrão). Verificação backend via inspeção de sintaxe + reload do dev server já rodando; frontend via bundle compilando sem erro + roteiro de teste manual para o usuário validar no navegador (não há como logar automaticamente).
- Commits exigem aprovação explícita da mensagem antes de `git commit` — nunca commitar sem essa aprovação, tarefa por tarefa ou em lote, conforme o usuário decidir no checkpoint.
- IDs de tag/categoria trafegam como string do `_id` do Mongo — qualquer comparação usa `String(...)`.
- Nunca rodar `npm install`, `npm run build`, ou migrations sem aprovação explícita — nenhuma tarefa abaixo precisa disso (o campo novo não exige migration, o Mongoose aplica o default na leitura de documentos existentes).

---

### Task D1: Backend — campo `mostrarNoLancamento` em Tag e Categoria

**Files:**
- Modify: `backend/src/models/tag.js`
- Modify: `backend/src/models/categoria.js`
- Modify: `backend/src/controllers/controladorTag.js` (`criarTag`, `atualizarTag`)
- Modify: `backend/src/controllers/controladorCategoria.js` (`criarCategoria`, `atualizarCategoria`)

**Interfaces:**
- Produces: campo `mostrarNoLancamento: boolean` (default `true`) no documento serializado de `Tag` e `Categoria`, aceito no corpo de `POST`/`PUT` das duas entidades — consumido pelo frontend nas Tasks D3-D5.

- [ ] **Step 1: Adicionar o campo em `Tag`**

```js
// backend/src/models/tag.js — dentro de TagSchema, ao lado de `mostrarNoDashboard`
mostrarNoLancamento: { type: Boolean, default: true },
```

- [ ] **Step 2: Adicionar o campo em `Categoria`**

```js
// backend/src/models/categoria.js — dentro de CategoriaSchema, ao lado de `ativo`
mostrarNoLancamento: { type: Boolean, default: true },
```

- [ ] **Step 3: `criarTag`/`atualizarTag` passam a ler/persistir o campo**

```js
// backend/src/controllers/controladorTag.js — exports.criarTag
exports.criarTag = async (req, res) => {
  const { nome, descricao, categoria, cor, icone, mostrarNoDashboard, mostrarNoLancamento } = req.body;
  if (!nome || !categoria) {
    return res.status(400).json({ erro: 'Os campos obrigatórios são: nome e categoria.' });
  }
  try {
    const novaTag = new Tag({
      nome,
      descricao,
      categoria,
      cor,
      icone,
      mostrarNoDashboard: mostrarNoDashboard === true,
      mostrarNoLancamento: mostrarNoLancamento !== false,
      usuario: req.userId
    });
    await novaTag.save();
    res.status(201).json(novaTag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar tag.', detalhe: error.message });
  }
};
```

```js
// backend/src/controllers/controladorTag.js — exports.atualizarTag, dentro do bloco de atualização de campos
if (req.body.mostrarNoDashboard !== undefined) tag.mostrarNoDashboard = req.body.mostrarNoDashboard === true;
if (req.body.mostrarNoLancamento !== undefined) tag.mostrarNoLancamento = req.body.mostrarNoLancamento === true;
```

- [ ] **Step 4: `criarCategoria`/`atualizarCategoria` passam a ler/persistir o campo**

```js
// backend/src/controllers/controladorCategoria.js — exports.criarCategoria
exports.criarCategoria = async (req, res) => {
  const { nome, descricao, cor, icone, mostrarNoLancamento } = req.body;
  if (!nome) {
    return res.status(400).json({ erro: 'O campo nome é obrigatório para categoria.' });
  }
  try {
    const novaCategoria = new Categoria({
      nome,
      descricao,
      cor,
      icone,
      mostrarNoLancamento: mostrarNoLancamento !== false,
      usuario: req.userId
    });
    await novaCategoria.save();
    res.status(201).json(novaCategoria);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar categoria.', detalhe: error.message });
  }
};
```

```js
// backend/src/controllers/controladorCategoria.js — exports.atualizarCategoria, dentro do bloco de atualização de campos
if (req.body.mostrarNoLancamento !== undefined) categoria.mostrarNoLancamento = req.body.mostrarNoLancamento === true;
```

- [ ] **Step 5: Verificar manualmente via HTTP**

Com backend rodando (`npm run dev` em `backend/`) e um token válido:

```bash
curl -X PUT http://localhost:3001/api/tags/<tagId> -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d "{\"mostrarNoLancamento\": false}"
curl http://localhost:3001/api/tags/<tagId> -H "Authorization: Bearer <token>"
```
Confirme que o `PUT` aceita o campo e o `GET` subsequente retorna `mostrarNoLancamento: false`. Repita para categoria via `/api/categorias/<categoriaId>`. Confirme também que uma tag/categoria **existente antes desta mudança** (nunca teve o campo persistido) retorna `mostrarNoLancamento: true` por default ao ser lida — sem precisar de migration.

- [ ] **Step 6: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags,categorias): adiciona campo mostrarNoLancamento para ocultar itens do lancamento sem afetar relatorios`

---

### Task D2: Frontend — utilitário `tagVisibility.js`

**Files:**
- Create: `controle-gastos-frontend/src/utils/tagVisibility.js`

**Interfaces:**
- Produces: `filtrarCategoriasParaLancamento(categorias, categoriasJaSelecionadas?)`, `filtrarTagsParaLancamento(tags, categoriasVisiveis, tagsJaSelecionadas?)` — consumidos pelas Tasks D3 e D4.

- [ ] **Step 1: Implementar as duas funções**

```js
// controle-gastos-frontend/src/utils/tagVisibility.js

/**
 * Filtra categorias para telas de lançamento: mantém as com
 * mostrarNoLancamento !== false, mais qualquer categoria cujo id esteja
 * em `categoriasJaSelecionadas` (edição não perde a categoria já em uso,
 * mesmo que tenha sido ocultada depois).
 */
export function filtrarCategoriasParaLancamento(categorias, categoriasJaSelecionadas = []) {
  const selecionadasSet = new Set(categoriasJaSelecionadas.map(String));
  return (categorias || []).filter(
    cat => cat.mostrarNoLancamento !== false || selecionadasSet.has(String(cat._id))
  );
}

/**
 * Filtra tags para telas de lançamento: mantém as com
 * mostrarNoLancamento !== false E cuja categoria também está visível
 * (via `categoriasVisiveis`, já filtradas), mais qualquer tag cujo id
 * esteja em `tagsJaSelecionadas`.
 */
export function filtrarTagsParaLancamento(tags, categoriasVisiveis, tagsJaSelecionadas = []) {
  const categoriasVisiveisSet = new Set((categoriasVisiveis || []).map(c => String(c._id)));
  const selecionadasSet = new Set(tagsJaSelecionadas.map(String));
  return (tags || []).filter(tag => {
    if (selecionadasSet.has(String(tag._id))) return true;
    if (tag.mostrarNoLancamento === false) return false;
    return categoriasVisiveisSet.has(String(tag.categoria));
  });
}
```

- [ ] **Step 2: Verificar manualmente via console do navegador**

Com o frontend rodando, abrir o console do navegador em qualquer página do app (o módulo não precisa estar importado em lugar nenhum ainda) e colar um teste rápido via `import()` dinâmico não é trivial em CRA — em vez disso, validar a lógica lendo o código com atenção a estes casos, e confirmar visualmente depois nas Tasks D3/D4 quando integrado:
- Categoria com `mostrarNoLancamento: false` e sem estar em `categoriasJaSelecionadas` → excluída.
- Categoria com `mostrarNoLancamento: false` mas presente em `categoriasJaSelecionadas` → mantida.
- Tag com `mostrarNoLancamento: false` mas presente em `tagsJaSelecionadas` → mantida, independente da categoria.
- Tag com `mostrarNoLancamento: true` mas cuja categoria foi filtrada fora (categoria oculta) → excluída, mesmo que a tag em si esteja marcada como visível.

- [ ] **Step 3: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): adiciona utilitario de filtro de visibilidade para telas de lancamento`

---

### Task D3: Frontend — `TagSelector.js` aplica o filtro

**Files:**
- Modify: `controle-gastos-frontend/src/components/Transaction/TagSelector.js`

**Interfaces:**
- Consumes: `filtrarCategoriasParaLancamento`, `filtrarTagsParaLancamento` (Task D2).

- [ ] **Step 1: Derivar já-selecionados a partir de `paymentTags` e filtrar antes de montar as opções**

```js
// controle-gastos-frontend/src/components/Transaction/TagSelector.js
import React, { useMemo } from 'react';
import Select from 'react-select';
import IconRenderer from '../shared/IconRenderer';
import { filtrarCategoriasParaLancamento, filtrarTagsParaLancamento } from '../../utils/tagVisibility';

// ... (selectStyles e formatOptionLabel inalterados)

const TagSelector = React.memo(({ categorias, allTags, paymentTags, onTagsChange, tabIndex = 50 }) => {
  const categoriasVisiveis = useMemo(() => {
    const categoriasJaSelecionadas = Object.keys(paymentTags || {});
    return filtrarCategoriasParaLancamento(categorias, categoriasJaSelecionadas);
  }, [categorias, paymentTags]);

  const tagsVisiveis = useMemo(() => {
    const tagsJaSelecionadas = Object.values(paymentTags || {}).flat();
    return filtrarTagsParaLancamento(allTags, categoriasVisiveis, tagsJaSelecionadas);
  }, [allTags, categoriasVisiveis, paymentTags]);

  const optionsByCategory = useMemo(() => {
    const map = {};
    categoriasVisiveis.forEach(cat => {
      map[cat._id] = tagsVisiveis
        .filter(t => t.categoria === cat._id)
        .map(t => ({ value: t._id, label: t.nome, cor: t.cor, icone: t.icone }));
    });
    return map;
  }, [categoriasVisiveis, tagsVisiveis]);

  return (
    <div className="tags-section">
      <h4>Tags para Pagamento</h4>
      {categoriasVisiveis.map((cat) => {
        const options = optionsByCategory[cat._id] || [];
        const rawValues = (paymentTags && paymentTags[cat._id]) || [];
        const selectedValues = rawValues
          .map(tagId => {
            const tag = allTags.find(t => t._id === tagId);
            return tag ? { value: tag._id, label: tag.nome, cor: tag.cor, icone: tag.icone } : null;
          })
          .filter(Boolean);

        return (
          <div key={cat._id} className="tag-category-group">
            <label>
              <IconRenderer nome={cat.icone || 'folder'} size={20} cor={cat.cor || '#000'} />
              {cat.nome}
            </label>
            <Select
              isMulti
              options={options}
              value={selectedValues}
              onChange={(selected) => {
                const newPaymentTags = { ...paymentTags };
                newPaymentTags[cat._id] = selected ? selected.map(s => s.value) : [];
                onTagsChange(newPaymentTags);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                }
              }}
              tabIndex={tabIndex}
              blurInputOnSelect={false}
              closeMenuOnSelect={false}
              tabSelectsValue={false}
              openMenuOnFocus={false}
              backspaceRemovesValue={true}
              components={{
                DropdownIndicator: null,
                IndicatorSeparator: null
              }}
              styles={selectStyles}
              formatOptionLabel={formatOptionLabel}
              placeholder="Selecione as tags..."
              className="tag-select"
              classNamePrefix="tag-select"
              isClearable={false}
              isSearchable={true}
              menuPlacement="auto"
              noOptionsMessage={() => "Nenhuma tag encontrada"}
              loadingMessage={() => "Carregando..."}
            />
          </div>
        );
      })}
    </div>
  );
});

export default TagSelector;
```

Nota: um pagamento com uma categoria já usada mas **nenhuma tag** selecionada nela ainda (`paymentTags[catId] === []`) conta como "categoria já selecionada" pelo `Object.keys(paymentTags)` — isso é intencional: se o usuário já escolheu essa categoria no pagamento (mesmo sem tag ainda), ela deve continuar visível para ele terminar de escolher a tag.

- [ ] **Step 2: Roteiro de teste manual**

1. Em `/tags`, edite uma tag existente e marque "Mostrar no lançamento" como desmarcado (checkbox ainda não existe até a Task D5 — pule este passo por ora e volte a testar D3 depois de D5 estar pronta, ou teste via `curl`/mongosh direto no campo `mostrarNoLancamento` da tag para validar D3 isoladamente).
2. Abra o formulário de nova transação, vá na aba Pagamentos.
3. Critério de sucesso: a tag marcada como oculta não aparece nas opções do seletor da categoria dela.
4. Edite uma transação existente que já usa essa tag oculta — critério de sucesso: a tag continua aparecendo, pré-selecionada, mas não é possível adicionar OUTRA tag oculta da mesma categoria (só a que já estava lá).

- [ ] **Step 3: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): TagSelector oculta tags/categorias marcadas como nao-visiveis no lancamento, preservando as ja selecionadas`

---

### Task D4: Frontend — Recebimentos (`TabConfiguracao.js`, `ConfiguracaoRecebimentosModal.js`)

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Recebimentos/components/TabConfiguracao.js`
- Modify: `controle-gastos-frontend/src/components/Recebimentos/ConfiguracaoRecebimentosModal.js`

**Interfaces:**
- Consumes: `filtrarTagsParaLancamento` (Task D2). Categoria não entra aqui — essas telas só escolhem tag diretamente, sem agrupar por categoria.

- [ ] **Step 1: `TabConfiguracao.js` filtra as opções dos dois seletores (tag a aplicar, tag a remover)**

```js
// controle-gastos-frontend/src/pages/Recebimentos/components/TabConfiguracao.js
import { filtrarTagsParaLancamento } from '../../../utils/tagVisibility';

// dentro do componente, logo após `const { tags } = useData();`
const tagsParaAplicarOptions = filtrarTagsParaLancamento(tags, tags, tagSelecionada ? [tagSelecionada] : []);
const tagsParaRemoverOptions = filtrarTagsParaLancamento(tags, tags, removeTagSelecionada ? [removeTagSelecionada] : []);
```

Nota: aqui `categoriasVisiveis` é passado como o próprio `tags` sem sentido de categoria — como `filtrarTagsParaLancamento` só usa esse segundo argumento para checar `categoriasVisiveisSet.has(tag.categoria)`, e essas telas não agrupam por categoria, o filtro correto é: reimplementar sem a checagem de categoria. Ajustar a chamada para não depender de categoria:

```js
// Alternativa correta (sem depender de categoria, que não existe nesse contexto):
const tagsParaAplicarOptions = tags.filter(t =>
  t.mostrarNoLancamento !== false || String(t._id) === String(tagSelecionada)
);
const tagsParaRemoverOptions = tags.filter(t =>
  t.mostrarNoLancamento !== false || String(t._id) === String(removeTagSelecionada)
);
```

Usar essa segunda forma (filtro direto, sem passar por `filtrarTagsParaLancamento`, já que a função de D2 foi desenhada para o caso com categoria — aqui não há esse conceito). Trocar as duas ocorrências de `options={(tags || []).map(...)}` (linhas ~170 e ~241 do arquivo original) para usar `tagsParaAplicarOptions`/`tagsParaRemoverOptions` no lugar de `tags`.

- [ ] **Step 2: `ConfiguracaoRecebimentosModal.js` filtra `opcoesTags`**

```js
// controle-gastos-frontend/src/components/Recebimentos/ConfiguracaoRecebimentosModal.js
// trocar a definição de opcoesTags por:
const tagsVisiveis = (tags || []).filter(t =>
  t.mostrarNoLancamento !== false ||
  String(t._id) === String(tagReceberId) ||
  String(t._id) === String(tagRemoverId)
);
const opcoesTags = tagsVisiveis.map(t => ({
  value: t._id,
  label: t.nome,
  cor: t.cor,
  icone: t.icone
}));
```

- [ ] **Step 3: Roteiro de teste manual**

1. Com uma tag marcada como oculta do lançamento (via `mongosh`/`curl` se a Task D5 ainda não estiver pronta), acesse a tela de Recebimentos → Configuração.
2. Critério de sucesso: a tag oculta não aparece nos seletores "Tag para receber"/"Tag para remover", a menos que já esteja configurada como padrão atual (nesse caso continua aparecendo).
3. Repita em Configurações → Configuração de Recebimentos (o modal `ConfiguracaoRecebimentosModal.js`, geralmente acessível a partir do menu do usuário ou da própria tela de Recebimentos).

- [ ] **Step 4: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(recebimentos): seletores de tag respeitam mostrarNoLancamento, preservando a tag ja configurada`

---

### Task D5: Frontend — checkbox "Mostrar no lançamento" em `TagManagement.js`

**Files:**
- Modify: `controle-gastos-frontend/src/components/Tag/TagManagement.js`

**Interfaces:**
- Consumes: `criarTag`, `atualizarTag`, `criarCategoria`, `atualizarCategoria` (já existentes em `api.js`, aceitam o campo novo no payload sem mudança de assinatura).

- [ ] **Step 1: Novos estados para tag (novo e edição)**

```js
// controle-gastos-frontend/src/components/Tag/TagManagement.js — ao lado dos estados de tag existentes
const [novoTagMostrarNoLancamento, setNovoTagMostrarNoLancamento] = useState(true);
// ...
const [editTagMostrarNoLancamento, setEditTagMostrarNoLancamento] = useState(true);
```

- [ ] **Step 2: Novos estados para categoria (novo e edição)**

```js
const [novoCatMostrarNoLancamento, setNovoCatMostrarNoLancamento] = useState(true);
// ...
const [editCatMostrarNoLancamento, setEditCatMostrarNoLancamento] = useState(true);
```

- [ ] **Step 3: Incluir o campo nos payloads de criar/atualizar tag**

```js
// handleAdicionarTag — dentro do criarTag({...})
mostrarNoLancamento: novoTagMostrarNoLancamento

// após sucesso, resetar junto com os outros campos:
setNovoTagMostrarNoLancamento(true);
```

```js
// handleEditarTag
setEditTagMostrarNoLancamento(tag.mostrarNoLancamento ?? true);
```

```js
// handleSalvarEdicaoTag — dentro do atualizarTag(editTagCodigo, {...})
mostrarNoLancamento: editTagMostrarNoLancamento

// após sucesso, resetar:
setEditTagMostrarNoLancamento(true);
```

```js
// botão "Cancelar" da edição de tag — resetar também:
onClick={() => { setEditTagCodigo(null); setEditTagMostrarNoDashboard(false); setEditTagMostrarNoLancamento(true); }}
```

- [ ] **Step 4: Incluir o campo nos payloads de criar/atualizar categoria**

```js
// handleAdicionarCategoria — dentro do criarCategoria({...})
mostrarNoLancamento: novoCatMostrarNoLancamento

// após sucesso, resetar:
setNovoCatMostrarNoLancamento(true);
```

```js
// handleEditarCategoria
setEditCatMostrarNoLancamento(categoria.mostrarNoLancamento ?? true);
```

```js
// handleSalvarEdicaoCategoria — dentro do atualizarCategoria(editCatCodigo, {...})
mostrarNoLancamento: editCatMostrarNoLancamento

// após sucesso, resetar:
setEditCatMostrarNoLancamento(true);
```

```js
// botão "Cancelar" da edição de categoria — resetar também:
onClick={() => { setEditCatCodigo(null); setEditCatMostrarNoLancamento(true); }}
```

- [ ] **Step 5: Checkbox no formulário de tag (novo e edição)**

```jsx
// Adicionar Nova Tag — logo após o checkbox "Mostrar no Dashboard"
<div className="form-row">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={novoTagMostrarNoLancamento}
      onChange={(e) => setNovoTagMostrarNoLancamento(e.target.checked)}
    />
    Mostrar no lançamento de transações
  </label>
</div>
```

```jsx
// Editar Tag — logo após o checkbox "Mostrar no Dashboard" equivalente
<div className="form-row">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={editTagMostrarNoLancamento}
      onChange={(e) => setEditTagMostrarNoLancamento(e.target.checked)}
    />
    Mostrar no lançamento de transações
  </label>
</div>
```

- [ ] **Step 6: Checkbox no formulário de categoria (novo e edição)**

```jsx
// Adicionar Nova Categoria — logo antes do botão "Adicionar"
<div className="form-row">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={novoCatMostrarNoLancamento}
      onChange={(e) => setNovoCatMostrarNoLancamento(e.target.checked)}
    />
    Mostrar no lançamento de transações
  </label>
</div>
```

```jsx
// Editar Categoria — logo antes do bloco form-actions (botões Salvar/Cancelar)
<div className="form-row">
  <label className="checkbox-label">
    <input
      type="checkbox"
      checked={editCatMostrarNoLancamento}
      onChange={(e) => setEditCatMostrarNoLancamento(e.target.checked)}
    />
    Mostrar no lançamento de transações
  </label>
</div>
```

- [ ] **Step 7: Roteiro de teste manual completo (fecha o ciclo com D3/D4)**

1. Acesse `/tags`, edite uma categoria e desmarque "Mostrar no lançamento de transações". Salve.
2. Abra o formulário de nova transação → aba Pagamentos → Tags para Pagamento.
3. Critério de sucesso: o grupo inteiro daquela categoria (nome + tags dela) não aparece mais no seletor.
4. Volte em `/tags`, reative "Mostrar no lançamento" na mesma categoria — critério de sucesso: volta a aparecer no seletor.
5. Repita o teste só numa tag específica (sem mexer na categoria) — critério de sucesso: só aquela tag some do grupo da categoria, as outras tags da mesma categoria continuam aparecendo.
6. Confirme que `RelatorioFiltersPanel.js` (tela de Relatórios) continua mostrando a tag/categoria oculta normalmente nos filtros — nada muda lá.
7. Problemas comuns a observar: checkbox não reflete o estado real ao abrir "Editar" (conferir `?? true` no `handleEditarTag`/`handleEditarCategoria`), campo não persiste após salvar (conferir se o payload realmente inclui `mostrarNoLancamento`).

- [ ] **Step 8: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): checkbox 'Mostrar no lancamento' na gestao de tags e categorias`

---

## Self-review (cobertura da spec)

- Campo `mostrarNoLancamento` em Tag e Categoria, sem migration → Task D1. ✅
- Regra de visibilidade combinada (ativo + mostrarNoLancamento) → aplicada no filtro do frontend, Task D2/D3/D4 (backend não filtra listagem, conforme spec). ✅
- Categoria oculta esconde o grupo inteiro no lançamento → Task D3 (`filtrarCategoriasParaLancamento` aplicado antes de montar `optionsByCategory`). ✅
- Edição preserva tags/categorias já selecionadas mesmo ocultas, sem permitir adicionar novas ocultas → Task D3 (derivação de `categoriasJaSelecionadas`/`tagsJaSelecionadas` a partir de `paymentTags`). ✅
- Recebimentos respeita a ocultação → Task D4. ✅
- Relatório/filtro e exibição read-only não mudam → nenhuma task toca nesses arquivos (confirmado fora de escopo). ✅
- UI de curadoria manual (checkbox) em Tag e Categoria → Task D5. ✅
