# Divisões Pré-Configuradas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir salvar "presets" de divisão de pagamento (pessoa + percentual, 2 ou mais partes) e aplicá-los com um clique na aba Pagamentos do form de transação, substituindo os pagamentos atuais por N pagamentos calculados a partir do valor total, com as tags do pagamento 1 propagadas para os demais.

**Architecture:** CRUD simples e completo (`DivisaoPreset`, escopado por usuário, sem soft-delete — nada referencia um preset por id) seguindo exatamente o padrão de `Pessoa` (model/controller/routes) já existente. Frontend: gerenciamento numa 4ª aba da página `/profile` (sem entrada na sidebar), e aplicação via um novo dropdown na `TabPagamentos`, usando uma nova função `applyPreset` no hook `usePagamentos` que reaproveita a função `mergeTagsAditivo` já existente para propagar tags.

**Tech Stack:** Express + Mongoose (backend), React 19 + hooks (frontend), `fetch`-based client em `src/api.js`.

## Global Constraints

- Model sem `ativo`/soft-delete: nenhuma outra entidade referencia `DivisaoPreset` por id (ele só é "copiado" para dentro de `pagamentos[]` no momento da aplicação) — exclusão é sempre definitiva (`deleteOne`), igual ao raciocínio do ADR-020 para itens sem vínculo.
- Escopo multi-tenant: toda query/gravação filtra por `usuario: req.userId`, mesmo padrão de `Pessoa`/`Tag`/`Categoria`.
- Sem TDD automatizado: cobertura de testes do projeto hoje é só `ledgerService`/`netWorthService` (CLAUDE.md) e esta feature não toca nenhum dos dois — não escrever testes Jest novos. Cada task tem verificação manual (`node -e` para smoke test de módulo backend, roteiro de clique no frontend) em vez de suíte automatizada.
- Sem alteração em `Transacao`/`pagamentos[]` schema — o preset só popula o state do form antes do submit; o payload final continua exatamente `{ pessoa, valor, tags, ... }` como hoje.
- Não mexer no cadastro de `/pessoas` (Empréstimos) — o campo `pessoa` do preset é texto livre, igual ao campo `Pessoa` do pagamento hoje.
- Sem entrada nova na sidebar (`menuStructure.js` não é tocado) — a única forma de chegar na tela de gerenciamento é a aba "Divisões" dentro de `/profile`.

---

### Task 1: Model `DivisaoPreset` (backend)

**Files:**
- Create: `backend/src/models/divisaoPreset.js`

**Interfaces:**
- Produces: `mongoose.model('DivisaoPreset', DivisaoPresetSchema)` com shape `{ _id, usuario, nome, partes: [{ pessoa, percentual }], createdAt, updatedAt }`. Consumido pelo controller da Task 2.

- [ ] **Step 1: Criar o model**

```javascript
// backend/src/models/divisaoPreset.js
const mongoose = require('mongoose');

const ParteSchema = new mongoose.Schema({
  pessoa: { type: String, required: true, trim: true },
  percentual: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const DivisaoPresetSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true, trim: true },
  partes: {
    type: [ParteSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length >= 2,
      message: 'O preset precisa de pelo menos 2 partes.'
    }
  }
}, {
  timestamps: true
});

DivisaoPresetSchema.index({ usuario: 1, nome: 1 }, { unique: true });

module.exports = mongoose.model('DivisaoPreset', DivisaoPresetSchema);
```

- [ ] **Step 2: Smoke test do módulo**

