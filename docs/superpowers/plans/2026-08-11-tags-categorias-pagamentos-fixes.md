# Correções: Tags/Categorias Inativas, Divisão de Pagamentos e Bug de Ocorrências — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Fase A usa superpowers:subagent-driven-development (Tier 3). Fases B e C usam superpowers:executing-plans na mesma sessão (Tier 2/1). Steps usam checkbox (`- [ ]`) syntax para tracking.

**Goal:** (A) Dar a Tags o mesmo ciclo de vida ativo/inativo que Categoria já tem, com hard delete condicional (só quando não há vínculo) e uma tela dedicada para reativar itens inativados. (B) Corrigir "Rateio igual" para replicar (de forma aditiva, sem sobrescrever) as tags do primeiro pagamento para os demais. (C) Corrigir o alerta de "possível duplicidade" que hoje ignora os filtros de busca/data e conta todas as transações do usuário.

**Architecture:** (A) Backend ganha um service de checagem de vínculo via aggregation do MongoDB (`pagamentos.tags` é um objeto livre, não referência direta), reusado pelos dois controllers (Tag, Categoria) na exclusão; Tag ganha os endpoints de ativar/inativar que faltavam, espelhando Categoria; frontend ganha paridade visual + uma tela nova de itens inativos. (B) `usePagamentos.js` (`splitEqually`) passa a fazer merge aditivo de tags do pagamento índice 0 nos demais, reaproveitando a mesma lógica de "não duplicar, não sobrescrever" que já existe no backend (`mergeTagsPadrao`). (C) `useDuplicateCheck.js` troca de endpoint (`obterTransacoes` → `obterTransacoesPaginadas`) para não cair no branch do backend que ignora os filtros.

**Tech Stack:** Backend: Express + Mongoose (aggregation pipeline). Frontend: React 19, hooks customizados, `react-toastify`, SweetAlert2 (`Swal`), `react-icons/fa`.

## Global Constraints

- **Commits exigem aprovação explícita da mensagem antes de rodar `git commit`** — isso sobrescreve o passo padrão de "commit automático" do template de plano. Cada tarefa abaixo termina em "apresentar diff + mensagem sugerida, aguardar aprovação", não em `git commit` direto.
- **Sem TDD por padrão** — cobertura automatizada do projeto é pequena (só `ledgerService`/`netWorthService`) e não é prioridade padrão (regra do projeto). Nenhuma tarefa abaixo escreve teste Jest novo; a verificação de cada tarefa backend é manual (via `mongosh`/chamada HTTP direta) e cada tarefa frontend termina em roteiro de teste manual no navegador.
- **Todos os IDs de tag/categoria trafegam como string do `_id` do Mongo** — `Tag.categoria` é `String` (não `ObjectId` ref), `pagamentos[].tags` é `{ [categoriaId: string]: [tagId: string, ...] }`. Qualquer comparação deve usar `String(...)`.
- **Nunca rodar `npm install`, `npm run build`, ou migrations sem aprovação** — nenhuma tarefa abaixo precisa de pacote novo ou migration; se durante a execução isso mudar, pare e pergunte.

---

## Fase A — Tags e Categorias Inativas (Tier 3 — subagent-driven-development)

Fonte de verdade: [docs/superpowers/specs/2026-08-11-tags-categorias-inativas-design.md](../specs/2026-08-11-tags-categorias-inativas-design.md).

### Task A1: Service de checagem de vínculo (backend)

**Files:**
- Create: `backend/src/services/vinculoTagCategoriaService.js`

**Interfaces:**
- Produces: `tagEstaVinculada(tagId: string, usuarioId: string|ObjectId): Promise<boolean>`, `categoriaEstaVinculada(categoriaId: string, usuarioId: string|ObjectId): Promise<boolean>` — usados pelas Tasks A2 e A3.

- [ ] **Step 1: Implementar o service**

```js
// backend/src/services/vinculoTagCategoriaService.js
const mongoose = require('mongoose');
const Transacao = require('../models/transacao');
const Tag = require('../models/tag');

/**
 * pagamentos[].tags é um objeto livre { [categoriaId]: [tagId, ...] } —
 * não dá para indexar direto, então convertemos para array de {k,v} via
 * $objectToArray para poder checar se um id aparece em alguma chave/valor.
 */
async function algumPagamentoTemTagOuCategoria(usuarioId, match) {
  const resultado = await Transacao.aggregate([
    { $match: { usuario: new mongoose.Types.ObjectId(usuarioId), status: 'ativo' } },
    { $unwind: '$pagamentos' },
    { $project: { tagsArr: { $objectToArray: { $ifNull: ['$pagamentos.tags', {}] } } } },
    { $unwind: '$tagsArr' },
    { $match: match },
    { $limit: 1 }
  ]);
  return resultado.length > 0;
}

/** Vinculada se algum pagamento tem esse tagId no array de valores de alguma categoria. */
async function tagEstaVinculada(tagId, usuarioId) {
  return algumPagamentoTemTagOuCategoria(usuarioId, { 'tagsArr.v': String(tagId) });
}

/**
 * Vinculada se: (a) existe alguma Tag cadastrada nessa categoria (ainda que
 * não usada em nenhuma transação — excluir a categoria quebraria essas tags),
 * OU (b) algum pagamento tem tags registradas sob essa categoria.
 */
async function categoriaEstaVinculada(categoriaId, usuarioId) {
  const temTag = await Tag.exists({ categoria: String(categoriaId), usuario: usuarioId });
  if (temTag) return true;
  return algumPagamentoTemTagOuCategoria(usuarioId, { 'tagsArr.k': String(categoriaId) });
}

module.exports = { tagEstaVinculada, categoriaEstaVinculada };
```

