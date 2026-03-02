# Relatório Técnico — Auditoria Multi-Tenant

**Sistema:** Controle de Gastos (SaaS)  
**Stack:** Node.js, Express, MongoDB (Mongoose), React  
**Data da Auditoria:** Março 2026  
**Objetivo:** Verificar prontidão para ambiente multi-tenant com múltiplas contas simultâneas

---

## ✅ Diagnóstico Geral

| Aspecto | Status | Observação |
|---------|--------|------------|
| **Prontidão para multi-tenant** | **Parcialmente pronto** | Isolamento de dados implementado na maioria dos fluxos, mas existem vulnerabilidades pontuais e lacunas de defesa em profundidade |
| **Risco de vazamento de dados** | **Médio** | Nenhum vazamento direto identificado em fluxos normais; porém, várias queries sem filtro de `usuario` em updates e em middlewares de models representam risco em cenários de bug ou manipulação |
| **Cobertura de testes multi-tenant** | **Inexistente** | Não há testes automatizados simulando múltiplos usuários |

---

## 🔴 Problemas Críticos

### 1. Pre-save em Categoria e Tag: verificação de código sem filtro por usuário

**Arquivos:** `backend/src/models/categoria.js`, `backend/src/models/tag.js`

**Problema:** O middleware `pre('save')` usa `findOne({ codigo: this.codigo })` **sem** incluir `usuario` na query. Isso implica:

- Verificação de unicidade de código feita globalmente, não por tenant
- Possível colisão entre usuários (código gerado aleatoriamente pode coincidir)
- Em cenário de corrida, um usuário pode falhar ao salvar por código “existente” de outro usuário

**Trecho afetado (categoria.js, linhas 38–51):**

```javascript
CategoriaSchema.pre('save', async function(next) {
  if (this.isNew) {
    let codigoUnico = false;
    while (!codigoUnico) {
      const existente = await this.constructor.findOne({ codigo: this.codigo }); // ❌ Sem usuario
      if (!existente) {
        codigoUnico = true;
      } else {
        this.codigo = 'CAT_' + Math.random().toString(36).substr(2, 9).toUpperCase();
      }
    }
  }
  next();
});
```

**Correção recomendada:**

```javascript
const existente = await this.constructor.findOne({ 
  codigo: this.codigo, 
  usuario: this.usuario 
});
```

**Severidade:** 🔴 Crítico — pode impedir criação de categorias/tags para novos usuários em cenários de colisão.

---

### 2. Campo `codigo` com `unique: true` global em Categoria e Tag

**Arquivos:** `backend/src/models/categoria.js`, `backend/src/models/tag.js`

**Problema:** O schema define `codigo: { unique: true }`, criando índice único **global** na coleção. Com multi-tenancy, o ideal é unicidade por usuário.

**Impacto:** Dois usuários não podem ter categorias/tags com o mesmo código. Como o código é gerado aleatoriamente, a probabilidade de colisão é baixa, mas não nula.

**Correção recomendada:** Remover `unique: true` de `codigo` e criar índice composto `{ usuario: 1, codigo: 1 }` com `unique: true`.

---

### 3. `Transacao.updateOne` sem filtro de `usuario` no estorno de importação

**Arquivo:** `backend/src/controllers/importacaoController.js` (linhas 467–470)

**Problema:** Ao estornar importação, o `Transacao.updateOne` usa apenas `_id` e `status`:

```javascript
await Transacao.updateOne(
  { _id: transacaoImportada.transacaoCriada, status: 'ativo' },
  { $set: { status: 'estornado' } }
);
```

**Risco:** Em caso de bug ou dados inconsistentes, uma transação de outro usuário poderia ser estornada.

**Correção recomendada:**

```javascript
await Transacao.updateOne(
  { _id: transacaoImportada.transacaoCriada, usuario: req.userId, status: 'ativo' },
  { $set: { status: 'estornado' } }
);
```

**Severidade:** 🔴 Crítico — falha de defesa em profundidade em operação destrutiva.

---

### 4. `HistoricoSaldo.find` sem filtro de `usuario` em `obterHistorico`

**Arquivo:** `backend/src/controllers/subcontaController.js` (linhas 151–156)

**Problema:** A query usa apenas `subconta`:

```javascript
const historico = await HistoricoSaldo.find({ subconta: req.params.id })
  .sort({ data: -1 })
  .limit(100)
  .lean();
```

**Contexto:** A subconta é validada antes com `usuario: req.userId`, então em fluxo normal não há vazamento. Porém, a ausência de `usuario` na query reduz a defesa em profundidade.

**Correção recomendada:**

```javascript
const historico = await HistoricoSaldo.find({ 
  subconta: req.params.id, 
  usuario: req.userId 
})
  .sort({ data: -1 })
  .limit(100)
  .lean();
```