Run: `cd backend && node -e "require('./src/models/divisaoPreset'); console.log('ok')"`
Expected: imprime `ok` sem exceção (confirma que o schema carrega sem erro de sintaxe/registro duplicado).

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/divisaoPreset.js
git commit -m "feat(divisoes): adiciona model DivisaoPreset"
```

---

### Task 2: Controller (backend)

**Files:**
- Create: `backend/src/controllers/divisaoPresetController.js`

**Interfaces:**
- Consumes: `DivisaoPreset` model da Task 1 (`{ usuario, nome, partes: [{pessoa, percentual}] }`).
- Produces: `exports.listar`, `exports.criar`, `exports.atualizar`, `exports.excluir` — handlers Express `(req, res)`. Consumidos pelas rotas da Task 3.

- [ ] **Step 1: Criar o controller**

```javascript
// backend/src/controllers/divisaoPresetController.js
const DivisaoPreset = require('../models/divisaoPreset');

const TOLERANCIA_PERCENTUAL = 0.1;

function validarPartes(partes) {
  if (!Array.isArray(partes) || partes.length < 2) {
    return 'O preset precisa de pelo menos 2 partes.';
  }
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (!p || !p.pessoa || !String(p.pessoa).trim()) {
      return `Parte ${i + 1}: o nome da pessoa é obrigatório.`;
    }
    const pct = Number(p.percentual);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      return `Parte ${i + 1}: percentual inválido.`;
    }
  }
  const soma = partes.reduce((acc, p) => acc + Number(p.percentual), 0);
  if (Math.abs(soma - 100) > TOLERANCIA_PERCENTUAL) {
    return `A soma dos percentuais precisa ser 100% (está em ${soma.toFixed(2)}%).`;
  }
  return null;
}

exports.listar = async (req, res) => {
  try {
    const presets = await DivisaoPreset.find({ usuario: req.userId }).sort({ nome: 1 }).lean();
    res.json(presets);
  } catch (error) {
    console.error('Erro ao listar presets de divisão:', error);
    res.status(500).json({ erro: 'Erro ao listar presets de divisão.' });
  }
};

exports.criar = async (req, res) => {
  const { nome, partes } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome do preset é obrigatório.' });
  }
  const erroPartes = validarPartes(partes);
  if (erroPartes) {
    return res.status(400).json({ erro: erroPartes });
  }
  try {
    const novo = new DivisaoPreset({
      usuario: req.userId,
      nome: nome.trim(),
      partes: partes.map(p => ({ pessoa: String(p.pessoa).trim(), percentual: Number(p.percentual) }))
    });
    await novo.save();
    res.status(201).json(novo);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe um preset com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao criar preset.', detalhe: error.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const preset = await DivisaoPreset.findOne({ _id: req.params.id, usuario: req.userId });
    if (!preset) return res.status(404).json({ erro: 'Preset não encontrado.' });

    if (req.body.nome !== undefined) {
      if (!req.body.nome || !req.body.nome.trim()) {
        return res.status(400).json({ erro: 'O nome não pode ser vazio.' });
      }
      preset.nome = req.body.nome.trim();
    }
    if (req.body.partes !== undefined) {
      const erroPartes = validarPartes(req.body.partes);
      if (erroPartes) return res.status(400).json({ erro: erroPartes });
      preset.partes = req.body.partes.map(p => ({ pessoa: String(p.pessoa).trim(), percentual: Number(p.percentual) }));
    }

    await preset.save();
    res.json(preset);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe um preset com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar preset.', detalhe: error.message });
  }
};

exports.excluir = async (req, res) => {
  try {
    const preset = await DivisaoPreset.findOne({ _id: req.params.id, usuario: req.userId });
    if (!preset) return res.status(404).json({ erro: 'Preset não encontrado.' });
    await DivisaoPreset.deleteOne({ _id: preset._id });
    res.json({ mensagem: 'Preset excluído com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir preset.' });
  }
};
```

- [ ] **Step 2: Smoke test do módulo**

Run: `cd backend && node -e "require('./src/controllers/divisaoPresetController'); console.log('ok')"`
Expected: imprime `ok` sem exceção.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/divisaoPresetController.js
git commit -m "feat(divisoes): adiciona controller de DivisaoPreset com validacao de soma 100%"
```

---

### Task 3: Rotas + registro no app.js (backend)

