# Conta Fixa UI Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir a UI da feature Conta Fixa (implementada sem nenhum estilo) para usar os padrões visuais reais e já existentes do projeto — modal, blocos de formulário, tabela, badges, ícones e confirmação de exclusão.

**Architecture:** Nenhuma mudança de arquitetura ou backend. Reescreve 3 arquivos de frontend já existentes para reaproveitar componentes/CSS que já existem no projeto (`ModalTransacao`, as classes `.form-grid`/`.form-section`/`.pagamento-item` de `NovaTransacaoForm.css`, `DataTable`, `Badge`, `Swal` + `toast`), em vez do HTML cru sem CSS usado na primeira versão.

**Tech Stack:** React 19, CSS custom (tokens `--cor-*`/`--cg-*`), `sweetalert2`, `react-toastify`, `react-icons/fa`, `@tanstack/react-table` (via `DataTable`).

## Global Constraints

- Não usar `@mui/icons-material` nem `TextField`/`Select` do MUI para campos de formulário — o padrão real do projeto é `<input>`/`<select>` nativos dentro de blocos `.form-section` (ver `src/components/Transaction/NovaTransacaoForm.css`).
- Reaproveitar CSS existente por import, não duplicar regras — `ContaFixaFormModal.js` e `PendenciasContasFixas.js` importam `../../components/Transaction/NovaTransacaoForm.css` para ganhar `.form-grid`/`.form-section`/`.pagamento-item`/`.btn-adicionar-pagamento`/`.form-buttons` de graça (CSS é global no projeto, não scoped/CSS-modules).
- Toda confirmação destrutiva usa `Swal.fire` (import `Swal from 'sweetalert2'`) + `toast` de `react-toastify` para o resultado — nunca `window.confirm`/`window.alert`.
- Ícones de ação em botões de lista usam `react-icons/fa` (`FaEdit`, `FaTrash`, `FaPause`, `FaPlay`, `FaPlus`, `FaCheck`, `FaForward`).
- Backend não é tocado nesta correção — `contaFixaService`, controller, rotas e models continuam exatamente como estão.
- Ao final, validar com screenshot real do navegador (app já roda em `localhost:3004`, há uma Conta Fixa de teste "Teste Aluguel" já cadastrada no banco).

---

### Task 1: Reconstruir `ContaFixaFormModal.js` com o modal e os blocos de formulário reais

**Files:**
- Modify: `controle-gastos-frontend/src/pages/ContasFixas/ContaFixaFormModal.js`

**Interfaces:**
- Consumes: `ModalTransacao` (`src/components/Modal/ModalTransacao.js`, props: `onClose`, `children`), CSS classes de `src/components/Transaction/NovaTransacaoForm.css` (`.form-grid`, `.form-section`, `.pagamentos-section`, `.pagamentos-header`, `.pagamento-item`, `.pagamento-item-header`, `.pagamento-numero`, `.pagamento-item-actions`, `.pagamento-campos-principais`, `.pagamento-field-pessoa`, `.pagamento-field-valor`, `.btn-adicionar-pagamento`, `.form-buttons`, `.error-message`, `.resumo-ok`, `.resumo-diff`), `TagSelector` (já usado, sem mudança de props), `Button` (já usado, sem mudança de props).
- Produces: mesmo componente `ContaFixaFormModal({ contaFixa, onSave, onClose })` — props e comportamento de `onSave`/`onClose` não mudam, só a apresentação visual.

- [ ] **Step 1: Reescrever o componente completo**

Substitua todo o conteúdo de `controle-gastos-frontend/src/pages/ContasFixas/ContaFixaFormModal.js` por:

```js
import React, { useState } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import { useData } from '../../context/DataContext';
import TagSelector from '../../components/Transaction/TagSelector';
import Button from '../../components/shared/Button';
import '../../components/Transaction/NovaTransacaoForm.css';

const valorPadraoPagamento = () => ({ pessoa: '', percentual: 100, tagsOverride: null });

const ContaFixaFormModal = ({ contaFixa, onSave, onClose }) => {
  const { categorias, tags } = useData();
  const [form, setForm] = useState(() => contaFixa || {
    nome: '',
    tipo: 'gasto',
    valorEsperado: '',
    diaLancamento: 1,
    diaVencimento: 1,
    vencimentoMesSeguinte: false,
    modo: 'automatico',
    tagsPadrao: {},
    pagamentosTemplate: [valorPadraoPagamento()],
    dataFim: '',
    totalRepeticoes: ''
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const somaPercentual = form.pagamentosTemplate.reduce((acc, p) => acc + Number(p.percentual || 0), 0);
  const somaOk = Math.abs(somaPercentual - 100) < 0.01;

  const atualizarPagamento = (index, campo, valor) => {
    const novos = [...form.pagamentosTemplate];
    novos[index] = { ...novos[index], [campo]: valor };
    setForm({ ...form, pagamentosTemplate: novos });
  };

  const adicionarPagamento = () => {
    setForm({ ...form, pagamentosTemplate: [...form.pagamentosTemplate, valorPadraoPagamento()] });
  };

  const removerPagamento = (index) => {
    setForm({ ...form, pagamentosTemplate: form.pagamentosTemplate.filter((_, i) => i !== index) });
  };

  const handleSalvar = async () => {
    if (!somaOk) {
      setErro('A soma dos percentuais de divisão deve ser 100%.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSave({
        ...form,
        valorEsperado: Number(form.valorEsperado),
        diaLancamento: Number(form.diaLancamento),
        diaVencimento: Number(form.diaVencimento),
        totalRepeticoes: form.totalRepeticoes ? Number(form.totalRepeticoes) : null,
        dataFim: form.dataFim || null
      });
    } catch (err) {
      setErro(err.message || 'Erro ao salvar conta fixa.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalTransacao onClose={onClose}>
      <h2 className="nova-transacao-form-title">{contaFixa ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}</h2>

      {erro && <p className="error-message">{erro}</p>}

      <div className="form-grid">
        <div className="form-section">
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>

        <div className="form-section">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="gasto">Despesa</option>
            <option value="recebivel">Receita</option>
          </select>
        </div>

        <div className="form-section">
          <label>Valor esperado</label>
          <input
            type="number"
            step="0.01"
            value={form.valorEsperado}
            onChange={(e) => setForm({ ...form, valorEsperado: e.target.value })}
          />
        </div>

        <div className="form-section">
          <label>Modo</label>
          <select value={form.modo} onChange={(e) => setForm({ ...form, modo: e.target.value })}>
            <option value="automatico">Automático (lança sozinho)</option>
            <option value="confirmacao">Confirmação manual</option>
          </select>
        </div>

        <div className="form-section">
          <label>Dia de lançamento</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.diaLancamento}
            onChange={(e) => setForm({ ...form, diaLancamento: e.target.value })}
          />
        </div>

        <div className="form-section">
          <label>Dia de vencimento</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.diaVencimento}
            onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })}
          />
        </div>

        <div className="form-section">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={{ width: 'auto', marginBottom: 0 }}
              checked={form.vencimentoMesSeguinte}
              onChange={(e) => setForm({ ...form, vencimentoMesSeguinte: e.target.checked })}
            />
            Vencimento cai no mês seguinte
          </label>
        </div>

        <div className="form-section">
          <label>Data fim (opcional)</label>
          <input type="date" value={form.dataFim || ''} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} />
        </div>

        <div className="form-section">
          <label>Total de repetições (opcional)</label>
          <input
            type="number"
            min="1"
            value={form.totalRepeticoes || ''}
            onChange={(e) => setForm({ ...form, totalRepeticoes: e.target.value })}
          />
        </div>

        <div className="form-section pagamentos-section">
          <div className="pagamentos-header">
            <h3>Divisão de pagamento</h3>
            <span className={somaOk ? 'resumo-ok' : 'resumo-diff'}>Soma atual: {somaPercentual}%</span>
          </div>

          {form.pagamentosTemplate.map((p, index) => (
            <div className="pagamento-item" key={index}>
              <div className="pagamento-item-header">
                <span className="pagamento-numero">Pagamento {index + 1}</span>
                {form.pagamentosTemplate.length > 1 && (
                  <div className="pagamento-item-actions">
                    <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => removerPagamento(index)}>
                      <FaTrash /> Remover
                    </button>
                  </div>
                )}
              </div>
              <div className="pagamento-campos-principais">
                <div className="form-section pagamento-field-pessoa">
                  <label>Pessoa</label>
                  <input value={p.pessoa} onChange={(e) => atualizarPagamento(index, 'pessoa', e.target.value)} />
                </div>
                <div className="form-section pagamento-field-valor">
                  <label>%</label>
                  <input
                    type="number"
                    value={p.percentual}
                    onChange={(e) => atualizarPagamento(index, 'percentual', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="btn-adicionar-pagamento" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={adicionarPagamento}>
            <FaPlus /> Adicionar pessoa
          </button>
        </div>

        <div className="form-section pagamentos-section">
          <h3>Categoria/tags padrão</h3>
          <TagSelector
            categorias={categorias}
            allTags={tags}
            paymentTags={form.tagsPadrao}
            onTagsChange={(novasTags) => setForm({ ...form, tagsPadrao: novasTags })}
          />
        </div>
      </div>

      <div className="form-buttons">
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" onClick={handleSalvar} loading={salvando}>Salvar</Button>
      </div>
    </ModalTransacao>
  );
};

export default ContaFixaFormModal;
```