**Severidade:** 🟠 Alto — risco teórico se houver bug na validação anterior.

---

## 🟠 Problemas de Alto Risco

### 5. `sugerirTransferencias` sem filtro de `usuario`

**Arquivo:** `backend/src/services/movimentacaoInternaService.js` (linhas 46–56)

**Problema:** A busca de transferências usa apenas `subcontaOrigem`, `subcontaDestino`, `status` e `valor`:

```javascript
const transferencias = await Transferencia.find({
  $or: [
    { subcontaOrigem: subcontaId },
    { subcontaDestino: subcontaId }
  ],
  status: 'pendente',
  valor: { $gte: valor - toleranciaValor, $lte: valor + toleranciaValor },
  data: { $gte: startDate, $lte: endDate }
})
```

**Contexto:** O `subcontaId` vem de uma `TransacaoOFX` já validada com `usuario: req.userId`, então subcontas e transferências pertencem ao mesmo usuário. Ainda assim, a ausência de `usuario` na query é uma lacuna de segurança.

**Correção recomendada:** Incluir `usuario: userId` na query (passando `userId` como parâmetro do serviço).

---

### 6. `Transacao.updateOne` e `Transacao.findById` sem `usuario` no `settlementService`

**Arquivo:** `backend/src/services/settlementService.js`

**Problemas:**

- Linhas 179–183: `Transacao.updateOne({ _id: receivingTransactionId }, ...)` — sem `usuario`
- Linhas 266–270: `Transacao.updateOne({ _id: settlement.receivingTransactionId }, ...)` — sem `usuario`
- Linhas 293–298: `Transacao.updateOne({ _id: settlement.leftoverTransactionId }, ...)` — sem `usuario`
- Linha 275: `Transacao.findById(app.transactionId)` — sem filtro de `usuario`

**Contexto:** O settlement é obtido com `usuario: usuarioId`, então as transações envolvidas pertencem ao usuário. Ainda assim, updates e buscas sem `usuario` reduzem a defesa em profundidade.

**Correção recomendada:** Incluir `usuario: usuarioId` em todos os filtros de `Transacao` no `settlementService`.

---

### 7. `Transacao.updateMany` sem `usuario` no `vinculoService`

**Arquivo:** `backend/src/services/vinculoService.js` (linhas 241–244 e 255–258)

**Problema:**

```javascript
await Transacao.updateMany(
  { _id: { $in: transacoesQuitadas } },
  { $set: { 'contaConjunta.acertadoEm': acerto._id } }
);
```

**Contexto:** Os IDs vêm de transações já filtradas por `usuario`. A inclusão de `usuario` no filtro reforça a segurança.

**Correção recomendada:**

```javascript
await Transacao.updateMany(
  { _id: { $in: transacoesQuitadas }, usuario: usuarioId },
  { $set: { 'contaConjunta.acertadoEm': acerto._id } }
);
```

---

## 🟡 Problemas Médios

### 8. Validação de `importacaoId` em `listarTransacoes`

**Arquivo:** `backend/src/controllers/transacaoImportadaController.js`

**Problema:** A rota `GET /importacoes/:importacaoId/transacoes` não valida se a importação pertence ao usuário antes de listar transações. A query usa `{ importacao: importacaoId, usuario: req.userId }`, o que retorna vazio se a importação for de outro usuário, mas o ideal é retornar 404 quando a importação não existir ou não pertencer ao usuário.

**Correção recomendada:** Antes de listar, executar:

```javascript
const importacao = await Importacao.findOne({ _id: req.params.importacaoId, usuario: req.userId });
if (!importacao) return res.status(404).json({ erro: 'Importação não encontrada.' });
```

---

### 9. `TransacaoImportada.find` sem `usuario` na finalização e estorno

**Arquivo:** `backend/src/controllers/importacaoController.js`

**Problema:** Em `finalizarImportacao` e `estornarImportacao`, as queries usam apenas `importacao` e `status`:

```javascript
const transacoesImportadas = await TransacaoImportada.find({
  importacao: importacao._id,
  status: 'validada'
});
```

**Contexto:** A importação foi obtida com `usuario: req.userId`, então as transações pertencem ao usuário. Incluir `usuario` na query aumenta a segurança.

---

### 10. `Importacao.findById` sem filtro de usuário no `processarArquivo`

**Arquivo:** `backend/src/services/importacaoService.js`

**Problema:** `processarArquivo(importacaoId)` usa `Importacao.findById(importacaoId)` em vários pontos sem validar `usuario`.

**Contexto:** O método é chamado internamente após a criação da importação pelo usuário, então o `importacaoId` vem de uma importação recém-criada. O risco é baixo, mas em cenários de chamada incorreta (ex.: job assíncrono com ID errado) poderia processar importação de outro usuário.