**Files:**
- Create: `backend/src/routes/rotasDivisaoPreset.js`
- Modify: `backend/src/app.js:83-84` (import), `backend/src/app.js:107-108` (registro)

**Interfaces:**
- Consumes: `divisaoPresetController` da Task 2, `autenticacao` de `backend/src/middlewares/autenticacao.js` (mesmo middleware usado em `rotasPessoa.js`).
- Produces: rotas HTTP em `/api/divisao-presets` — `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`. Consumidas pelo client frontend da Task 4.

- [ ] **Step 1: Criar as rotas**

```javascript
// backend/src/routes/rotasDivisaoPreset.js
const express = require('express');
const router = express.Router();
const divisaoPresetController = require('../controllers/divisaoPresetController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', divisaoPresetController.listar);
router.post('/', divisaoPresetController.criar);
router.put('/:id', divisaoPresetController.atualizar);
router.delete('/:id', divisaoPresetController.excluir);

module.exports = router;
```

- [ ] **Step 2: Registrar em app.js**

Em `backend/src/app.js`, logo após a linha `const rotasPessoa = require('./routes/rotasPessoa');` (linha 83):

```javascript
const rotasPessoa = require('./routes/rotasPessoa');
const rotasDivisaoPreset = require('./routes/rotasDivisaoPreset');
```

E logo após `app.use('/api/pessoas', rotasPessoa);` (linha 107):

```javascript
app.use('/api/pessoas', rotasPessoa);
app.use('/api/divisao-presets', rotasDivisaoPreset);
```

- [ ] **Step 3: Subir o backend e verificar que a rota responde**

Run: `cd backend && npm run dev` (deixar rodando)

Em outro terminal, com um token válido de usuário logado (pegar do localStorage do navegador, chave `token`):

```bash
curl -H "Authorization: Bearer SEU_TOKEN_AQUI" http://localhost:3001/api/divisao-presets
```

Expected: `200 OK` com `[]` (lista vazia, nenhum preset criado ainda). Um `401` indica token errado/expirado; um `404` indica que a rota não foi registrada corretamente — revisar Step 2.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/rotasDivisaoPreset.js backend/src/app.js
git commit -m "feat(divisoes): registra rotas /api/divisao-presets"
```

---

### Task 4: Client HTTP no frontend (`src/api.js`)

**Files:**
- Modify: `controle-gastos-frontend/src/api.js` (adicionar seção nova após o bloco `/* ----- Empréstimos ----- */`, ou em qualquer ponto do arquivo — a organização é por comentário de seção, não por ordem estrutural)

**Interfaces:**
- Consumes: `API_BASE`, `getHeaders()` já definidos no topo do arquivo (linhas 4-22).
- Produces: `listarDivisaoPresets()`, `criarDivisaoPreset(preset)`, `atualizarDivisaoPreset(id, preset)`, `excluirDivisaoPreset(id)`. Consumidas pela Task 5 (via NovaTransacaoForm) e Task 8 (Profile).

- [ ] **Step 1: Adicionar as funções no final do arquivo**

```javascript
/* ----- Divisões Pré-Configuradas ----- */
export async function listarDivisaoPresets() {
  const resposta = await fetch(`${API_BASE}/divisao-presets`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao listar presets de divisão.`);
  return Array.isArray(dados) ? dados : [];
}

export async function criarDivisaoPreset(preset) {
  const resposta = await fetch(`${API_BASE}/divisao-presets`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(preset)
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao criar preset de divisão.`);
  return dados;
}

export async function atualizarDivisaoPreset(id, preset) {
  const resposta = await fetch(`${API_BASE}/divisao-presets/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(preset)
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao atualizar preset de divisão.`);
  return dados;
}

