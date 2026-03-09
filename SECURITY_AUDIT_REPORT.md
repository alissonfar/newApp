# Relatório de Auditoria de Segurança e Isolamento de Dados

**Sistema:** Controle de Gastos (Multi-tenant)  
**Data da Auditoria:** Março 2025  
**Escopo:** Backend Node.js / Express / MongoDB / Mongoose

---

## 1. Resumo Executivo

Esta auditoria foi realizada para garantir que **não existe nenhuma possibilidade** de um usuário acessar, modificar ou visualizar dados de outro usuário no sistema de Controle de Gastos, que está em transição de uso single-user para multi-user.

### Contagem de Vulnerabilidades por Severidade

| Severidade | Quantidade | Descrição |
|------------|------------|-----------|
| **CRÍTICO** | 2 | Permitem acesso cross-user ou escalação de privilégios |
| **ALTO** | 12 | Queries sem filtro de usuário em operações sensíveis |
| **MÉDIO** | 8 | Defesa em profundidade ausente, riscos indiretos |
| **BAIXO** | 4 | Melhorias de consistência e índices |

### Conclusão do Resumo

O sistema possui uma base sólida de isolamento multi-tenant com o campo `usuario` presente na maioria das entidades. Porém, foram identificadas **vulnerabilidades críticas** (mass assignment e validação de importação) e diversas **queries sem filtro de usuário** em serviços e controllers que podem permitir vazamento ou manipulação de dados entre usuários em cenários específicos. A correção deve priorizar as vulnerabilidades críticas e altas antes da abertura para múltiplos usuários.

---

## 2. Vulnerabilidades Críticas

### 2.1 Mass Assignment em Atualização de Perfil

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/controllers/controladorUsuario.js` |
| **Função** | `atualizarPerfil` (linhas 279-304) |
| **Rota** | `PUT /api/usuarios/perfil` |
| **Severidade** | CRÍTICO |
| **Risco** | Escalação de privilégios: usuário pode enviar `{ role: 'admin', status: 'ativo' }` e alterar seus próprios campos sensíveis |

**Código vulnerável:**
```javascript
const atualizacoes = { ...req.body };
delete atualizacoes.senha;
delete atualizacoes.email;
const usuario = await Usuario.findByIdAndUpdate(req.userId, { $set: atualizacoes }, { new: true });
```

**Recomendação:** Usar whitelist explícita de campos permitidos: `nome`, `fotoPerfil`, `telefone`, `dataNascimento`, `genero`, `biografia`, `cargo`, `empresa`, `redesSociais`, `preferencias`. Excluir explicitamente `role`, `status`, `usuario`, `email`, `senha`, `tokenVerificacao`, etc.

---

### 2.2 ImportacaoService.processarArquivo sem Validação de Usuário

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/importacaoService.js` |
| **Função** | `processarArquivo` (estático, linha 413) |
| **Chamador** | `importacaoController.criar` (linha 68) |
| **Severidade** | CRÍTICO |
| **Risco** | Se houver qualquer forma de invocar `processarArquivo` com `importacaoId` de outro usuário (ex: race condition, bug em outra rota, job assíncrono mal configurado), transações seriam criadas com `usuario` da importação de outro usuário |

**Código vulnerável:**
```javascript
static async processarArquivo(importacaoId) {
  const importacao = await Importacao.findById(importacaoId);  // SEM usuario
  if (!importacao) throw new Error('Importação não encontrada');
  // ... processa e cria TransacaoImportada com importacao.usuario
}
```

**Contexto:** O controller cria a importação com `usuario: req.userId` e chama `processarArquivo(importacao._id)` de forma assíncrona (`.then(...).catch(...)`). O `importacaoId` vem da importação recém-criada, mas não há validação no fluxo assíncrono.

**Recomendação:** Alterar assinatura para `processarArquivo(importacaoId, usuarioId)` e validar `Importacao.findOne({ _id: importacaoId, usuario: usuarioId })` no início. Se não encontrar, abortar.

---

## 3. Vulnerabilidades Altas

### 3.1 Categoria e Tag - Índice e Pre-save sem Usuário

| Campo | Valor |
|-------|-------|
| **Arquivos** | `backend/src/models/categoria.js`, `backend/src/models/tag.js` |
| **Problema** | `codigo: { unique: true }` no schema (global); `findOne({ codigo })` no pre-save sem `usuario` |
| **Severidade** | ALTO |
| **Risco** | (1) Dois usuários não podem ter categorias/tags com mesmo código (impede multi-tenant); (2) Pre-save pode colidir com documento de outro usuário |

