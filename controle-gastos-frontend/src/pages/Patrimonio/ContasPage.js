import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSpinner } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import InstituicaoForm from '../../components/Patrimonio/InstituicaoForm';
import SubcontaForm from '../../components/Patrimonio/SubcontaForm';
import InstituicaoCard from '../../components/Patrimonio/InstituicaoCard';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
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
          <Button
            variant="primary"
            icon={<FaPlus size={14} />}
            onClick={() => { setEditandoInstituicao(null); setModalInstituicao(true); }}
          >
            Nova Instituição
          </Button>
        </div>
      </div>

      <div className="contas-arvore">
        {grupos.map(({ instituicao, subcontas: subs }) => {
          const totalConsolidado = subs.reduce((acc, s) => acc + (s.saldoAtual || 0), 0);
          return (
            <InstituicaoCard
              key={instituicao._id}
              instituicao={instituicao}
              subcontas={subs}
              totalConsolidado={totalConsolidado}
              formatarMoeda={formatarMoeda}
              estaDesatualizada={estaDesatualizada}
              progressoMeta={progressoMeta}
              onNavigateSubconta={(path) => navigate(path)}
              onAdicionarSubconta={() => {
                setInstituicaoSelecionada(instituicao);
                setEditandoSubconta(null);
                setModalSubconta(true);
              }}
              onEditarInstituicao={() => {
                setEditandoInstituicao(instituicao);
                setModalInstituicao(true);
              }}
              onExcluirInstituicao={handleExcluirInstituicao}
              onEditarSubconta={(sc) => {
                setEditandoSubconta(sc);
                setInstituicaoSelecionada(sc.instituicao);
                setModalSubconta(true);
              }}
              onExcluirSubconta={handleExcluirSubconta}
            />
          );
        })}
      </div>

      {instituicoes.length === 0 && (
        <EmptyState
          message='Nenhuma instituição cadastrada. Clique em "Nova Instituição" para começar.'
        />
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