export async function excluirDivisaoPreset(id) {
  const resposta = await fetch(`${API_BASE}/divisao-presets/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao excluir preset de divisão.`);
  return dados;
}
```

- [ ] **Step 2: Verificar que o arquivo não quebrou a build**

Run: `cd controle-gastos-frontend && npx eslint src/api.js`
Expected: nenhum erro novo (warnings pré-existentes no arquivo, se houver, são aceitáveis — só checar que não há erro de sintaxe nas funções novas).

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/api.js
git commit -m "feat(divisoes): adiciona client HTTP para /api/divisao-presets"
```

---

### Task 5: `applyPreset` no hook `usePagamentos`

**Files:**
- Modify: `controle-gastos-frontend/src/hooks/usePagamentos.js`

**Interfaces:**
- Consumes: `mergeTagsAditivo` (já definida no topo do arquivo, linha 21), `valorEsperadoParaSoma` (já derivado no hook, linha 59), `empFieldsPadrao()` (linha 3).
- Produces: `applyPreset(preset)` onde `preset = { nome, partes: [{ pessoa, percentual }, ...] }` (shape retornado pelo backend da Task 2/3). Adicionada ao objeto de retorno do hook — consumida pela Task 6 (`TabPagamentos`).

- [ ] **Step 1: Adicionar `applyPreset` logo após `splitInto` (depois da linha 170, antes de `clearPaymentTags`)**

```javascript
  const applyPreset = useCallback((preset) => {
    setPagamentos(prev => {
      if (!preset || !Array.isArray(preset.partes) || preset.partes.length < 2) return prev;
      const total = valorEsperadoParaSoma;
      if (total <= 0) return prev;
      const n = preset.partes.length;
      const tagsPrincipal = prev[0]?.paymentTags || {};

      // Calcula os valores pelo percentual de cada parte; a última parte
      // absorve a diferença de arredondamento (mesmo padrão de splitInto).
      let somaParcial = 0;
      const valoresBrutos = preset.partes.map((parte, i) => {
        if (i === n - 1) return null; // último calculado por diferença
        const v = Math.floor((total * (Number(parte.percentual) / 100)) * 100) / 100;
        somaParcial += v;
        return v;
      });
      const ultimoValor = Math.round((total - somaParcial) * 100) / 100;

      return preset.partes.map((parte, i) => {
        const tagsExistentes = i === 0 ? tagsPrincipal : (prev[i]?.paymentTags || {});
        return {
          pessoa: parte.pessoa,
          valor: String(i === n - 1 ? ultimoValor : valoresBrutos[i]),
          paymentTags: i === 0 ? { ...tagsPrincipal } : mergeTagsAditivo(tagsPrincipal, tagsExistentes),
          parcelamento: null,
          emprestimoId: null,
          ...empFieldsPadrao(),
          fixed: false
        };
      });
    });
  }, [valorEsperadoParaSoma]);
```

- [ ] **Step 2: Exportar no objeto de retorno do hook**

Em `controle-gastos-frontend/src/hooks/usePagamentos.js`, no `return` final (linha ~399-425), adicionar `applyPreset` junto de `splitInto`:

```javascript
    splitEqually,
    splitInto,
    applyPreset,
```

- [ ] **Step 3: Verificar que o arquivo não quebrou a build**

Run: `cd controle-gastos-frontend && npx eslint src/hooks/usePagamentos.js`
Expected: nenhum erro novo.

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/hooks/usePagamentos.js
git commit -m "feat(divisoes): adiciona applyPreset ao usePagamentos"
```

---

### Task 6: UI de aplicação em `TabPagamentos`

**Files:**
- Modify: `controle-gastos-frontend/src/components/Transaction/TabPagamentos.js`
- Modify: `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.css` (estilo do novo dropdown)

**Interfaces:**
- Consumes: `applyPreset` da Task 5, prop nova `divisaoPresets` (array `{_id, nome, partes}[]`) que será passada pela Task 7.
- Produces: dropdown "Aplicar divisão salva" visível apenas quando `divisaoPresets.length > 0`.

- [ ] **Step 1: Adicionar a prop `divisaoPresets` e `applyPreset` na assinatura do componente**

Em `TabPagamentos.js`, na desestruturação de props (linha 48-80), adicionar logo após `splitInto`:

```javascript
  splitEqually,
  splitInto,
  applyPreset,
  divisaoPresets = [],