**Código vulnerável (categoria.js):**
```javascript
codigo: { type: String, required: true, unique: true, ... }
// ...
const existente = await this.constructor.findOne({ codigo: this.codigo });  // sem usuario
```

**Recomendação:** Remover `unique: true` do campo `codigo`; criar índice composto `{ usuario: 1, codigo: 1 }` unique. No pre-save: `findOne({ codigo: this.codigo, usuario: this.usuario })`.

---

### 3.2 TransacaoImportada.updateOne sem usuario (finalizarImportacao)

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/controllers/importacaoController.js` |
| **Função** | `finalizarImportacao` (linha 399) |
| **Query** | `TransacaoImportada.updateOne({ _id: ti._id }, ...)` |
| **Severidade** | ALTO |
| **Risco** | `ti` vem do mapeamento da importação do usuário; se houver bug na cadeia, update poderia afetar documento de outro usuário |

**Recomendação:** Incluir `usuario: req.userId` no filter: `updateOne({ _id: ti._id, usuario: req.userId }, ...)`.

---

### 3.3 Transacao.updateOne sem usuario (estornarImportacao)

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/controllers/importacaoController.js` |
| **Função** | `estornarImportacao` (linhas 488, 511) |
| **Queries** | `Transacao.updateOne({ _id: transacaoImportada.transacaoCriada, status: 'ativo' }, ...)` e `TransacaoImportada.updateMany({ importacao: importacao._id, status: 'processada' }, ...)` |
| **Severidade** | ALTO |
| **Risco** | Transação e TransacaoImportada podem ser de outro usuário se houver inconsistência na importação |

**Recomendação:** Incluir `usuario: req.userId` em ambos os filters. Para TransacaoImportada: `usuario: importacao.usuario` ou `req.userId` (importação já validada com usuario).

---

### 3.4 TransacaoImportada.updateOne sem usuario (acoesMassa)

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/controllers/transacaoImportadaController.js` |
| **Função** | `acoesMassa` (linha 377) |
| **Query** | `TransacaoImportada.updateOne({ _id: transacao._id }, ...)` |
| **Severidade** | ALTO |
| **Risco** | `transacao` vem de `find({ _id: { $in: ids }, usuario: usuarioId })`, mas o update não reforça o filtro |

**Recomendação:** `updateOne({ _id: transacao._id, usuario: usuarioId }, ...)`.

---

### 3.5 Transacao.updateMany e AcertoConjunto.deleteOne (vinculoService)

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/vinculoService.js` |
| **Funções** | `registrarAcerto` (linha 350), `estornarAcerto` (linhas 377, 383) |
| **Queries** | `Transacao.updateMany({ _id: { $in: transacoesQuitadas } }, ...)`, `AcertoConjunto.deleteOne({ _id: acertoId }, ...)` |
| **Severidade** | ALTO |
| **Risco** | Acerto e transações vêm de vinculo validado com usuario; porém defesa em profundidade ausente |

**Recomendação:** Incluir `usuario: usuarioId` em todos os filters. Para Transacao: `{ _id: { $in: transacoesQuitadas }, usuario: usuarioId }`. Para AcertoConjunto: `{ _id: acertoId, usuario: usuarioId }`.

---

### 3.6 SettlementService - Transacao e Settlement sem usuario

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/settlementService.js` |
| **Funções** | `criar` (linhas 357, 387), `excluir` (linhas 436, 445, 478, 483, 490, 501, 508) |
| **Queries** | `Transacao.updateOne({ _id: ... })`, `Transacao.findById(...)`, `Tag.findById(...)`, `Settlement.updateOne`, `Settlement.deleteOne` |
| **Severidade** | ALTO |
| **Risco** | Settlement é validado com `findOne({ _id, usuario })` antes; IDs vêm do settlement. Porém, todas as operações em Transacao, Tag e Settlement não incluem usuario no filter |

**Recomendação:** Incluir `usuario: usuarioId` em todos os updateOne, deleteOne e findById (usar findOne com usuario). Settlement já validado; Transacao e Tag devem ser filtrados por usuario quando aplicável.

---

### 3.7 ImportacaoService - Importacao.findById em Múltiplos Pontos

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/importacaoService.js` |
| **Linhas** | 180, 199, 238, 278, 416, 574 |
| **Funções** | `processarArquivoJSON`, `processarArquivoCSV`, `processarArquivo`, `duplicarImportacao` (catch) |
| **Severidade** | ALTO |
| **Risco** | Qualquer chamada com importacaoId incorreto pode acessar importação de outro usuário |