**Correção recomendada:** Validar `usuario` ao buscar a importação ou garantir que o processamento só seja disparado por fluxos que já validaram o dono.

---

## 🟢 Melhorias Recomendadas

### 11. Índices compostos para performance multi-tenant

**Problema:** Algumas coleções não possuem índices compostos com `usuario` na primeira posição, o que pode degradar a performance com muitos usuários.

**Recomendações:**

| Modelo | Índice sugerido | Uso |
|--------|------------------|-----|
| Transacao | `{ usuario: 1, data: -1 }` | Já existe `{ usuario: 1, status: 1, data: -1 }` |
| HistoricoSaldo | `{ usuario: 1, subconta: 1, data: -1 }` | Queries típicas de evolução |
| TransacaoImportada | `{ usuario: 1, importacao: 1, status: 1 }` | Listagem por importação |
| Categoria | `{ usuario: 1, codigo: 1 }` unique | Unicidade por usuário |
| Tag | `{ usuario: 1, codigo: 1 }` unique | Unicidade por usuário |

---

### 12. Documento global TaxaCDI

**Arquivo:** `backend/src/models/taxaCDI.js`

**Observação:** A coleção `TaxaCDI` é intencionalmente global (sem `usuario`), pois representa taxas de mercado. Está correto para multi-tenant.

---

### 13. Backup: listagem e download

**Arquivo:** `backend/src/services/backupService.js`

**Observação:** `listarBackups` retorna todos os backups (para admin). O download usa apenas o nome do arquivo. Para admin isso é aceitável; para um futuro cenário de backup por usuário, seria necessário filtrar por `createdBy`.

---

## 🏗️ Recomendações Arquiteturais

### 1. Middleware de injeção de `userId`

Criar um middleware que garanta `req.userId` em todas as rotas protegidas e que rejeite qualquer `userId` vindo de `body` ou `query`:

```javascript
// middleware/requireUserId.js
function requireUserId(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ erro: 'Usuário não autenticado.' });
  }
  // Nunca confiar em userId do body/query
  if (req.body?.userId) delete req.body.userId;
  if (req.query?.userId) delete req.query.userId;
  next();
}
```

---

### 2. Plugin Mongoose para forçar `usuario`

Criar um plugin que injete `usuario` em todas as queries de modelos multi-tenant:

```javascript
// plugins/tenantPlugin.js
function tenantPlugin(schema, options) {
  schema.pre(['find', 'findOne', 'countDocuments'], function() {
    const userId = this.getOptions()?.userId;
    if (userId) {
      this.where({ usuario: userId });
    }
  });
}
```

Uso requer passar `userId` via `options` em cada chamada; pode ser integrado a um service/repository que sempre receba o contexto do usuário.

---

### 3. BaseRepository pattern

Centralizar acesso a dados em repositórios que sempre recebem `userId`:

```javascript
// repositories/transacaoRepository.js
class TransacaoRepository {
  constructor(userId) {
    this.userId = userId;
  }
  find(filter = {}) {
    return Transacao.find({ ...filter, usuario: this.userId });
  }
  findById(id) {
    return Transacao.findOne({ _id: id, usuario: this.userId });
  }
  // ...
}
```

---

### 4. Estratégia de testes multi-tenant

- **Testes de isolamento:** Criar dois usuários, popular dados para cada um, e garantir que as APIs retornem apenas dados do usuário autenticado.
- **Testes de vazamento:** Tentar acessar recursos de outro usuário via IDs manipulados e validar 404 ou 403.
- **Testes de agregação:** Garantir que relatórios e dashboards não misturem dados entre usuários.

---

## 🧪 Sugestão de Teste Automatizado

