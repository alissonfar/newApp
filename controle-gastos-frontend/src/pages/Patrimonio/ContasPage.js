import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSpinner, FaChevronRight, FaExclamationTriangle } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import InstituicaoForm from '../../components/Patrimonio/InstituicaoForm';
import SubcontaForm from '../../components/Patrimonio/SubcontaForm';
import './ContasPage.css';

const DIAS_ALERTA = 7;

const ContasPage = () => {
  const navigate = useNavigate();
  const [instituicoes, setInstituicoes] = useState([]);
  const [subcontas, setSubcontas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalInstituicao, setModalInstituicao] = useState(false);
  const [modalSubconta, setModalSubconta] = useState(false);
  const [instituicaoSelecionada, setInstituicaoSelecionada] = useState(null);
  const [editandoInstituicao, setEditandoInstituicao] = useState(null);
  const [editandoSubconta, setEditandoSubconta] = useState(null);

  const carregar = async () => {
    try {
      setCarregando(true);
      const [inst, sub] = await Promise.all([
        patrimonioApi.listarInstituicoes(),
        patrimonioApi.listarSubcontas()
      ]);
      setInstituicoes(inst);
      setSubcontas(sub);
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const estaDesatualizada = (sc) => {
    if (!sc.dataUltimaConfirmacao) return true;
    const diff = (Date.now() - new Date(sc.dataUltimaConfirmacao).getTime()) / (1000 * 60 * 60 * 24);
    return diff > DIAS_ALERTA;
  };

  const progressoMeta = (sc) => {
    if (!sc.meta || sc.meta <= 0) return null;
    const pct = Math.min(100, ((sc.saldoAtual || 0) / sc.meta) * 100);
    return pct;
  };

  const agruparPorInstituicao = () => {
    const map = new Map();
    for (const inst of instituicoes) {
      map.set(inst._id, { instituicao: inst, subcontas: [] });
    }
    for (const sc of subcontas) {
      const instId = sc.instituicao?._id || sc.instituicao;
      if (map.has(instId)) {
        map.get(instId).subcontas.push(sc);
      }
    }
    return Array.from(map.values());
  };

  const grupos = agruparPorInstituicao();

  const handleSalvarInstituicao = async (dados) => {
    try {
      if (editandoInstituicao) {
        await patrimonioApi.atualizarInstituicao(editandoInstituicao._id, dados);
      } else {
        await patrimonioApi.criarInstituicao(dados);
      }
      setModalInstituicao(false);
      setEditandoInstituicao(null);
      carregar();
    } catch (err) {
      throw err;
    }
  };

  const handleSalvarSubconta = async (dados) => {
    try {
      if (editandoSubconta) {
        await patrimonioApi.atualizarSubconta(editandoSubconta._id, dados);
      } else {
        await patrimonioApi.criarSubconta({ ...dados, instituicao: instituicaoSelecionada?._id || instituicaoSelecionada });
      }
      setModalSubconta(false);
      setInstituicaoSelecionada(null);
      setEditandoSubconta(null);
      carregar();
    } catch (err) {
      throw err;
    }
  };

  const handleExcluirInstituicao = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta instituição?')) return;
    await patrimonioApi.excluirInstituicao(id);
    carregar();
  };

  const handleExcluirSubconta = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta subconta?')) return;
    await patrimonioApi.excluirSubconta(id);
    carregar();
  };

  if (carregando) {
    return (
      <div className="contas-page">
        <div className="contas-loading">
          <FaSpinner className="spinner" />
          <p>Carregando contas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="contas-page">
      <div className="contas-header">
        <h1>Contas Bancárias</h1>
        <div className="contas-actions">
          <button onClick={() => { setEditandoInstituicao(null); setModalInstituicao(true); }}>
            <FaPlus /> Nova Instituição
          </button>
        </div>
      </div>

      <div className="contas-arvore">
        {grupos.map(({ instituicao, subcontas: subs }) => (
          <div key={instituicao._id} className="grupo-instituicao">
            <div className="instituicao-header">
              <div className="instituicao-info">
                <span className="instituicao-nome" style={{ borderLeftColor: instituicao.cor || '#ccc' }}>
                  {instituicao.nome}
                </span>
                <button
                  className="btn-add-subconta"
                  onClick={() => { setInstituicaoSelecionada(instituicao); setEditandoSubconta(null); setModalSubconta(true); }}
                >
                  <FaPlus /> Subconta
                </button>
                <button
                  className="btn-edit"
                  onClick={() => { setEditandoInstituicao(instituicao); setModalInstituicao(true); }}
                >
                  Editar
                </button>
                <button
                  className="btn-excluir"
                  onClick={() => handleExcluirInstituicao(instituicao._id)}
                >
                  Excluir
                </button>
              </div>
            </div>
            <ul className="lista-subcontas">
              {subs.length === 0 ? (
                <li className="sem-subcontas">Nenhuma subconta. Clique em "Subconta" para adicionar.</li>
              ) : (
                subs.map((sc) => (
                  <li key={sc._id} className="subconta-item">
                    <div
                      className="subconta-link"
                      onClick={() => navigate(`/patrimonio/contas/${sc._id}`)}
                    >
                      <FaChevronRight className="chevron" />
                      <span className="subconta-nome">{sc.nome}</span>
                      <span className="subconta-saldo">{formatarMoeda(sc.saldoAtual)}</span>
                      {estaDesatualizada(sc) && (
                        <FaExclamationTriangle className="alerta" title="Saldo desatualizado" />
                      )}
                    </div>
                    {progressoMeta(sc) != null && (
                      <div className="progresso-meta">
                        <div className="progresso-bar" style={{ width: `${progressoMeta(sc)}%` }} />
                        <span>{progressoMeta(sc).toFixed(0)}% da meta</span>
                      </div>
                    )}
                    <div className="subconta-actions">
                      <button onClick={() => { setEditandoSubconta(sc); setInstituicaoSelecionada(sc.instituicao); setModalSubconta(true); }}>
                        Editar
                      </button>
                      <button onClick={() => handleExcluirSubconta(sc._id)}>Excluir</button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>

      {instituicoes.length === 0 && (
        <p className="sem-dados">Nenhuma instituição cadastrada. Clique em "Nova Instituição" para começar.</p>
      )}

      {modalInstituicao && (
        <InstituicaoForm
          instituicao={editandoInstituicao}
          onSalvar={handleSalvarInstituicao}
          onFechar={() => { setModalInstituicao(false); setEditandoInstituicao(null); }}
        />
      )}
      {modalSubconta && (
        <SubcontaForm
          subconta={editandoSubconta}
          instituicoes={instituicoes}
          instituicaoPadrao={instituicaoSelecionada}
          onSalvar={handleSalvarSubconta}
          onFechar={() => { setModalSubconta(false); setInstituicaoSelecionada(null); setEditandoSubconta(null); }}
        />
      )}
    </div>
  );
};

export default ContasPage;