**Recomendação:** Substituir `Importacao.findById(importacaoId)` por `Importacao.findOne({ _id: importacaoId, usuario: usuarioId })` em todos os pontos. Garantir que `usuarioId` seja passado para todas as funções.

---

## 4. Problemas Estruturais

### 4.1 movimentacaoInternaService.sugerirTransferencias

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/movimentacaoInternaService.js` |
| **Função** | `sugerirTransferencias` (linha 46) |
| **Query** | `Transferencia.find({ $or: [{ subcontaOrigem: subcontaId }, { subcontaDestino: subcontaId }], status: 'pendente', ... })` |
| **Severidade** | MÉDIO |
| **Risco** | subcontaId vem de TransacaoOFX validada com usuario; em teoria subconta é única. Porém, sem filtro `usuario`, em caso de dados inconsistentes poderia retornar transferências de outro usuário |

**Recomendação:** Alterar assinatura para `sugerirTransferencias(subcontaId, usuarioId, valor, data, opts)` e incluir `usuario: usuarioId` no filter.

---

### 4.2 ledgerService - calcularSaldoPorLedger e existeEventoParaReferencia

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/ledgerService.js` |
| **Funções** | `calcularSaldoPorLedger` (linha 88), `existeEventoParaReferencia` (linha 106) |
| **Queries** | `aggregate([{ $match: { subconta: subcontaId } }])`, `findOne({ referenciaTipo, referenciaId })` |
| **Severidade** | MÉDIO |
| **Risco** | Quem chama valida subconta/referência; porém defesa em profundidade ausente. Ledger é sensível |

**Recomendação:** Incluir `usuario` no match quando o ledger tiver relação com usuário. Para `calcularSaldoPorLedger`, receber `usuarioId` e usar `$match: { subconta: subcontaId, usuario: usuarioId }`. Para `existeEventoParaReferencia`, considerar adicionar `usuarioId` se a referência for por usuário.

---

### 4.3 TransacaoImportada.findById e ModeloRelatorio.findById

| Campo | Valor |
|-------|-------|
| **Arquivos** | `backend/src/controllers/transacaoImportadaController.js` (linha 177), `backend/src/controllers/controladorModeloRelatorio.js` (linhas 46, 70) |
| **Problema** | `findById(id)` após `findOne({ _id, usuario })` - não reforça o filtro |
| **Severidade** | MÉDIO |
| **Risco** | Baixo (documento já validado), mas defesa em profundidade recomendada |

**Recomendação:** Substituir por `findOne({ _id: id, usuario: req.userId })` ou usar helper `secureFindById`.

---

### 4.4 importacaoOFXService - deleteMany/deleteOne no catch

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/importacaoOFXService.js` |
| **Linhas** | 233-234 |
| **Código** | `TransacaoOFX.deleteMany({ importacaoOFX: importacao._id })`, `ImportacaoOFX.deleteOne({ _id: importacao._id })` |
| **Severidade** | MÉDIO |
| **Risco** | importacao é recém-criada com usuarioId; em caso de erro no processamento, rollback. Incluir usuario reforça segurança |

**Recomendação:** Incluir `usuario: usuarioId` nos filters do catch.

---

## 5. Índices de Banco Incorretos

### 5.1 Categoria - codigo unique global

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/models/categoria.js` |
| **Problema** | `codigo: { unique: true }` no schema |
| **Impacto** | Impede dois usuários de terem categorias com mesmo código; viola isolamento multi-tenant |
| **Correção** | Remover unique do schema; criar `CategoriaSchema.index({ usuario: 1, codigo: 1 }, { unique: true })` |

---

### 5.2 Tag - codigo unique global

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/models/tag.js` |
| **Problema** | `codigo: { unique: true }` no schema |
| **Impacto** | Mesmo que Categoria |
| **Correção** | Remover unique do schema; criar `TagSchema.index({ usuario: 1, codigo: 1 }, { unique: true })` |

---

### 5.3 Subconta - instituicao sem usuario

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/models/subconta.js` |
| **Problema** | `SubcontaSchema.index({ instituicao: 1 })` sem usuario |
| **Impacto** | Queries que filtram apenas por instituicao podem misturar dados de usuários (se usadas incorretamente) |
| **Correção** | Avaliar se o índice é necessário; se sim, usar `{ usuario: 1, instituicao: 1 }` composto |

---

### 5.4 Índices Corretos (Referência)