- [ ] **Step 2: Verificar lint**

Run: `cd controle-gastos-frontend && npx eslint src/pages/ContasFixas/ContaFixaFormModal.js`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/pages/ContasFixas/ContaFixaFormModal.js
git commit -m "fix(conta-fixa): usa modal e blocos de formulario reais no lugar de HTML sem estilo"
```

---

### Task 2: Reconstruir `ContasFixas.js` com `DataTable`, `Badge` e `Swal`/`toast`

**Files:**
- Modify: `controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js`

**Interfaces:**
- Consumes: `DataTable` (`src/components/shared/DataTable.js`, props: `columns`, `rows`, `renderCell`, `variant`, `emptyMessage`), `Badge` (`src/components/shared/Badge.js`, prop `variant`: `default|success|error|warning|info|glass`), `Swal` (`sweetalert2`), `toast` (`react-toastify`), `Button`/`Card`/`SectionHeader` (já em uso, sem mudança).
- Produces: mesmo componente `ContasFixas` — comportamento de CRUD idêntico, só a apresentação (tabela, confirmação, feedback) muda.

- [ ] **Step 1: Reescrever o componente completo**

Substitua todo o conteúdo de `controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js` por:

```js
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaPause, FaPlay, FaTrash, FaPlus } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import contaFixaApi from '../../services/contaFixaApi';
import ContaFixaFormModal from './ContaFixaFormModal';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import Badge from '../../components/shared/Badge';
import DataTable from '../../components/shared/DataTable';
import { formatarMoeda } from '../../utils/format';

const STATUS_BADGE = {
  ativa: { variant: 'success', label: 'Ativa' },
  pausada: { variant: 'warning', label: 'Pausada' },
  encerrada: { variant: 'default', label: 'Encerrada' }
};

const COLUNAS = [
  { key: 'nome', label: 'Nome' },
  { key: 'tipo', label: 'Tipo', width: 100 },
  { key: 'valorEsperado', label: 'Valor esperado', align: 'right', width: 140 },
  { key: 'dias', label: 'Dias (lanç. / venc.)', width: 150 },
  { key: 'modo', label: 'Modo', width: 130 },
  { key: 'status', label: 'Status', width: 110 },
  { key: 'acoes', label: 'Ações', width: 220 }
];