```

- [ ] **Step 2: Adicionar o dropdown ao lado de "Dividir em" (dentro de `.pagamentos-actions`, logo após o bloco `.divide-by-select`, por volta da linha 143)**

```jsx
            {divisaoPresets.length > 0 && (
              <div className="divide-by-select aplicar-preset-select">
                <span>Aplicar divisão</span>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const preset = divisaoPresets.find(p => p._id === e.target.value);
                    if (preset) applyPreset(preset);
                    e.target.value = '';
                  }}
                >
                  <option value="" disabled>—</option>
                  {divisaoPresets.map(preset => (
                    <option key={preset._id} value={preset._id}>{preset.nome}</option>
                  ))}
                </select>
              </div>
            )}
```

- [ ] **Step 3: Estilo (reaproveita `.divide-by-select` já existente — sem CSS novo necessário)**

`.aplicar-preset-select` herda todo o estilo de `.divide-by-select` (`NovaTransacaoForm.css:798-808`) por ter as duas classes no mesmo elemento. Não é necessário adicionar CSS novo nesta task.

- [ ] **Step 4: Verificar visualmente**

Run: `cd controle-gastos-frontend && npm start` (deixar rodando, porta 3004 salvo configuração diferente)

No navegador: login → qualquer tela → abrir "Nova Transação" → aba Pagamentos → adicionar um 2º pagamento (pra ativar a seção de ações). Como ainda não existe preset salvo (Task 8 não foi feita), o dropdown "Aplicar divisão" não deve aparecer — confirma que a renderização condicional (`divisaoPresets.length > 0`) está correta antes de existir dado real pra testar com.

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/components/Transaction/TabPagamentos.js
git commit -m "feat(divisoes): adiciona dropdown de aplicar divisao salva na TabPagamentos"
```

---

### Task 7: Wiring em `NovaTransacaoForm`

**Files:**
- Modify: `controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js`

**Interfaces:**
- Consumes: `listarDivisaoPresets` (Task 4), `applyPreset`/`pagamentos` (Task 5), `TabPagamentos` (Task 6).
- Produces: state `divisaoPresets` carregado uma vez ao montar o form, passado como prop pra `TabPagamentos`.

- [ ] **Step 1: Importar `listarDivisaoPresets`**

Em `NovaTransacaoForm.js:5`, adicionar ao import existente:

```javascript
import { criarTransacao, atualizarTransacao, listarEmprestimos, listarPessoas, listarDivisaoPresets } from '../../api';
```

- [ ] **Step 2: Carregar a lista uma vez ao montar (mesmo padrão de `pessoas`, linhas 68-80)**

Logo após o bloco `useEffect` que carrega `pessoas` (depois da linha 80):

```javascript
  const [divisaoPresets, setDivisaoPresets] = useState([]);
  const divisaoPresetsCarregadosRef = useRef(false);

  useEffect(() => {
    if (divisaoPresetsCarregadosRef.current) return;
    divisaoPresetsCarregadosRef.current = true;
    listarDivisaoPresets()
      .then((lista) => setDivisaoPresets(lista || []))
      .catch(() => setDivisaoPresets([]));
  }, []);
```

- [ ] **Step 3: Passar as novas props pro `TabPagamentos`**

No JSX de `<TabPagamentos ... />` (a partir da linha 389), logo após `splitInto={pagamentos.splitInto}` (linha 396):

```jsx
          splitInto={pagamentos.splitInto}
          applyPreset={pagamentos.applyPreset}
          divisaoPresets={divisaoPresets}
```

- [ ] **Step 4: Verificar no navegador (sem preset criado ainda, só smoke test de que nada quebrou)**