- [ ] **Step 2: Verificar manualmente via mongosh**

Com o backend parado (não precisa rodar), abra `mongosh` no banco local e confirme que existe pelo menos uma tag/categoria em uso, para depois testar os dois casos (com e sem vínculo) na Task A2/A3:

```powershell
docker-compose up -d
mongosh "mongodb://localhost:27017/controle-gastos?replicaSet=rs0"
```

```js
// dentro do mongosh, substitua <usuarioId> pelo seu próprio _id de usuário
db.transacoes.aggregate([
  { $match: { usuario: ObjectId("<usuarioId>"), status: "ativo" } },
  { $unwind: "$pagamentos" },
  { $project: { tagsArr: { $objectToArray: { $ifNull: ["$pagamentos.tags", {}] } } } },
  { $unwind: "$tagsArr" },
  { $limit: 3 }
])
```
Confirme que o resultado mostra objetos com `tagsArr.k` (id de categoria) e `tagsArr.v` (array de ids de tag) — se a estrutura bater com o esperado, a aggregation da Task A1 está correta.

- [ ] **Step 3: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): adiciona service de checagem de vínculo para tags e categorias`

---

### Task A2: Hard delete condicional em Tag e Categoria

**Files:**
- Modify: `backend/src/controllers/controladorTag.js:97-117` (`excluirTag`)
- Modify: `backend/src/controllers/controladorCategoria.js:97-118` (`excluirCategoria`)

**Interfaces:**
- Consumes: `vinculoTagCategoriaService.tagEstaVinculada`, `vinculoTagCategoriaService.categoriaEstaVinculada` (Task A1).

- [ ] **Step 1: Atualizar `excluirTag`**

```js
// backend/src/controllers/controladorTag.js
const Tag = require('../models/tag');
const { tagEstaVinculada } = require('../services/vinculoTagCategoriaService');

// ... (demais exports mantidos)

exports.excluirTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });

    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });

    const vinculada = await tagEstaVinculada(tag._id, req.userId);

    if (vinculada) {
      tag.ativo = false;
      await tag.save();
      return res.json({ mensagem: 'Tag possui transações vinculadas — foi inativada em vez de excluída.', inativada: true });
    }

    await Tag.deleteOne({ _id: tag._id });
    res.json({ mensagem: 'Tag excluída com sucesso.', inativada: false });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir tag.', detalhe: error.message });
  }
};
```

- [ ] **Step 2: Atualizar `excluirCategoria`**

```js
// backend/src/controllers/controladorCategoria.js
const Categoria = require('../models/categoria');
const { categoriaEstaVinculada } = require('../services/vinculoTagCategoriaService');

// ... (demais exports mantidos)