Os seguintes modelos possuem índices corretos com `usuario`:
- **Instituicao:** `{ usuario: 1 }`, `{ usuario: 1, nome: 1 }` unique
- **Subconta:** `{ usuario: 1 }`, `{ usuario: 1, instituicao: 1, nome: 1 }` unique
- **VinculoConjunto:** `{ usuario: 1, nome: 1 }` unique
- **Categoria/Tag:** `{ nome: 1, usuario: 1 }` unique (correto para nome; codigo está incorreto)

---

## 6. Melhorias Recomendadas

### 6.1 Rota de Email de Teste

| Campo | Valor |
|-------|-------|
| **Rota** | `POST /api/email/teste` |
| **Arquivo** | `backend/src/routes/emailRoutes.js` |
| **Problema** | Sem autenticação; qualquer um pode enviar email de teste |
| **Recomendação** | Proteger com middleware `autenticacao` ou remover em produção |

---

### 6.2 Validação de Importação em listarTransacoes

| Campo | Valor |
|-------|-------|
| **Rota** | `GET /api/importacoes/:importacaoId/transacoes` |
| **Problema** | Query usa `{ importacao: importacaoId, usuario: req.userId }`; se importação for de outro usuário, retorna vazio (não 404) |
| **Recomendação** | Validar que a importação existe e pertence ao usuário antes; retornar 404 quando não pertencer |

---

### 6.3 Rotas Públicas (OK)

As rotas de registro, login, verificação de email, recuperação de senha e redefinição de senha são corretamente públicas. Rotas admin usam `autenticacao` + `isAdmin`.

---

### 6.4 Validar Referências Cruzadas em Transferências

O `transferenciaController.criar` já valida que `subcontaOrigemId` e `subcontaDestinoId` pertencem ao usuário com `Subconta.findOne({ _id, usuario: req.userId })`. **OK.**

---

## 7. Checklist de Correções

### Prioridade 1 - Críticas (fazer antes de multi-user)

- [ ] **Mass assignment:** Corrigir `atualizarPerfil` com whitelist de campos
- [ ] **ImportacaoService:** Validar `usuario` em `processarArquivo` e todos os `findById`

### Prioridade 2 - Altas

- [ ] **Categoria/Tag:** Remover `unique: true` de codigo; criar índice `{ usuario, codigo }` unique; corrigir pre-save
- [ ] **importacaoController:** Incluir `usuario` em updateOne/updateMany (finalizarImportacao, estornarImportacao)
- [ ] **transacaoImportadaController:** Incluir `usuario` em updateOne e substituir findById por findOne com usuario
- [ ] **vinculoService:** Incluir `usuario` em Transacao.updateMany e AcertoConjunto.deleteOne
- [ ] **settlementService:** Incluir `usuario` em Transacao.updateOne, findById, bulkWrite, Settlement.deleteOne
- [ ] **importacaoService:** Substituir todos os `Importacao.findById` por `findOne({ _id, usuario })`

### Prioridade 3 - Médias

- [ ] **movimentacaoInternaService:** Incluir `usuario` em sugerirTransferencias
- [ ] **ledgerService:** Incluir `usuario` em calcularSaldoPorLedger e existeEventoParaReferencia

### Prioridade 4 - Índices e Defesa em Profundidade

- [ ] **Migração de índices:** Categoria e Tag - remover unique global de codigo; criar índices compostos
- [ ] **Subconta:** Avaliar índice { instituicao: 1 }
- [ ] **importacaoOFXService:** Incluir usuario no catch (deleteMany/deleteOne)
- [ ] **controladorModeloRelatorio:** Substituir findById por findOne com usuario

### Prioridade 5 - Melhorias

- [ ] **email/teste:** Proteger ou remover
- [ ] **listarTransacoes:** Retornar 404 quando importação não for do usuário

---

## 8. Padrões Estruturais Sugeridos

### 8.1 BaseRepository com Filtro Automático por Usuário

Criar uma classe base que injeta `usuario` em todas as operações:

```javascript
// backend/src/repositories/BaseRepository.js
class BaseRepository {
  constructor(Model, usuarioField = 'usuario') {
    this.Model = Model;
    this.usuarioField = usuarioField;
  }
  findById(id, usuarioId) {
    return this.Model.findOne({ _id: id, [this.usuarioField]: usuarioId });
  }
  find(filter, usuarioId) {
    return this.Model.find({ ...filter, [this.usuarioField]: usuarioId });
  }
  updateOne(filter, update, usuarioId) {
    return this.Model.updateOne({ ...filter, [this.usuarioField]: usuarioId }, update);
  }
  // ...
}
```

### 8.2 Middleware de Validação de Ownership

