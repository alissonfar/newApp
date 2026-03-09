import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheck, FaSpinner, FaTimes, FaPlus } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import { toast } from 'react-toastify';
import { formatDateBR } from '../../utils/dateUtils';
import { useConfirmacao } from '../../hooks/useConfirmacao';
import { useBreadcrumbOverride } from '../../context/BreadcrumbContext';
import './ImportacaoOFXDetalhePage.css';

const ImportacaoOFXDetalhePage = () => {
  const { mostrarConfirmacao } = useConfirmacao();
  const { id } = useParams();
  const navigate = useNavigate();
  const [importacao, setImportacao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setCarregando(true);
      const data = await patrimonioApi.obterImportacaoOFX(id);
      setImportacao(data);
    } catch (err) {
      toast.error('Erro ao carregar importação');
      navigate('/patrimonio/importacoes-ofx');
    } finally {
      setCarregando(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useBreadcrumbOverride(importacao?.nomeArquivo);

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatarData = (d) => d ? formatDateBR(d) : '-';

  const handleFinalizar = async () => {
    const confirmado = await mostrarConfirmacao(
      <p>Confirma a finalização? O saldo da subconta será atualizado.</p>,
      'finalizar'
    );
    if (!confirmado) return;
    try {
      setFinalizando(true);
      await patrimonioApi.finalizarImportacaoOFX(id);
      toast.success('Importação finalizada');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao finalizar');
    } finally {
      setFinalizando(false);
    }
  };

  const handleCancelar = async () => {
    const confirmado = await mostrarConfirmacao(
      <p>Cancelar esta importação? Todas as transações serão removidas.</p>,
      'cancelar'
    );
    if (!confirmado) return;
    try {
      setCancelando(true);
      await patrimonioApi.cancelarImportacaoOFX(id);
      toast.success('Importação cancelada');
      navigate('/patrimonio/importacoes-ofx');
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao cancelar');
    } finally {
      setCancelando(false);
    }
  };

  const handleCriarTransacao = async (transacaoOFXId) => {
    try {
      await patrimonioApi.criarTransacaoDeOFX(id, transacaoOFXId);
      toast.success('Transação criada');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao criar transação');
    }
  };

  const handleAtualizarTransacao = async (transacaoOFXId, dados) => {
    try {
      await patrimonioApi.atualizarTransacaoOFX(id, transacaoOFXId, dados);
      toast.success('Atualizado');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao atualizar');
    }
  };

  if (carregando || !importacao) {
    return (
      <div className="importacao-ofx-detalhe">
        <div className="loading"><FaSpinner className="spin" /> Carregando...</div>
      </div>
    );
  }

  const podeFinalizar = importacao.status === 'revisao';
  const podeCancelar = importacao.status !== 'finalizada';
  const transacoes = importacao.transacoes || [];

  return (
    <div className="importacao-ofx-detalhe">
      <button className="btn-voltar" onClick={() => navigate('/patrimonio/importacoes-ofx')}>
        <FaArrowLeft /> Voltar
      </button>

      <header className="detalhe-header">
        <h1>{importacao.nomeArquivo}</h1>
        <p>{importacao.subconta?.nome} • {formatarData(importacao.dtStart)} a {formatarData(importacao.dtEnd)}</p>
        <div className="resumo">
          <span>Saldo extrato: <strong>{formatarMoeda(importacao.saldoFinalExtrato)}</strong></span>
          <span>Créditos: {formatarMoeda(importacao.totalCreditos)}</span>
          <span>Débitos: {formatarMoeda(importacao.totalDebitos)}</span>
          <span className={`status status-${importacao.status}`}>{importacao.status}</span>
        </div>
      </header>

      {podeFinalizar && (
        <div className="acoes-principais">
          <button onClick={handleFinalizar} disabled={finalizando}>
            {finalizando ? <FaSpinner className="spin" /> : <FaCheck />} Finalizar importação
          </button>
          {podeCancelar && (
            <button className="btn-cancelar" onClick={handleCancelar} disabled={cancelando}>
              {cancelando ? <FaSpinner className="spin" /> : <FaTimes />} Cancelar
            </button>
          )}
        </div>
      )}

      <section className="transacoes-section">
        <h2>Transações ({transacoes.length})</h2>
        <div className="tabela-transacoes">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.map((t) => (
                <tr key={t._id} className={t.status === 'ja_importada' ? 'ja-importada' : ''}>
                  <td>{formatarData(t.data)}</td>
                  <td><span className={`tipo tipo-${t.tipo}`}>{t.tipo}</span></td>
                  <td>{formatarMoeda(t.valor)}</td>
                  <td>
                    {t.status === 'ja_importada' ? (
                      t.descricao || t.memo
                    ) : (
                      <input
                        key={`${t._id}-${t.updatedAt || ''}`}
                        type="text"
                        defaultValue={t.descricao || t.memo || ''}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const atual = (t.descricao || t.memo || '').trim();
                          if (v !== atual) {
                            handleAtualizarTransacao(t._id, { descricao: v });
                          }
                        }}
                        placeholder={t.memo}
                      />
                    )}
                  </td>
                  <td><span className={`status status-${t.status}`}>{t.status}</span></td>
                  <td>
                    {t.status !== 'ja_importada' && !t.transacaoCriada && (
                      <button
                        className="btn-criar-trans"
                        onClick={() => handleCriarTransacao(t._id)}
                        title="Criar transação"
                      >
                        <FaPlus /> Transação
                      </button>
                    )}
                    {t.transacaoCriada && <span className="criada">Criada</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default ImportacaoOFXDetalhePage;
