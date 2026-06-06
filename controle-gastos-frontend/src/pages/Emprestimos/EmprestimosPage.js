// src/pages/Emprestimos/EmprestimosPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { listarEmprestimos, criarEmprestimo } from '../../api';
import { formatarMoedaBRL, formatarDataBR, labelTipoRetorno, labelStatus } from '../../utils/emprestimoFormat';
import EmprestimoForm from '../../components/Emprestimos/EmprestimoForm';
import './EmprestimosPage.css';

const EmprestimosPage = () => {
  const [emprestimos, setEmprestimos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('ativo');

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [filtroStatus]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listarEmprestimos({ status: filtroStatus });
      setEmprestimos(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Erro ao carregar empréstimos.');
      setEmprestimos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCriar = async (dados) => {
    const novo = await criarEmprestimo(dados);
    toast.success('Empréstimo criado.');
    setModalOpen(false);
    load();
    return novo;
  };

  const totais = useMemo(() => {
    return emprestimos.reduce(
      (acc, e) => {
        acc.totalEsperado += Number(e.valorEsperadoRetorno || 0);
        acc.totalRecebido += Number(e.totalReceived || 0);
        acc.totalDesembolsado += Number(e.totalDisbursed || 0);
        acc.lucro += Number(e.lucro || 0);
        return acc;
      },
      { totalEsperado: 0, totalRecebido: 0, totalDesembolsado: 0, lucro: 0 }
    );
  }, [emprestimos]);

  return (
    <div className="emprestimos-container">
      <div className="emprestimos-header">
        <h2>Empréstimos</h2>
        <p className="emprestimos-desc">
          Acompanhe quem te deve, prazos e retornos esperados. Empréstimos concedidos
          não contam como gasto nos relatórios — o que volta é devolução de principal,
          juros são income real.
        </p>
        <button className="emp-btn-novo" onClick={() => setModalOpen(true)}>+ Novo Empréstimo</button>
      </div>

      <div className="emp-filtros">
        <button
          className={filtroStatus === 'ativo' ? 'emp-filtro-ativo' : 'emp-filtro'}
          onClick={() => setFiltroStatus('ativo')}
        >Ativos</button>
        <button
          className={filtroStatus === 'quitado' ? 'emp-filtro-ativo' : 'emp-filtro'}
          onClick={() => setFiltroStatus('quitado')}
        >Quitados</button>
        <button
          className={filtroStatus === 'cancelado' ? 'emp-filtro-ativo' : 'emp-filtro'}
          onClick={() => setFiltroStatus('cancelado')}
        >Cancelados</button>
        <button
          className={filtroStatus === '' ? 'emp-filtro-ativo' : 'emp-filtro'}
          onClick={() => setFiltroStatus('')}
        >Todos</button>
      </div>

      {emprestimos.length > 0 && (
        <div className="emp-resumo">
          <div className="emp-resumo-card">
            <span className="emp-resumo-label">Total esperado</span>
            <span className="emp-resumo-valor">{formatarMoedaBRL(totais.totalEsperado)}</span>
          </div>
          <div className="emp-resumo-card">
            <span className="emp-resumo-label">Desembolsado</span>
            <span className="emp-resumo-valor">{formatarMoedaBRL(totais.totalDesembolsado)}</span>
          </div>
          <div className="emp-resumo-card">
            <span className="emp-resumo-label">Recebido</span>
            <span className="emp-resumo-valor">{formatarMoedaBRL(totais.totalRecebido)}</span>
          </div>
          <div className="emp-resumo-card emp-resumo-lucro">
            <span className="emp-resumo-label">{totais.lucro >= 0 ? 'Lucro' : 'Prejuízo'}</span>
            <span className="emp-resumo-valor">{formatarMoedaBRL(totais.lucro)}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="emprestimos-loading">Carregando...</div>
      ) : emprestimos.length === 0 ? (
        <div className="emprestimos-empty">
          <p>Nenhum empréstimo {filtroStatus && filtroStatus !== '' ? `${filtroStatus} ` : ''}encontrado.</p>
          <p>Clique em "+ Novo Empréstimo" para começar.</p>
        </div>
      ) : (
        <div className="emprestimos-lista">
          {emprestimos.map((e) => {
            const status = labelStatus(e.status, e.isQuitadoCalculado);
            return (
              <Link key={e._id} to={`/emprestimos/${e._id}`} className="emprestimo-card">
                <div className="emprestimo-card-header">
                  <h3>{e.pessoaNomeSnapshot || 'Pessoa'}</h3>
                  <span className={`emp-status-badge ${status.cls}`}>{status.text}</span>
                </div>
                <div className="emprestimo-card-info">
                  <div className="emp-info-row">
                    <span>Esperado:</span>
                    <strong>{formatarMoedaBRL(e.valorEsperadoRetorno)}</strong>
                  </div>
                  <div className="emp-info-row">
                    <span>Desembolsado:</span>
                    <span>{formatarMoedaBRL(e.totalDisbursed || 0)}</span>
                  </div>
                  <div className="emp-info-row">
                    <span>Recebido:</span>
                    <span>{formatarMoedaBRL(e.totalReceived || 0)}</span>
                  </div>
                  <div className="emp-info-row">
                    <span>Prazo:</span>
                    <span>{formatarDataBR(e.prazoFinal)}</span>
                  </div>
                  <div className="emp-info-row">
                    <span>Tipo:</span>
                    <span>{labelTipoRetorno(e.tipoRetorno)}</span>
                  </div>
                </div>
                {e.status !== 'cancelado' && (
                  <div className="emprestimo-card-footer">
                    {e.lucro !== 0 && (
                      <span className={e.lucro >= 0 ? 'emp-lucro-pos' : 'emp-lucro-neg'}>
                        {e.lucro >= 0 ? '↗' : '↘'} {formatarMoedaBRL(Math.abs(e.lucro))}
                      </span>
                    )}
                    {e.saldoAReceber > 0 && (
                      <span className="emp-saldo">A receber: {formatarMoedaBRL(e.saldoAReceber)}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="emprestimo-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="emprestimo-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Novo Empréstimo</h3>
            <EmprestimoForm
              onSubmit={handleCriar}
              onCancel={() => setModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmprestimosPage;