exports.excluirCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findOne({
      $or: [
        { _id: req.params.id },
        { codigo: req.params.id }
      ],
      usuario: req.userId,
      ativo: true
    });

    if (!categoria) return res.status(404).json({ erro: 'Categoria não encontrada.' });

    const vinculada = await categoriaEstaVinculada(categoria._id, req.userId);

    if (vinculada) {
      categoria.ativo = false;
      await categoria.save();
      return res.json({ mensagem: 'Categoria possui tags ou transações vinculadas — foi inativada em vez de excluída.', inativada: true });
    }

    await Categoria.deleteOne({ _id: categoria._id });
    res.json({ mensagem: 'Categoria excluída com sucesso.', inativada: false });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir categoria.', detalhe: error.message });
  }
};
```

- [ ] **Step 3: Verificar manualmente via HTTP**

Com backend (`npm run dev` em `backend/`) e frontend rodando, logado no app:

1. Crie uma categoria nova sem nenhuma tag/transação e tente excluí-la pela UI atual (ainda sem os botões novos — pode usar o botão "Excluir" que já existe). Confirme no `mongosh` (`db.categorias.find({nome: "..."})`) que o documento sumiu de vez (hard delete).
2. Tente excluir uma categoria que você sabe que tem tags cadastradas — confirme que a resposta JSON tem `inativada: true` e que o documento continua no banco com `ativo: false`.
3. Repita os dois casos para uma tag (crie uma tag nova sem uso, exclua — some do banco; exclua uma tag usada em alguma transação — vira `ativo:false`).

- [ ] **Step 4: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `fix(tags,categorias): exclusao vira hard delete quando nao ha vinculo, senao inativa`

---

### Task A3: Endpoints de ativar/inativar Tag + listagem com inativas

**Files:**
- Modify: `backend/src/controllers/controladorTag.js` (adicionar `ativarTag`, `inativarTag`; ajustar `obterTodasTags`, `obterTagPorId`, `atualizarTag`)
- Modify: `backend/src/routes/rotasTag.js` (novas rotas)

**Interfaces:**
- Produces: `PUT /api/tags/:id/ativar`, `PUT /api/tags/:id/inativar`, `GET /api/tags?incluirInativas=true` — consumidos pela Task A4 (frontend).

- [ ] **Step 1: `obterTodasTags` aceita `incluirInativas`**

```js
// backend/src/controllers/controladorTag.js
exports.obterTodasTags = async (req, res) => {
  try {
    const options = {
      page: 1,
      limit: 10000,
      sort: { nome: 1 }
    };

    // Inclui inativas apenas quando incluirInativas=true (mesmo padrão de Categoria)
    const incluirInativas = req.query.incluirInativas === 'true';
    const query = {
      usuario: req.userId,
      ...(incluirInativas ? {} : { ativo: true })
    };

    const resultadoPaginado = await Tag.paginate(query, options);
    res.json(resultadoPaginado.docs);
  } catch (error) {
    console.error("Erro ao obter tags com paginação:", error);
    res.status(500).json({ erro: 'Erro ao obter tags.', detalhe: error.message });
  }
};
```

- [ ] **Step 2: `obterTagPorId` e `atualizarTag` deixam de exigir `ativo:true`**

Remover `ativo: true` do filtro em ambas (mesmo padrão que `atualizarCategoria` já usa — busca "ativa ou inativa"):

```js
// obterTagPorId — trocar o findOne por:
const tag = await Tag.findOne({
  $or: [{ _id: req.params.id }, { codigo: req.params.id }],
  usuario: req.userId
});
```

```js
// atualizarTag — trocar o findOne por:
const tag = await Tag.findOne({
  $or: [{ _id: req.params.id }, { codigo: req.params.id }],
  usuario: req.userId
});
```

- [ ] **Step 3: Adicionar `ativarTag`/`inativarTag`**

```js
// backend/src/controllers/controladorTag.js
exports.ativarTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({
      $or: [{ _id: req.params.id }, { codigo: req.params.id }],
      usuario: req.userId
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });

    tag.ativo = true;
    await tag.save();

    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao ativar tag.', detalhe: error.message });
  }
};

exports.inativarTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({
      $or: [{ _id: req.params.id }, { codigo: req.params.id }],
      usuario: req.userId,
      ativo: true
    });
    if (!tag) return res.status(404).json({ erro: 'Tag não encontrada.' });

    tag.ativo = false;
    await tag.save();

    res.json(tag);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao inativar tag.', detalhe: error.message });
  }
};
```

- [ ] **Step 4: Registrar as rotas**

```js
// backend/src/routes/rotasTag.js
router.get('/', controladorTag.obterTodasTags);
router.get('/:id', controladorTag.obterTagPorId);
router.post('/', controladorTag.criarTag);

// Ativar/Inativar (rotas específicas antes do PUT genérico — mesma ordem de rotasCategoria.js)
router.put('/:id/ativar', controladorTag.ativarTag);
router.put('/:id/inativar', controladorTag.inativarTag);

router.put('/:id', controladorTag.atualizarTag);
router.delete('/:id', controladorTag.excluirTag);
```

- [ ] **Step 5: Verificar manualmente via HTTP**

Com backend rodando e um token válido (pegue do `localStorage` do navegador logado):

```bash
curl -X PUT http://localhost:3001/api/tags/<tagId>/inativar -H "Authorization: Bearer <token>"
curl "http://localhost:3001/api/tags?incluirInativas=true" -H "Authorization: Bearer <token>"
curl -X PUT http://localhost:3001/api/tags/<tagId>/ativar -H "Authorization: Bearer <token>"
```
Confirme: inativar retorna a tag com `ativo:false`; a listagem com `incluirInativas=true` inclui essa tag; ativar volta `ativo:true`; a listagem sem o parâmetro não traz mais essa tag.

- [ ] **Step 6: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): adiciona endpoints de ativar/inativar e suporte a incluirInativas na listagem`

---

### Task A4: Frontend — api.js (novos métodos)

**Files:**
- Modify: `controle-gastos-frontend/src/api.js:118-139` (`obterTags`), `:141-153`, `:177-188`

**Interfaces:**
- Consumes: endpoints da Task A3.
- Produces: `obterTags(incluirInativas?: boolean)`, `ativarTag(codigo)`, `inativarTag(codigo)` — consumidos pelas Tasks A5 e A6.

- [ ] **Step 1: `obterTags` aceita parâmetro opcional (retrocompatível)**