Run: `cd controle-gastos-frontend && npm start` (se não estiver rodando)

No navegador: abrir "Nova Transação" com valor total preenchido (ex: R$ 100), aba Pagamentos, adicionar 2º pagamento. Confirmar que "Rateio igual" e "Dividir em" continuam funcionando normalmente (nenhuma regressão pelas props novas).

- [ ] **Step 5: Commit**

```bash
git add controle-gastos-frontend/src/components/Transaction/NovaTransacaoForm.js
git commit -m "feat(divisoes): carrega presets de divisao e conecta ao TabPagamentos"
```

---

### Task 8: Tela de gerenciamento — nova aba "Divisões" em `/profile`

**Files:**
- Modify: `controle-gastos-frontend/src/pages/Profile/Profile.js`
- Modify: `controle-gastos-frontend/src/pages/Profile/Profile.css`

**Interfaces:**
- Consumes: `listarDivisaoPresets`, `criarDivisaoPreset`, `atualizarDivisaoPreset`, `excluirDivisaoPreset` (Task 4).
- Produces: CRUD completo de presets, acessível só por essa aba (sem link na sidebar).

- [ ] **Step 1: Importar o client HTTP**

`Profile.js:8` já importa `api` de `'../../services/api'` (client axios, usado por `/usuarios/perfil` etc.) — não duplicar esse import. Adicionar uma linha nova logo abaixo dele, importando do client fetch-based (`src/api.js`, o mesmo usado pela Task 4):

```javascript
import { listarDivisaoPresets, criarDivisaoPreset, atualizarDivisaoPreset, excluirDivisaoPreset } from '../../api';
```

- [ ] **Step 2: Adicionar state e handlers, logo após a declaração de `preferencias` (depois da linha 45)**

```javascript
  const [divisaoPresets, setDivisaoPresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [editandoPresetId, setEditandoPresetId] = useState(null);
  const [presetForm, setPresetForm] = useState({ nome: '', partes: [{ pessoa: '', percentual: '' }, { pessoa: '', percentual: '' }] });

  const carregarPresets = useCallback(async () => {
    setLoadingPresets(true);
    try {
      const lista = await listarDivisaoPresets();
      setDivisaoPresets(lista);
    } catch (error) {
      toast.error('Erro ao carregar presets de divisão');
    } finally {
      setLoadingPresets(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'divisoes') carregarPresets();
  }, [activeTab, carregarPresets]);

  const resetPresetForm = () => {
    setEditandoPresetId(null);
    setPresetForm({ nome: '', partes: [{ pessoa: '', percentual: '' }, { pessoa: '', percentual: '' }] });
  };

  const iniciarEdicaoPreset = (preset) => {
    setEditandoPresetId(preset._id);
    setPresetForm({
      nome: preset.nome,
      partes: preset.partes.map(p => ({ pessoa: p.pessoa, percentual: String(p.percentual) }))
    });
  };

  const handlePresetParteChange = (index, field, value) => {
    setPresetForm(prev => {
      const partes = [...prev.partes];
      partes[index] = { ...partes[index], [field]: value };
      return { ...prev, partes };
    });
  };

  const addPresetParte = () => {
    setPresetForm(prev => ({ ...prev, partes: [...prev.partes, { pessoa: '', percentual: '' }] }));
  };

  const removePresetParte = (index) => {
    setPresetForm(prev => {
      if (prev.partes.length <= 2) return prev;
      return { ...prev, partes: prev.partes.filter((_, i) => i !== index) };
    });
  };

  const somaPresetForm = presetForm.partes.reduce((acc, p) => acc + (parseFloat(p.percentual) || 0), 0);

  const handlePresetSubmit = async (e) => {
    e.preventDefault();
    if (!presetForm.nome.trim()) {
      toast.error('Informe um nome para o preset.');
      return;
    }
    if (Math.abs(somaPresetForm - 100) > 0.1) {
      toast.error(`A soma dos percentuais precisa ser 100% (está em ${somaPresetForm.toFixed(2)}%).`);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nome: presetForm.nome.trim(),
        partes: presetForm.partes.map(p => ({ pessoa: p.pessoa.trim(), percentual: parseFloat(p.percentual) }))
      };
      if (editandoPresetId) {
        await atualizarDivisaoPreset(editandoPresetId, payload);
        toast.success('Preset atualizado com sucesso');
      } else {
        await criarDivisaoPreset(payload);
        toast.success('Preset criado com sucesso');
      }
      resetPresetForm();
      carregarPresets();
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar preset');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirPreset = async (preset) => {
    if (!window.confirm(`Excluir o preset "${preset.nome}"?`)) return;
    try {
      await excluirDivisaoPreset(preset._id);
      toast.success('Preset excluído');
      if (editandoPresetId === preset._id) resetPresetForm();
      carregarPresets();
    } catch (error) {
      toast.error(error.message || 'Erro ao excluir preset');
    }
  };
```