const ContasFixas = () => {
  const navigate = useNavigate();
  const [contasFixas, setContasFixas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaFixaEditando, setContaFixaEditando] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await contaFixaApi.listar();
      setContasFixas(dados);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNova = () => {
    setContaFixaEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (contaFixa) => {
    setContaFixaEditando(contaFixa);
    setModalAberto(true);
  };

  const handleSalvar = async (dados) => {
    if (contaFixaEditando) {
      await contaFixaApi.atualizar(contaFixaEditando._id, dados);
      toast.success('Conta fixa atualizada.');
    } else {
      await contaFixaApi.criar(dados);
      toast.success('Conta fixa criada.');
    }
    setModalAberto(false);
    await carregar();
  };

  const handlePausarOuReativar = async (contaFixa) => {
    try {
      if (contaFixa.status === 'pausada') {
        await contaFixaApi.reativar(contaFixa._id);
        toast.success('Conta fixa reativada.');
      } else {
        await contaFixaApi.pausar(contaFixa._id);
        toast.success('Conta fixa pausada.');
      }
      await carregar();
    } catch (err) {
      toast.error('Erro ao atualizar conta fixa.');
    }
  };

  const handleExcluir = async (contaFixa) => {
    const result = await Swal.fire({
      title: `Excluir "${contaFixa.nome}"?`,
      text: 'Isso não afeta transações já geradas por essa regra.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    try {
      await contaFixaApi.excluir(contaFixa._id);
      toast.success('Conta fixa excluída.');
      await carregar();
    } catch (err) {
      toast.error('Erro ao excluir conta fixa.');
    }
  };

  const renderCell = (row, col) => {
    switch (col.key) {
      case 'tipo':
        return row.tipo === 'gasto' ? 'Despesa' : 'Receita';
      case 'valorEsperado':
        return formatarMoeda(row.valorEsperado);
      case 'dias':
        return `${row.diaLancamento} / ${row.diaVencimento}`;
      case 'modo':
        return row.modo === 'automatico' ? 'Automático' : 'Confirmação';
      case 'status': {
        const badge = STATUS_BADGE[row.status] || STATUS_BADGE.encerrada;
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      }
      case 'acoes':
        return (
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button variant="ghost" size="sm" startIcon={<FaEdit />} onClick={() => abrirEdicao(row)}>Editar</Button>
            <Button
              variant="ghost"
              size="sm"
              startIcon={row.status === 'pausada' ? <FaPlay /> : <FaPause />}
              onClick={() => handlePausarOuReativar(row)}
            >
              {row.status === 'pausada' ? 'Reativar' : 'Pausar'}
            </Button>
            <Button variant="ghost" size="sm" startIcon={<FaTrash />} onClick={() => handleExcluir(row)}>Excluir</Button>
          </div>
        );
      default:
        return row[col.key];
    }
  };

  return (
    <div className="contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <SectionHeader
            title="Contas Fixas"
            subtitle="Lançamentos recorrentes mensais"
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" onClick={() => navigate('/contas-fixas/pendencias')}>Ver pendências</Button>
                <Button variant="primary" startIcon={<FaPlus />} onClick={abrirNova}>Nova Conta Fixa</Button>
              </div>
            }
          />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : (
            <DataTable
              columns={COLUNAS}
              rows={contasFixas}
              renderCell={renderCell}
              variant="glass"
              emptyMessage="Nenhuma conta fixa cadastrada ainda."
            />
          )}
        </CardContent>
      </Card>

      {modalAberto && (
        <ContaFixaFormModal
          contaFixa={contaFixaEditando}
          onSave={handleSalvar}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
};

export default ContasFixas;
```

- [ ] **Step 2: Verificar lint**

Run: `cd controle-gastos-frontend && npx eslint src/pages/ContasFixas/ContasFixas.js`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js
git commit -m "fix(conta-fixa): troca tabela crua por DataTable, Badge de status e Swal/toast"
```

---

### Task 3: Reconstruir `PendenciasContasFixas.js` com linhas em card e feedback via toast

**Files:**
- Modify: `controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js`

**Interfaces:**
- Consumes: classes `.pagamento-item`/`.pagamento-item-header`/`.pagamento-numero`/`.pagamento-campos-principais`/`.pagamento-field-valor`/`.parcela-valor-info` de `NovaTransacaoForm.css` (mesmo import da Task 1), `toast` (`react-toastify`), `EmptyState`/`Button`/`Card`/`SectionHeader` (já em uso).
- Produces: mesmo componente `PendenciasContasFixas` — comportamento idêntico, apresentação em cards em vez de `div` cru.

- [ ] **Step 1: Reescrever o componente completo**

Substitua todo o conteúdo de `controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js` por:

```js
import React, { useEffect, useState, useCallback } from 'react';
import { FaCheck, FaForward } from 'react-icons/fa';
import { toast } from 'react-toastify';
import contaFixaApi from '../../services/contaFixaApi';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { formatarMoeda } from '../../utils/format';
import '../../components/Transaction/NovaTransacaoForm.css';
import './PendenciasContasFixas.css';

const PendenciasContasFixas = () => {
  const [pendencias, setPendencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [valoresEditados, setValoresEditados] = useState({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await contaFixaApi.listarPendencias();
      setPendencias(dados);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleConfirmar = async (pendencia) => {
    const valorEditado = valoresEditados[pendencia.contaFixa._id];
    try {
      await contaFixaApi.confirmar(pendencia.contaFixa._id, {
        valor: valorEditado ? Number(valorEditado) : undefined
      });
      toast.success(`"${pendencia.contaFixa.nome}" confirmada e lançada.`);
      await carregar();
    } catch (err) {
      toast.error('Erro ao confirmar lançamento.');
    }
  };

  const handlePular = async (pendencia) => {
    try {
      await contaFixaApi.pular(pendencia.contaFixa._id);
      toast.info(`"${pendencia.contaFixa.nome}" pulada este mês.`);
      await carregar();
    } catch (err) {
      toast.error('Erro ao pular este mês.');
    }
  };

  return (
    <div className="pendencias-contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <SectionHeader title="Contas Fixas Pendentes" subtitle="Revise e confirme os lançamentos deste mês" />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : pendencias.length === 0 ? (
            <EmptyState message="Nenhuma conta fixa pendente de confirmação." />
          ) : (
            pendencias.map((p) => (
              <div key={p.contaFixa._id} className="pagamento-item">
                <div className="pagamento-item-header">
                  <span className="pagamento-numero">{p.contaFixa.nome}</span>
                  <span className="parcela-valor-info">
                    Vencimento: {new Date(p.ciclo.dataVencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="pagamento-campos-principais">
                  <div className="form-section pagamento-field-valor">
                    <label>Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={p.contaFixa.valorEsperado}
                      placeholder={formatarMoeda(p.contaFixa.valorEsperado)}
                      onChange={(e) => setValoresEditados({ ...valoresEditados, [p.contaFixa._id]: e.target.value })}
                    />
                  </div>
                  <div className="pendencia-item__acoes">
                    <Button variant="ghost" size="sm" startIcon={<FaForward />} onClick={() => handlePular(p)}>Pular este mês</Button>
                    <Button variant="primary" size="sm" startIcon={<FaCheck />} onClick={() => handleConfirmar(p)}>Confirmar lançamento</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PendenciasContasFixas;
```

- [ ] **Step 2: Criar o CSS pequeno que falta**

```css
/* controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.css */
.pendencias-contas-fixas-page {
  padding: 16px;
}

.pendencia-item__acoes {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-left: auto;
}
```

- [ ] **Step 3: Verificar lint**

Run: `cd controle-gastos-frontend && npx eslint src/pages/ContasFixas/PendenciasContasFixas.js`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.js controle-gastos-frontend/src/pages/ContasFixas/PendenciasContasFixas.css
git commit -m "fix(conta-fixa): usa card real e toast de feedback na tela de pendencias"
```

---

### Task 4: Adicionar CSS de wrapper da página de listagem

**Files:**
- Create: `controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.css`
- Modify: `controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js`

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: classe `.contas-fixas-page` com padding, consistente com o wrapper de outras páginas do projeto (ex: `Tags.css`).

- [ ] **Step 1: Criar o CSS**

```css
/* controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.css */
.contas-fixas-page {
  padding: 16px;
}
```

- [ ] **Step 2: Importar no componente**

Em `controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js`, adicione junto aos outros imports:

```js
import './ContasFixas.css';
```

- [ ] **Step 3: Commit**

```bash
git add controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.css controle-gastos-frontend/src/pages/ContasFixas/ContasFixas.js
git commit -m "fix(conta-fixa): adiciona padding de wrapper na pagina de listagem"
```

---

### Task 5: Verificação visual real no navegador

**Files:** nenhum (só verificação).

- [ ] **Step 1: Abrir a tela de listagem e tirar screenshot**

Navegue para `http://localhost:3004/contas-fixas` (app já rodando, usuário já logado na sessão de navegador ativa) e capture o estado visual. Confirme: linhas em formato card (`DataTable`), badge de status colorido, ícones nos botões de ação.

- [ ] **Step 2: Abrir o modal de nova/editar conta fixa e tirar screenshot**

Clique em "Nova Conta Fixa". Confirme: overlay escuro cobrindo a tela, modal com fundo/borda/sombra corretos, botão X circular no canto, campos agrupados em blocos com fundo diferenciado, botão "Adicionar pessoa" com borda tracejada, footer com botões "Cancelar"/"Salvar" estilizados.

- [ ] **Step 3: Testar exclusão e confirmar o Swal**

Clique em "Excluir" numa conta fixa de teste. Confirme: aparece o popup do SweetAlert2 (não o `confirm()` nativo do navegador), e ao confirmar aparece um toast de sucesso no canto da tela (não um alert nativo).

- [ ] **Step 4: Abrir a tela de pendências e tirar screenshot**

Navegue para `http://localhost:3004/contas-fixas/pendencias` (crie uma pendência antes, se necessário, via Task 8 do plano anterior). Confirme: item de pendência em card com borda esquerda de destaque, campo de valor e botões alinhados.

- [ ] **Step 5: Reportar ao usuário**

Envie os screenshots capturados nos steps 1, 2 e 4 como evidência, junto com a confirmação verbal do comportamento do Swal/toast do Step 3.