```js
// controle-gastos-frontend/src/api.js
export async function obterTags(incluirInativas = false) {
  if (!getToken()) return [];
  const query = incluirInativas ? '?incluirInativas=true' : '';
  const resposta = await fetch(`${API_BASE}/tags${query}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  if (!resposta.ok) {
    console.error("Resposta inválida em obterTags:", resposta.status, dados);
    throw new Error(dados?.erro || `Erro ${resposta.status} ao obter tags.`);
  }

  if (!Array.isArray(dados)) {
    console.error("Formato inesperado em obterTags:", typeof dados, dados);
    return [];
  }

  return dados.map(tag => ({
    ...tag,
    codigo: tag._id
  }));
}
```

- [ ] **Step 2: Adicionar `ativarTag`/`inativarTag`**

```js
// controle-gastos-frontend/src/api.js — logo após excluirTag
export async function ativarTag(codigo) {
  const resposta = await fetch(`${API_BASE}/tags/${codigo}/ativar`, {
    method: 'PUT',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro ao ativar tag.');
  }
  return { ...dados, codigo: dados._id };
}

export async function inativarTag(codigo) {
  const resposta = await fetch(`${API_BASE}/tags/${codigo}/inativar`, {
    method: 'PUT',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro ao inativar tag.');
  }
  return { ...dados, codigo: dados._id };
}
```

- [ ] **Step 3: Verificar que `DataContext.js` continua chamando `obterTags()` sem argumento**

Abra `controle-gastos-frontend/src/context/DataContext.js` e confirme que as duas chamadas a `obterTags()` (linhas ~33 e ~55) continuam sem parâmetro — isso é intencional, o contexto global do app deve continuar trazendo só tags ativas. Não precisa editar esse arquivo nesta task.

- [ ] **Step 4: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): adiciona metodos de api para ativar/inativar tag e listar inativas`

---

### Task A5: Frontend — paridade visual de Tag em TagManagement.js

**Files:**
- Modify: `controle-gastos-frontend/src/components/Tag/TagManagement.js` (imports, handlers, JSX da listagem de tags)
- Modify: `controle-gastos-frontend/src/components/Tag/TagManagement.css` (se precisar de classe nova — reaproveitar `badge-ativa`/`badge-inativa` já existentes)

**Interfaces:**
- Consumes: `ativarTag`, `inativarTag` (Task A4), `tags` de `useData()` (via `DataContext`, já carrega todas as ativas — precisa também trazer inativas para exibir o badge/toggle na tela principal).

- [ ] **Step 1: Trazer tags inativas para a tela principal também**

A listagem principal de `TagManagement.js` hoje usa `tags` do `DataContext` (só ativas). Para mostrar o badge/toggle igual Categoria, ela precisa também das inativas nesta tela específica — siga o mesmo padrão que `fetchCategorias` já usa (busca local própria da tela, sem mudar o contrato do `DataContext`):

```js
// controle-gastos-frontend/src/components/Tag/TagManagement.js
import { obterCategorias, obterTags, criarTag, atualizarTag, excluirTag, ativarTag, inativarTag, criarCategoria, atualizarCategoria, excluirCategoria, ativarCategoria, inativarCategoria } from '../../api.js';

// ... dentro do componente, ao lado de `fetchCategorias`:
const [tagsComInativas, setTagsComInativas] = useState([]);
const [loadingTags, setLoadingTags] = useState(true);
const [errorTags, setErrorTags] = useState(null);

const fetchTags = useCallback(async () => {
  setLoadingTags(true);
  setErrorTags(null);
  try {
    const t = await obterTags(true);
    setTagsComInativas(t);
  } catch (error) {
    setErrorTags(error);
    toast.error('Falha ao carregar tags.');
  } finally {
    setLoadingTags(false);
  }
}, []);

useEffect(() => {
  fetchTags();
}, [fetchTags]);
```

- [ ] **Step 2: Trocar `filteredTags` para usar `tagsComInativas` em vez de `tags` do contexto**

```js
// controle-gastos-frontend/src/components/Tag/TagManagement.js
const filteredTags = useMemo(() => {
  if (!selectedCategory) return [];
  return tagsComInativas.filter(tag => {
    if (typeof tag.categoria === 'string') {
      return tag.categoria === selectedCategory._id || tag.categoria === selectedCategory.nome;
    }
    return tag.categoria._id === selectedCategory._id;
  });
}, [selectedCategory, tagsComInativas]);
```

Nota: `nomeTagDuplicado` continua usando `tags` do `DataContext` (só ativas) — isso é correto, não precisa mudar: não faz sentido bloquear criação de uma tag com o mesmo nome de uma tag já inativada.

- [ ] **Step 3: Handlers de ativar/inativar tag (espelhando os de categoria)**

```js
// controle-gastos-frontend/src/components/Tag/TagManagement.js
const handleAtivarTag = async (codigo, e) => {
  e?.stopPropagation();
  try {
    await ativarTag(codigo);
    await fetchTags();
    await refreshData();
    toast.success('Tag ativada com sucesso!');
  } catch (error) {
    console.error('Erro ao ativar tag:', error);
    toast.error('Erro ao ativar tag.');
  }
};

const handleInativarTag = async (codigo, e) => {
  e?.stopPropagation();
  Swal.fire({
    title: 'Inativar tag?',
    text: 'A tag não aparecerá nos modais de transação, mas o histórico será preservado.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, inativar',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await inativarTag(codigo);
        await fetchTags();
        await refreshData();
        toast.success('Tag inativada com sucesso!');
      } catch (error) {
        console.error('Erro ao inativar tag:', error);
        toast.error('Erro ao inativar tag.');
      }
    }
  });
};
```

- [ ] **Step 4: Ajustar `handleExcluirTag` para refletir o retorno `inativada`/hard-delete do backend**

```js
// controle-gastos-frontend/src/components/Tag/TagManagement.js
const handleExcluirTag = async (codigo) => {
  Swal.fire({
    title: 'Tem certeza que deseja excluir esta tag?',
    text: 'Se a tag não tiver nenhuma transação vinculada, ela será excluída definitivamente. Caso contrário, será apenas inativada.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const resultado = await excluirTag(codigo);
        await fetchTags();
        await refreshData();
        if (resultado?.inativada) {
          toast.info('Tag possui transações vinculadas — foi inativada em vez de excluída.');
        } else {
          toast.success('Tag excluída com sucesso!');
        }
      } catch (error) {
        console.error('Erro ao excluir tag:', error);
        toast.error('Erro ao excluir tag.');
      }
    }
  });
};
```

Aplicar o mesmo ajuste em `handleExcluirCategoria` (Task A2 já fez o backend retornar `inativada`):

```js
// controle-gastos-frontend/src/components/Tag/TagManagement.js — dentro de handleExcluirCategoria,
// trocar o toast.success fixo por:
const resultado = await excluirCategoria(codigo);
if (selectedCategory && selectedCategory.codigo === codigo) {
  setSelectedCategory(null);
}
await fetchCategorias();
await refreshData();
if (resultado?.inativada) {
  toast.info('Categoria possui tags ou transações vinculadas — foi inativada em vez de excluída.');
} else {
  toast.success('Categoria excluída com sucesso!');
}
```

- [ ] **Step 5: JSX — badge e botão de toggle na listagem de tags**

Trocar o bloco `view-tag` (arquivo original em `TagManagement.js:562-582`) para incluir badge e toggle, no mesmo padrão de `categoria-item-header`/`acoes-categoria`:

```jsx
// controle-gastos-frontend/src/components/Tag/TagManagement.js
<div className="view-tag">
  <div className="tag-item">
    <div className="icone-preview" style={{ color: tag.cor }}>
      <IconRenderer nome={tag.icone} size={28} cor={tag.cor} />
    </div>
    <div className="tag-item-content">
      <div className="tag-item-header">
        <span className="tag-nome">{tag.nome}</span>
        <span className={tag.ativo === false ? 'badge-inativa' : 'badge-ativa'}>
          {tag.ativo === false ? 'Inativa' : 'Ativa'}
        </span>
      </div>
      {tag.descricao && (
        <span className="tag-descricao">{tag.descricao}</span>
      )}
    </div>
  </div>
  <div className="acoes-tag">
    {tag.ativo !== false ? (
      <button className="btn-warning" title="Inativar" onClick={(e) => handleInativarTag(tag.codigo, e)}>
        <FaBan size={14} /> Inativar
      </button>
    ) : (
      <button className="btn-success" title="Ativar" onClick={(e) => handleAtivarTag(tag.codigo, e)}>
        <FaCheckCircle size={14} /> Ativar
      </button>
    )}
    <button className="btn-editar" title="Editar" onClick={() => handleEditarTag(tag)}>
      <FaEdit size={14} /> Editar
    </button>
    <button className="btn-danger" title="Excluir" onClick={() => handleExcluirTag(tag.codigo)}>
      <FaTrash size={14} /> Excluir
    </button>
  </div>
</div>
```

- [ ] **Step 6: Checar CSS — `tag-item-header` provavelmente não existe ainda**

Abra `TagManagement.css` e procure por `.categoria-item-header`. Se ela usa `display:flex; justify-content:space-between; align-items:center` (padrão esperado para acomodar nome + badge lado a lado), adicione a regra equivalente `.tag-item-header` com as mesmas propriedades (reaproveitando `badge-ativa`/`badge-inativa`, que já são genéricas e não precisam de nova classe).

- [ ] **Step 7: Roteiro de teste manual**

1. Rode `npm start` em `controle-gastos-frontend/` (detecte a porta real no terminal, normalmente 3004) e `npm run dev` em `backend/`.
2. Acesse `/tags`, selecione uma categoria com pelo menos uma tag.
3. Critério de sucesso: cada tag na lista mostra badge "Ativa" e botão "Inativar" (ícone de proibido).
4. Clique em "Inativar" em uma tag sem uso em nenhuma transação → confirme no modal → a tag deve continuar na lista (não sumir), agora com badge "Inativa" e botão "Ativar".
5. Clique em "Ativar" → volta para "Ativa".
6. Problemas comuns a observar: badge não aparece (CSS não copiado corretamente), lista pisca/duplica ao trocar de categoria (checar se `fetchTags` está sendo chamado em loop), toast de erro genérico (verificar console do navegador para o erro real da API).

- [ ] **Step 8: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): adiciona badge e toggle ativo/inativo na listagem de tags, paridade com categoria`

---

### Task A6: Nova tela `/tags/inativos`

**Files:**
- Create: `controle-gastos-frontend/src/pages/TagsInativos/TagsInativos.js`
- Create: `controle-gastos-frontend/src/pages/TagsInativos/TagsInativos.css`
- Modify: `controle-gastos-frontend/src/App.js` (nova rota)
- Modify: `controle-gastos-frontend/src/components/Tag/TagManagement.js` (botão "Ver inativos")

**Interfaces:**
- Consumes: `obterTags(true)`, `obterCategorias(true)`, `ativarTag`, `ativarCategoria` (já existentes).

- [ ] **Step 1: Criar a página com abas**

```jsx
// controle-gastos-frontend/src/pages/TagsInativos/TagsInativos.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { obterTags, obterCategorias, ativarTag, ativarCategoria } from '../../api.js';
import IconRenderer from '../../components/shared/IconRenderer';
import './TagsInativos.css';

const TagsInativos = () => {
  const navigate = useNavigate();
  const [aba, setAba] = useState('tags');
  const [tagsInativas, setTagsInativas] = useState([]);
  const [categoriasInativas, setCategoriasInativas] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [tags, categorias] = await Promise.all([
        obterTags(true),
        obterCategorias(true)
      ]);
      setTagsInativas(tags.filter(t => t.ativo === false));
      setCategoriasInativas(categorias.filter(c => c.ativo === false));
    } catch (error) {
      toast.error('Falha ao carregar itens inativos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleAtivarTag = async (codigo) => {
    try {
      await ativarTag(codigo);
      await carregar();
      toast.success('Tag ativada com sucesso!');
    } catch (error) {
      toast.error('Erro ao ativar tag.');
    }
  };

  const handleAtivarCategoria = async (codigo) => {
    try {
      await ativarCategoria(codigo);
      await carregar();
      toast.success('Categoria ativada com sucesso!');
    } catch (error) {
      toast.error('Erro ao ativar categoria.');
    }
  };

  return (
    <div className="tags-inativos-page-container">
      <div className="tags-inativos-header">
        <button className="btn-voltar" onClick={() => navigate('/tags')}>
          <FaArrowLeft size={14} /> Voltar
        </button>
        <h2>Itens Inativados</h2>
      </div>

      <div className="tags-inativos-tabs">
        <button
          className={aba === 'tags' ? 'tab-ativa' : ''}
          onClick={() => setAba('tags')}
        >
          Tags inativas ({tagsInativas.length})
        </button>
        <button
          className={aba === 'categorias' ? 'tab-ativa' : ''}
          onClick={() => setAba('categorias')}
        >
          Categorias inativas ({categoriasInativas.length})
        </button>
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : aba === 'tags' ? (
        tagsInativas.length > 0 ? (
          <ul className="inativos-list">
            {tagsInativas.map(tag => (
              <li key={tag.codigo} className="inativo-item">
                <div className="icone-preview" style={{ color: tag.cor }}>
                  <IconRenderer nome={tag.icone} size={24} cor={tag.cor} />
                </div>
                <span className="inativo-nome">{tag.nome}</span>
                <button className="btn-success" onClick={() => handleAtivarTag(tag.codigo)}>
                  <FaCheckCircle size={14} /> Ativar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma tag inativada.</p>
        )
      ) : (
        categoriasInativas.length > 0 ? (
          <ul className="inativos-list">
            {categoriasInativas.map(cat => (
              <li key={cat.codigo} className="inativo-item">
                <div className="icone-preview" style={{ color: cat.cor }}>
                  <IconRenderer nome={cat.icone} size={24} cor={cat.cor} />
                </div>
                <span className="inativo-nome">{cat.nome}</span>
                <button className="btn-success" onClick={() => handleAtivarCategoria(cat.codigo)}>
                  <FaCheckCircle size={14} /> Ativar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma categoria inativada.</p>
        )
      )}
    </div>
  );
};

export default TagsInativos;
```

- [ ] **Step 2: CSS mínimo, reaproveitando variáveis do tema**

```css
/* controle-gastos-frontend/src/pages/TagsInativos/TagsInativos.css */
.tags-inativos-page-container {
  padding: 24px;
}

.tags-inativos-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.btn-voltar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--cg-color-border, rgba(44, 62, 80, 0.2));
  border-radius: var(--borda-radius, 6px);
  padding: 6px 12px;
  cursor: pointer;
  color: var(--cg-color-text, inherit);
}

.tags-inativos-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--cg-color-border, rgba(44, 62, 80, 0.2));
}

.tags-inativos-tabs button {
  background: none;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  color: var(--cg-color-text, inherit);
  border-bottom: 2px solid transparent;
}

.tags-inativos-tabs button.tab-ativa {
  border-bottom-color: var(--cor-primaria, #3085d6);
  font-weight: 600;
}

.inativos-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.inativo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--cg-color-border, rgba(44, 62, 80, 0.15));
  border-radius: var(--borda-radius, 6px);
}

.inativo-nome {
  flex: 1;
}
```

Nota: confira em `TagManagement.css` os nomes reais das variáveis de tema/dark-mode (`var(--cg-color-...)`) antes de finalizar — o snippet acima usa nomes prováveis com fallback, mas o padrão real do projeto deve ser confirmado e ajustado (ver regra de dark mode no `CLAUDE.md`: nunca cor inline hardcoded sem variável reativa).

- [ ] **Step 3: Registrar a rota**

```jsx
// controle-gastos-frontend/src/App.js — adicionar import no topo
import TagsInativos from './pages/TagsInativos/TagsInativos';

// adicionar rota logo após a rota "/tags" existente
<Route
  path="/tags/inativos"
  element={
    <PrivateRoute>
      <MainLayout>
        <TagsInativos />
      </MainLayout>
    </PrivateRoute>
  }
/>
```

- [ ] **Step 4: Botão "Ver inativos" em TagManagement.js**

```jsx
// controle-gastos-frontend/src/components/Tag/TagManagement.js
import { useNavigate } from 'react-router-dom';
// ... dentro do componente:
const navigate = useNavigate();

// no JSX, logo após <h2>Gerenciar Categorias e Tags</h2>:
<div className="tag-management-header-actions">
  <button className="btn-ver-inativos" onClick={() => navigate('/tags/inativos')}>
    Ver inativos
  </button>
</div>
```

- [ ] **Step 5: Roteiro de teste manual**

1. Detecte a porta real do frontend (terminal do `npm start`) e acesse `/tags`.
2. Clique em "Ver inativos".
3. Caminho: `/tags` → botão "Ver inativos" → tela com duas abas.
4. O que deve acontecer: a aba "Tags inativas" mostra as tags que você inativou na Task A5; a aba "Categorias inativas" mostra categorias inativadas.
5. Critério de sucesso: clicar em "Ativar" em qualquer item faz ele sumir da lista de inativos; ao voltar para `/tags`, o item reaparece ativo na tela principal.
6. Problemas comuns: lista vazia mesmo tendo item inativado (checar filtro `ativo === false` — o backend pode estar retornando `ativo` como string em vez de boolean, conferir no Network tab), botão "Voltar" não navega (checar import de `useNavigate`).

- [ ] **Step 6: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `feat(tags): adiciona tela /tags/inativos para reativar tags e categorias`

---

## Fase B — Divisão de pagamentos: replicar tags no "Rateio igual" (Tier 2 — mesma sessão)

### Task B1: Merge aditivo de tags em `splitEqually`

**Files:**
- Modify: `controle-gastos-frontend/src/hooks/usePagamentos.js:109-121`

**Interfaces:**
- Consumes: nenhuma nova — usa apenas o estado `pagamentos` já existente no hook.
- Produces: `splitEqually()` com o mesmo nome/assinatura, comportamento estendido (efeito colateral adicional sobre `paymentTags`).

- [ ] **Step 1: Implementar o merge aditivo**

Reaproveita a mesma lógica de "não duplicar, não sobrescrever" que já existe no backend (`mergeTagsPadrao`, `backend/src/services/importacaoService.js:19-32`), adaptada para o formato do hook:

```js
// controle-gastos-frontend/src/hooks/usePagamentos.js
/**
 * Mescla as tags do pagamento de origem em um paymentTags existente, sem
 * duplicar e sem remover tags que já estavam lá manualmente. Para cada
 * categoria presente em `origem`, adiciona os tagIds que ainda não estão
 * no destino — nunca remove o que já existe.
 */
function mergeTagsAditivo(origem, destino) {
  const origemObj = origem && typeof origem === 'object' ? origem : {};
  const destinoObj = destino && typeof destino === 'object' ? { ...destino } : {};
  Object.keys(origemObj).forEach((catId) => {
    const tagsOrigem = Array.isArray(origemObj[catId]) ? origemObj[catId] : [];
    const tagsDestino = Array.isArray(destinoObj[catId]) ? destinoObj[catId] : [];
    destinoObj[catId] = [...new Set([...tagsDestino.map(String), ...tagsOrigem.map(String)])];
  });
  return destinoObj;
}

const splitEqually = useCallback(() => {
  setPagamentos(prev => {
    if (prev.length === 0) return prev;
    const total = valorEsperadoParaSoma;
    if (total <= 0 || prev.length === 1) return prev;
    const share = Math.floor((total / prev.length) * 100) / 100;
    const remainder = Math.round((total - share * (prev.length - 1)) * 100) / 100;
    const tagsPrincipal = prev[0]?.paymentTags || {};
    return prev.map((p, i) => ({
      ...p,
      valor: String(i === prev.length - 1 ? remainder : share),
      paymentTags: i === 0 ? p.paymentTags : mergeTagsAditivo(tagsPrincipal, p.paymentTags)
    }));
  });
}, [valorEsperadoParaSoma]);
```

- [ ] **Step 2: Roteiro de teste manual**

1. Abra o formulário de nova transação (detecte a porta real do frontend), preencha um valor total, adicione 3 pagamentos.
2. Caminho: no pagamento 1, adicione a tag "Fatura Cartão X" (ou qualquer tag existente). Nos pagamentos 2 e 3, deixe sem tags.
3. Clique em "Rateio igual".
4. Critério de sucesso: os 3 pagamentos ficam com valores redistribuídos E os pagamentos 2 e 3 agora também têm a tag "Fatura Cartão X".
5. Teste do comportamento aditivo: no pagamento 2, adicione manualmente uma segunda tag diferente (ex: "Alimentação"). Volte no pagamento 1 e adicione mais uma tag (ex: "Recorrente"). Clique em "Rateio igual" de novo.
6. Critério de sucesso: o pagamento 2 deve ficar com 3 tags (a original replicada, a "Alimentação" que você adicionou manualmente, e a nova "Recorrente" replicada) — nenhuma tag deve ter sido removida.
7. Problemas comuns a observar: tags duplicadas na mesma categoria (indicaria que o `Set` não está funcionando), tags do pagamento 1 desaparecendo (indicaria que o merge está sobrescrevendo em vez de aditivo).

- [ ] **Step 3: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `fix(pagamentos): rateio igual replica tags do pagamento principal de forma aditiva`

---

## Fase C — Bug "800 ocorrências" (Tier 1 — mesma sessão)

### Task C1: Corrigir `useDuplicateCheck` para respeitar os filtros

**Files:**
- Modify: `controle-gastos-frontend/src/hooks/useDuplicateCheck.js:19-35`

**Interfaces:**
- Consumes: `obterTransacoesPaginadas` (já existe em `controle-gastos-frontend/src/api.js:241-274`), que retorna `{ data: [...], ... }` em vez de `{ transacoes: [...] }`.

- [ ] **Step 1: Trocar `obterTransacoes` por `obterTransacoesPaginadas`**

```js
// controle-gastos-frontend/src/hooks/useDuplicateCheck.js
import { useState, useEffect, useRef } from 'react';
import { obterTransacoesPaginadas } from '../api';

export default function useDuplicateCheck({ descricao, data, valorTotal, enabled }) {
  const [isDuplicate, setIsDuplicate] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !descricao || !data) {
      setIsDuplicate(null);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const result = await obterTransacoesPaginadas({
          page: 1,
          limit: 5,
          search: descricao,
          dataInicio: data,
          dataFim: data
        });

        const transacoes = result?.data || [];
        if (transacoes.length === 0) {
          setIsDuplicate(false);
        } else {
          const valor = parseFloat(valorTotal || 0);
          const similar = transacoes.find(t => t.descricao.toLowerCase() === descricao.toLowerCase() || (valor > 0 && Math.abs(t.valor - valor) < 0.02));
          setIsDuplicate(similar ? { count: transacoes.length, similar: similar.descricao } : false);
        }
      } catch {
        setIsDuplicate(null);
      } finally {
        setIsChecking(false);
      }
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [descricao, data, valorTotal, enabled]);

  return { isDuplicate, isChecking };
}
```

Nota: verificar no momento da implementação o formato exato do campo de retorno de `obterTransacoesPaginadas` — a Fase de investigação confirmou `dados.data` em `api.js:270-272`, mas vale rodar a Task C1 Step 2 com o Network tab do navegador aberto para confirmar visualmente o shape antes de dar como concluído.

- [ ] **Step 2: Roteiro de teste manual**

1. Abra o formulário de nova transação (detecte a porta real do frontend).
2. Caminho: preencha uma descrição comum (ex: "Mercado") e uma data qualquer, com o valor preenchido, na aba "Resumo".
3. O que deve acontecer: se você realmente tiver transações com descrição parecida NAQUELA DATA, o aviso de duplicidade aparece com uma contagem pequena e plausível (1-5, nunca centenas).
4. Critério de sucesso: mude a data para um dia sem nenhuma transação parecida — o aviso deve sumir (contagem 0). Isso confirma que o filtro de data agora está de fato sendo aplicado no backend.
5. Problemas comuns a observar: contagem continua alta (indicaria que `result?.data` não é o campo certo — confira no Network tab da aba Resumo o JSON de resposta de `/api/transacoes?page=1&limit=5...`), aviso nunca aparece mesmo com duplicata clara (confira se `search` está mesmo sendo passado no query string).

- [ ] **Step 3: Apresentar diff e mensagem de commit sugerida, aguardar aprovação**

Sugestão: `fix(transacoes): duplicidade no resumo respeita filtro de busca e data em vez de contar todas as transacoes`

---

## Self-review (cobertura da spec)

- Hard delete condicional (Tag + Categoria) → Task A2. ✅
- Checagem de vínculo via aggregation → Task A1. ✅
- Endpoints ativar/inativar Tag + rota → Task A3. ✅
- `incluirInativas` em `obterTodasTags` → Task A3 Step 1. ✅
- Tela `/tags/inativos` com abas → Task A6. ✅
- Botão "Ver inativos" → Task A6 Step 4. ✅
- Paridade de badge/toggle para Tag na tela principal → Task A5. ✅
- Novos métodos em `api.js` → Task A4. ✅
- Categoria também passa a ter checagem de vínculo (hard delete condicional) → Task A2 Step 2. ✅
- Rateio igual replica tags aditivamente → Task B1. ✅
- Bug de "800 ocorrências" → Task C1. ✅