- [ ] **Step 3: Adicionar o botão da 4ª aba, logo após o botão "Preferências" (depois da linha 253)**

```jsx
          <button
            className={`tab-button ${activeTab === 'divisoes' ? 'active' : ''}`}
            onClick={() => setActiveTab('divisoes')}
          >
            Divisões
          </button>
```

- [ ] **Step 4: Adicionar o conteúdo da aba, logo após o bloco `{activeTab === 'preferencias' && (...)}` (depois da linha ~527, antes do fechamento de `.profile-content`)**

```jsx
        {activeTab === 'divisoes' && (
          <div className="divisoes-preset-container">
            <form onSubmit={handlePresetSubmit} className="preset-form">
              <h3>{editandoPresetId ? 'Editar preset' : 'Novo preset de divisão'}</h3>
              <div className="form-group">
                <label>Nome do preset</label>
                <input
                  type="text"
                  value={presetForm.nome}
                  onChange={(e) => setPresetForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Aluguel com Marina"
                  required
                />
              </div>

              {presetForm.partes.map((parte, index) => (
                <div key={index} className="preset-parte-row">
                  <div className="form-group">
                    <label>Pessoa</label>
                    <input
                      type="text"
                      value={parte.pessoa}
                      onChange={(e) => handlePresetParteChange(index, 'pessoa', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Percentual (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={parte.percentual}
                      onChange={(e) => handlePresetParteChange(index, 'percentual', e.target.value)}
                      required
                    />
                  </div>
                  {presetForm.partes.length > 2 && (
                    <button type="button" className="btn-remove-parte" onClick={() => removePresetParte(index)}>
                      Remover
                    </button>
                  )}
                </div>
              ))}

              <div className="preset-form-actions">
                <button type="button" className="btn-add-parte" onClick={addPresetParte}>
                  + Adicionar parte
                </button>
                <span className={`preset-soma ${Math.abs(somaPresetForm - 100) > 0.1 ? 'soma-diff' : 'soma-ok'}`}>
                  Soma: {somaPresetForm.toFixed(2)}%
                </span>
              </div>

              <div className="preset-form-actions">
                <button type="submit" className="btn-submit" disabled={loading}>
                  {editandoPresetId ? 'Salvar alterações' : 'Criar preset'}
                </button>
                {editandoPresetId && (
                  <button type="button" className="btn-cancelar-edicao" onClick={resetPresetForm}>
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>

            <div className="presets-lista">
              <h3>Presets salvos</h3>
              {loadingPresets && <p>Carregando...</p>}
              {!loadingPresets && divisaoPresets.length === 0 && <p>Nenhum preset salvo ainda.</p>}
              {divisaoPresets.map(preset => (
                <div key={preset._id} className="preset-item">
                  <div className="preset-item-info">
                    <strong>{preset.nome}</strong>
                    <span>{preset.partes.map(p => `${p.pessoa} (${p.percentual}%)`).join(' + ')}</span>
                  </div>
                  <div className="preset-item-actions">
                    <button type="button" onClick={() => iniciarEdicaoPreset(preset)}>Editar</button>
                    <button type="button" onClick={() => handleExcluirPreset(preset)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 5: Adicionar estilo mínimo em `Profile.css` (final do arquivo)**

```css
.divisoes-preset-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.preset-parte-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 8px;
}