```javascript
// backend/src/middlewares/validateOwnership.js
function validateOwnership(Model, paramName = 'id') {
  return async (req, res, next) => {
    const doc = await Model.findOne({ _id: req.params[paramName], usuario: req.userId });
    if (!doc) return res.status(404).json({ erro: 'Recurso não encontrado.' });
    req.ownedDoc = doc;
    next();
  };
}
```

### 8.3 Helper secureFindById

```javascript
// backend/src/utils/secureFind.js
async function secureFindById(Model, id, usuarioId, usuarioField = 'usuario') {
  const doc = await Model.findOne({ _id: id, [usuarioField]: usuarioId });
  if (!doc) throw new Error('Recurso não encontrado.');
  return doc;
}
```

### 8.4 Whitelist de Campos

```javascript
// Exemplo para atualizarPerfil
const CAMPOS_PERMITIDOS = ['nome', 'fotoPerfil', 'telefone', 'dataNascimento', 'genero', 'biografia', 'cargo', 'empresa', 'redesSociais', 'preferencias'];
const atualizacoes = {};
for (const campo of CAMPOS_PERMITIDOS) {
  if (req.body[campo] !== undefined) atualizacoes[campo] = req.body[campo];
}
await Usuario.findByIdAndUpdate(req.userId, { $set: atualizacoes }, { new: true });
```

### 8.5 Migração de Índices

Antes de alterar os modelos Categoria e Tag:

1. Criar script de migração que:
   - Remove índice único em `codigo` (se existir)
   - Cria índice `{ usuario: 1, codigo: 1 }` unique
2. Executar em ambiente de teste
3. Validar que não há duplicatas de (usuario, codigo) antes de criar índice unique

---

## 9. Relacionamentos Entre Entidades - Validação

### 9.1 Transferências

O `transferenciaController.criar` valida corretamente que `subcontaOrigemId` e `subcontaDestinoId` pertencem ao usuário antes de criar a transferência. **OK.**

### 9.2 Settlement

O settlement referencia `receivingTransactionId`, `appliedTransactions`, `tagId`, `removeTagId`, `leftoverTransactionId`. O controller passa `req.userId` para o service. O service valida o settlement com `findOne({ _id, usuario })` antes de excluir. As transações referenciadas vêm do settlement. **Recomendação:** Incluir usuario em todas as operações em Transacao/Tag para defesa em profundidade.

### 9.3 VinculoConjunto e AcertoConjunto

O vinculo é validado com `findOne({ _id, usuario })`. As transações quitadas vêm da query que já filtra por usuario. **Recomendação:** Incluir usuario nos updateMany e deleteOne.

### 9.4 Importação OFX

O controller valida `ImportacaoOFX` e `TransacaoOFX` com `usuario: req.userId`. Ao vincular `transferenciaId`, valida com `Transferencia.updateOne({ _id: transferenciaId, usuario: req.userId })`. **OK.**

---

## 10. Resumo de Arquivos Afetados

| Arquivo | Vulnerabilidades |
|---------|------------------|
| `backend/src/controllers/controladorUsuario.js` | Mass assignment (CRÍTICO) |
| `backend/src/services/importacaoService.js` | findById sem usuario (CRÍTICO/ALTO) |
| `backend/src/models/categoria.js` | codigo unique global, pre-save (ALTO) |
| `backend/src/models/tag.js` | codigo unique global, pre-save (ALTO) |
| `backend/src/controllers/importacaoController.js` | updateOne/updateMany sem usuario (ALTO) |
| `backend/src/controllers/transacaoImportadaController.js` | updateOne, findById (ALTO/MÉDIO) |
| `backend/src/services/settlementService.js` | Transacao/Settlement sem usuario (ALTO) |
| `backend/src/services/vinculoService.js` | Transacao/AcertoConjunto sem usuario (ALTO) |
| `backend/src/services/movimentacaoInternaService.js` | Transferencia.find sem usuario (MÉDIO) |
| `backend/src/services/ledgerService.js` | aggregate, findOne sem usuario (MÉDIO) |
| `backend/src/services/importacaoOFXService.js` | deleteMany/deleteOne no catch (MÉDIO) |
| `backend/src/controllers/controladorModeloRelatorio.js` | findById (MÉDIO) |
| `backend/src/models/subconta.js` | índice instituicao (BAIXO) |
| `backend/src/routes/emailRoutes.js` | rota teste sem auth (BAIXO) |

---

*Relatório gerado conforme auditoria solicitada. Nenhuma alteração de código foi realizada.*
