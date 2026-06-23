// src/pages/Emprestimos/EmprestimoDetalhePage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  obterEmprestimo,
  atualizarEmprestimo,
  cancelarEmprestimo,
  obterTransacoesEmprestimo
} from '../../api';
import {
  formatarMoedaBRL,
  formatarDataBR,
  labelTipoRetorno,
  labelStatus,
  calcularDiasAtraso
} from '../../utils/emprestimoFormat';
import { useBreadcrumbOverride } from '../../context/BreadcrumbContext';
import EmprestimoForm from '../../components/Emprestimos/EmprestimoForm';
import './EmprestimoDetalhePage.css';

const EmprestimoDetalhePage = () => {
  const { id } = useParams();
  const [emprestimo, setEmprestimo] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useBreadcrumbOverride(emprestimo?.pessoaNomeSnapshot || null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detalhe, movs] = await Promise.all([
        obterEmprestimo(id),
        obterTransacoesEmprestimo(id)
      ]);
      setEmprestimo(detalhe);
      setMovimentacoes(Array.isArray(movs?.transacoes) ? movs.transacoes : []);
    } catch (e) {
      toast.error('Erro ao carregar empréstimo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSalvar = async (dados) => {
    await atualizarEmprestimo(id, dados);
    toast.success('Empréstimo atualizado.');
    setEditOpen(false);
    load();
  };

  const handleCancelar = async () => {
    const result = await Swal.fire({
      title: 'Cancelar empréstimo?',
      html: 'As transações vinculadas <strong>permanecem</strong> ativas, mas o empréstimo será marcado como cancelado.<br/>Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, cancelar empréstimo',
      cancelButtonText: 'Voltar'
    });
    if (!result.isConfirmed) return;
    try {
      await cancelarEmprestimo(id);
      toast.success('Empréstimo cancelado.');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao cancelar.');
    }
  };

  if (loading) return <div className="emp-detalhe-loading">Carregando...</div>;
  if (!emprestimo) return (
    <div className="emp-detalhe-empty">
      <p>Empréstimo não encontrado.</p>
      <Link to="/emprestimos">← Voltar para lista</Link>
    </div>
  );

  const status = labelStatus(emprestimo.status, emprestimo.isQuitadoCalculado);
  const diasAtraso = emprestimo.status === 'ativo' && !emprestimo.isQuitadoCalculado
    ? calcularDiasAtraso(emprestimo.prazoFinal)
    : 0;

  return (
    <div className="emp-detalhe-container">
      <div className="emp-detalhe-voltar">
        <Link to="/emprestimos">← Empréstimos</Link>
      </div>

      <div className="emp-detalhe-header">
        <div>
          <h2>{emprestimo.pessoaNomeSnapshot}</h2>
          <p className="emp-detalhe-subtitulo">
            <span className={`emp-status-badge ${status.cls}`}>{status.text}</span>
            {emprestimo.observacao && <span className="emp-detalhe-obs">· {emprestimo.observacao}</span>}
          </p>
        </div>
        <div className="emp-detalhe-acoes">
          {emprestimo.status !== 'cancelado' && (
            <>
              <button onClick={() => setEditOpen(!editOpen)} className="emp-btn-secundario">
                {editOpen ? 'Fechar edição' : 'Editar'}
              </button>
              <button onClick={handleCancelar} className="emp-btn-perigo">
                Cancelar empréstimo
              </button>
            </>
          )}
        </div>
      </div>

      {editOpen && (
        <div className="emp-detalhe-edicao">
          <EmprestimoForm
            inicial={emprestimo}
            onSubmit={handleSalvar}
            onCancel={() => setEditOpen(false)}
            somenteEdicaoParcial
          />
        </div>
      )}

      {diasAtraso > 0 && (
        <div className="emp-detalhe-alerta">
          ⚠️ Empréstimo vencido há {diasAtraso} {diasAtraso === 1 ? 'dia' : 'dias'} (prazo: {formatarDataBR(emprestimo.prazoFinal)})
        </div>
      )}

      <div className="emp-detalhe-info-grid">
        <div className="emp-detalhe-info">
          <span className="emp-detalhe-label">Valor esperado</span>
          <span className="emp-detalhe-valor">{formatarMoedaBRL(emprestimo.valorEsperadoRetorno)}</span>
        </div>
        <div className="emp-detalhe-info">
          <span className="emp-detalhe-label">Prazo final</span>
          <span className="emp-detalhe-valor">{formatarDataBR(emprestimo.prazoFinal)}</span>
        </div>
        <div className="emp-detalhe-info">
          <span className="emp-detalhe-label">Tipo de retorno</span>
          <span className="emp-detalhe-valor">{labelTipoRetorno(emprestimo.tipoRetorno)}</span>
        </div>
        {emprestimo.dataQuitacao && (
          <div className="emp-detalhe-info">
            <span className="emp-detalhe-label">Quitado em</span>
            <span className="emp-detalhe-valor">{formatarDataBR(emprestimo.dataQuitacao)}</span>
          </div>
        )}
      </div>

      <div className="emp-detalhe-totais">
        <div className="emp-total-card">
          <span className="emp-total-label">Desembolsado</span>
          <span className="emp-total-valor">{formatarMoedaBRL(emprestimo.totalDisbursed || 0)}</span>
        </div>
        <div className="emp-total-card">
          <span className="emp-total-label">Recebido</span>
          <span className="emp-total-valor">{formatarMoedaBRL(emprestimo.totalReceived || 0)}</span>
        </div>
        <div className="emp-total-card">
          <span className="emp-total-label">Saldo a receber</span>
          <span className="emp-total-valor">{formatarMoedaBRL(emprestimo.saldoAReceber || 0)}</span>
        </div>
        <div className={`emp-total-card ${emprestimo.lucro >= 0 ? 'emp-total-pos' : 'emp-total-neg'}`}>
          <span className="emp-total-label">{emprestimo.lucro >= 0 ? 'Lucro' : 'Prejuízo'}</span>
          <span className="emp-total-valor">{formatarMoedaBRL(Math.abs(emprestimo.lucro || 0))}</span>
        </div>
      </div>

      <div className="emp-detalhe-secao">
        <h3>Movimentações</h3>
        {movimentacoes.length === 0 ? (
          <p className="emp-detalhe-sem-mov">Nenhuma transação vinculada ainda. Crie um gasto ou recebível marcando a flag "Esta transação é parte de um empréstimo" e vincule a este.</p>
        ) : (
          <table className="emp-detalhe-tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th className="emp-th-valor">Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {movimentacoes.map((m) => (
                <tr key={m.id || m._id}>
                  <td>{formatarDataBR(m.data)}</td>
                  <td>
                    <span className={`emp-tipo-tag ${m.tipo}`}>
                      {m.tipo === 'gasto' ? '↗ Desembolso' : '↙ Recebimento'}
                    </span>
                  </td>
                  <td>{m.descricao || '—'}</td>
                  <td className="emp-td-valor">{formatarMoedaBRL(m.valor)}</td>
                  <td>
                    {m.status === 'estornado' ? (
                      <span className="emp-status-estornado">Estornada</span>
                    ) : (
                      <span className="emp-status-ok">Ativa</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}><strong>Totais</strong></td>
                <td className="emp-td-valor">
                  <strong>{formatarMoedaBRL(
                    movimentacoes.reduce((acc, m) => acc + (m.valor || 0), 0)
                  )}</strong>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="emp-detalhe-explicacao">
        <h4>Como o relatório entende este empréstimo</h4>
        <ul>
          <li>Desembolsos (gastos) com este empréstimo <strong>não contam</strong> como gasto nos relatórios — o dinheiro ainda é seu.</li>
          <li>Quando o total recebido atinge o valor esperado, o empréstimo é marcado como <strong>quitado</strong> automaticamente e uma transação de receita (juros) é criada com o valor igual a <code>recebimentos − desembolsos</code>.</li>
        </ul>
      </div>
    </div>
  );
};

export default EmprestimoDetalhePage;
