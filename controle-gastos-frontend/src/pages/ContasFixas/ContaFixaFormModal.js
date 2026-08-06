import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import TagSelector from '../../components/Transaction/TagSelector';
import Button from '../../components/shared/Button';

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
    if (Math.abs(somaPercentual - 100) > 0.01) {
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
    <div className="conta-fixa-form-modal">
      <h2>{contaFixa ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}</h2>

      {erro && <p className="conta-fixa-form-erro">{erro}</p>}

      <label>
        Nome
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
      </label>

      <label>
        Tipo
        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          <option value="gasto">Despesa</option>
          <option value="recebivel">Receita</option>
        </select>
      </label>

      <label>
        Valor esperado
        <input
          type="number"
          step="0.01"
          value={form.valorEsperado}
          onChange={(e) => setForm({ ...form, valorEsperado: e.target.value })}
        />
      </label>

      <label>
        Dia de lançamento (quando o registro é criado)
        <input
          type="number"
          min="1"
          max="31"
          value={form.diaLancamento}
          onChange={(e) => setForm({ ...form, diaLancamento: e.target.value })}
        />
      </label>

      <label>
        Dia de vencimento (data que vai na transação)
        <input
          type="number"
          min="1"
          max="31"
          value={form.diaVencimento}
          onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={form.vencimentoMesSeguinte}
          onChange={(e) => setForm({ ...form, vencimentoMesSeguinte: e.target.checked })}
        />
        Vencimento cai no mês seguinte ao lançamento
      </label>

      <label>
        Modo
        <select value={form.modo} onChange={(e) => setForm({ ...form, modo: e.target.value })}>
          <option value="automatico">Automático (lança sozinho)</option>
          <option value="confirmacao">Confirmação manual</option>
        </select>
      </label>

      <label>
        Data fim (opcional)
        <input type="date" value={form.dataFim || ''} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} />
      </label>

      <label>
        Total de repetições (opcional, ex: financiamento 12x)
        <input
          type="number"
          min="1"
          value={form.totalRepeticoes || ''}
          onChange={(e) => setForm({ ...form, totalRepeticoes: e.target.value })}
        />
      </label>

      <h3>Divisão de pagamento (soma deve ser 100%)</h3>
      {form.pagamentosTemplate.map((p, index) => (
        <div key={index} className="conta-fixa-pagamento-linha">
          <input
            placeholder="Pessoa"
            value={p.pessoa}
            onChange={(e) => atualizarPagamento(index, 'pessoa', e.target.value)}
          />
          <input
            type="number"
            placeholder="%"
            value={p.percentual}
            onChange={(e) => atualizarPagamento(index, 'percentual', e.target.value)}
          />
          {form.pagamentosTemplate.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => removerPagamento(index)}>Remover</Button>
          )}
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={adicionarPagamento}>+ Adicionar pessoa</Button>
      <p>Soma atual: {somaPercentual}%</p>

      <h3>Categoria/tags padrão</h3>
      <TagSelector
        categorias={categorias}
        allTags={tags}
        paymentTags={form.tagsPadrao}
        onTagsChange={(novasTags) => setForm({ ...form, tagsPadrao: novasTags })}
      />

      <div className="conta-fixa-form-acoes">
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" onClick={handleSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};

export default ContaFixaFormModal;