```javascript
// tests/multi-tenant-isolation.test.js
const request = require('supertest');
const app = require('../app');
const Usuario = require('../models/usuarios');
const Transacao = require('../models/transacao');

describe('Isolamento Multi-Tenant', () => {
  let tokenUsuarioA, tokenUsuarioB;
  let usuarioAId, usuarioBId;
  let transacaoAId, transacaoBId;

  beforeAll(async () => {
    // Criar usuário A e obter token
    const resA = await request(app).post('/api/usuarios/registro').send({
      nome: 'Usuario A',
      email: 'usuario-a@test.com',
      senha: 'senha123'
    });
    usuarioAId = resA.body.usuario?._id;
    const loginA = await request(app).post('/api/usuarios/login').send({
      email: 'usuario-a@test.com',
      senha: 'senha123'
    });
    tokenUsuarioA = loginA.body.token;

    // Criar usuário B e obter token
    const resB = await request(app).post('/api/usuarios/registro').send({
      nome: 'Usuario B',
      email: 'usuario-b@test.com',
      senha: 'senha123'
    });
    usuarioBId = resB.body.usuario?._id;
    const loginB = await request(app).post('/api/usuarios/login').send({
      email: 'usuario-b@test.com',
      senha: 'senha123'
    });
    tokenUsuarioB = loginB.body.token;

    // Criar transação para A
    const transA = await request(app)
      .post('/api/transacoes')
      .set('Authorization', `Bearer ${tokenUsuarioA}`)
      .send({
        tipo: 'gasto',
        descricao: 'Gasto Usuario A',
        valor: 100,
        data: new Date().toISOString(),
        pagamentos: [{ pessoa: 'Titular', valor: 100, tags: {} }]
      });
    transacaoAId = transA.body._id;

    // Criar transação para B
    const transB = await request(app)
      .post('/api/transacoes')
      .set('Authorization', `Bearer ${tokenUsuarioB}`)
      .send({
        tipo: 'gasto',
        descricao: 'Gasto Usuario B',
        valor: 200,
        data: new Date().toISOString(),
        pagamentos: [{ pessoa: 'Titular', valor: 200, tags: {} }]
      });
    transacaoBId = transB.body._id;
  });

  it('Usuario B não deve ver transação de Usuario A', async () => {
    const res = await request(app)
      .get(`/api/transacoes/${transacaoAId}`)
      .set('Authorization', `Bearer ${tokenUsuarioB}`);
    expect(res.status).toBe(404);
  });

  it('Usuario A não deve ver transação de Usuario B', async () => {
    const res = await request(app)
      .get(`/api/transacoes/${transacaoBId}`)
      .set('Authorization', `Bearer ${tokenUsuarioA}`);
    expect(res.status).toBe(404);
  });

  it('Listagem de transações deve retornar apenas do usuário autenticado', async () => {
    const resA = await request(app)
      .get('/api/transacoes')
      .set('Authorization', `Bearer ${tokenUsuarioA}`);
    const resB = await request(app)
      .get('/api/transacoes')
      .set('Authorization', `Bearer ${tokenUsuarioB}`);

    expect(resA.body.transacoes?.length).toBe(1);
    expect(resB.body.transacoes?.length).toBe(1);
    expect(resA.body.transacoes[0].descricao).toBe('Gasto Usuario A');
    expect(resB.body.transacoes[0].descricao).toBe('Gasto Usuario B');
  });
});
```

---

## Resumo da Auditoria por Modelo

| Modelo | Campo usuario | required | Índice | Queries auditadas |
|--------|---------------|----------|--------|-------------------|
| Transacao | ✅ usuario | ✅ | ✅ | ⚠️ Alguns updates sem usuario |
| Categoria | ✅ usuario | ✅ | ✅ | ⚠️ Pre-save sem usuario |
| Tag | ✅ usuario | ✅ | ✅ | ⚠️ Pre-save sem usuario |
| Importacao | ✅ usuario | ✅ | ✅ | ✅ |
| TransacaoImportada | ✅ usuario | ✅ | ✅ | ✅ |
| Settlement | ✅ usuario | ✅ | ✅ | ✅ |
| ModeloRelatorio | ✅ usuario | ✅ | ✅ | ✅ |
| Instituicao | ✅ usuario | ✅ | ✅ | ✅ |
| Subconta | ✅ usuario | ✅ | ✅ | ⚠️ obterHistorico sem usuario |
| HistoricoSaldo | ✅ usuario | ✅ | ✅ | ⚠️ subcontaController |
| ImportacaoOFX | ✅ usuario | ✅ | ✅ | ✅ |
| TransacaoOFX | ✅ usuario | ✅ | ✅ | ✅ |
| Transferencia | ✅ usuario | ✅ | ✅ | ⚠️ sugerirTransferencias |
| VinculoConjunto | ✅ usuario | ✅ | ✅ | ✅ |
| AcertoConjunto | ✅ usuario | ✅ | ✅ | ⚠️ updateMany em vinculoService |
| Backup | createdBy | ✅ | ✅ | N/A (admin) |
| TaxaCDI | N/A (global) | - | - | OK |

---

## Conclusão

A aplicação possui **isolamento de dados por usuário** na maior parte dos fluxos, com `usuario` presente nos models e na maioria das queries. Os principais pontos de atenção são:

1. **Correções prioritárias:** Ajustar pre-save em Categoria/Tag, incluir `usuario` em updates críticos (estorno de importação, settlement, vinculoService) e em `obterHistorico`.
2. **Defesa em profundidade:** Incluir `usuario` em todas as operações de escrita e leitura de dados sensíveis.
3. **Testes:** Implementar testes de isolamento multi-tenant antes de liberar para múltiplas contas em produção.
4. **Arquitetura:** Avaliar middleware de injeção de `userId` e padrão de repositório para reduzir erros futuros.

Com as correções indicadas e a adoção dos testes sugeridos, o sistema estará em condições adequadas para operação multi-tenant.