.preset-form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.preset-soma.soma-ok {
  color: var(--cg-color-success);
}

.preset-soma.soma-diff {
  color: var(--cg-color-error);
}

.presets-lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--cg-color-border);
  border-radius: 6px;
}

.preset-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preset-item-actions {
  display: flex;
  gap: 8px;
}
```

Essas três variáveis (`--cg-color-success`, `--cg-color-error`, `--cg-color-border`) já existem em `controle-gastos-frontend/src/theme/tokens.css:16-19` (light) e `:162-165` (dark) — reativas ao `[data-theme="dark"]`, confirmadas antes de escrever este passo. Não usar cor hardcoded, por causa do histórico de bugs de dark mode documentado em `.brain/decisions/2026-06-23-*`.

- [ ] **Step 6: Verificar no navegador — fluxo completo de CRUD**

Run: `cd controle-gastos-frontend && npm start` (se não estiver rodando)

1. Login → `/profile` → aba "Divisões"
2. Criar um preset: nome "Teste 60/40", parte 1 = "Você" 60%, parte 2 = "Fulano" 40% → Criar preset
3. Confirmar que aparece em "Presets salvos" e o toast de sucesso apareceu
4. Editar o preset (mudar percentual pra 50/50) → Salvar alterações → confirmar que a lista atualizou
5. Excluir o preset → confirmar modal de confirmação → confirmar que sumiu da lista

- [ ] **Step 7: Commit**

```bash
git add controle-gastos-frontend/src/pages/Profile/Profile.js controle-gastos-frontend/src/pages/Profile/Profile.css
git commit -m "feat(divisoes): adiciona aba Divisoes em /profile com CRUD de presets"
```

---

### Task 9: Verificação end-to-end (fluxo completo aplicado numa transação real)

**Files:** nenhum arquivo novo — task de verificação manual.

- [ ] **Step 1: Criar um preset real via `/profile` → aba Divisões**

Nome: "Aluguel compartilhado", 2 partes: "Você" 70%, "Marina" 30%.

- [ ] **Step 2: Abrir Nova Transação e aplicar o preset**

1. Nova Transação → Descrição "Aluguel" → Valor total R$ 1000,00
2. Aba Pagamentos → dropdown "Aplicar divisão" → selecionar "Aluguel compartilhado"
3. **Critério de sucesso:** aparecem 2 pagamentos — um com pessoa "Você" e valor R$ 700,00, outro "Marina" e R$ 300,00. A barra de resumo mostra "Soma: R$ 1000,00" sem aviso de diferença.

- [ ] **Step 3: Testar propagação de tags**

1. Antes de aplicar o preset, no pagamento 1 (com 1 único pagamento na tela) adicionar uma tag (ex: categoria "Moradia" → tag "Aluguel")
2. Aplicar o preset "Aluguel compartilhado"
3. **Critério de sucesso:** os 2 pagamentos resultantes têm a tag "Aluguel" (propagação aditiva, mesma função usada por "Rateio igual"/"Dividir em")

- [ ] **Step 4: Salvar a transação e confirmar no backend**

Salvar a transação → abrir os detalhes dela (ou checar via `mongosh`) → `pagamentos[]` deve ter os 2 registros com `pessoa`, `valor` e `tags` corretos, exatamente como uma divisão manual teria gerado.

- [ ] **Step 5: Reportar resultado ao usuário**

Nenhum commit nesta task — é só o roteiro de smoke test manual pra confirmar que a feature funciona ponta a ponta antes de considerar o plano concluído.
