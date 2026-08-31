// src/hooks/useFechamento.js
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  listarInstanciasFechamento,
  criarInstanciaFechamento,
  duplicarInstanciaFechamento,
  obterTransacoesInstanciaFechamento,
  atualizarStatusInstanciaFechamento,
  linkarRecebimentoInstanciaFechamento,
  excluirInstanciaFechamento
} from '../api';

export default function useFechamento({ dataInicio, dataFim }) {
  const [instancias, setInstancias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandidas, setExpandidas] = useState(new Set());
  const [detalhes, setDetalhes] = useState({}); // { [instanciaId]: { rows, summary, loading } }
  const [selecionadas, setSelecionadas] = useState(new Set());

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const dados = await listarInstanciasFechamento({ dataInicio, dataFim });
      setInstancias(dados);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar instâncias de Fechamento.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);

  const alternarExpandida = useCallback(async (id) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    setDetalhes((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: { rows: [], summary: null, loading: true } };
    });

    if (!detalhes[id]) {
      try {
        const resultado = await obterTransacoesInstanciaFechamento(id);
        setDetalhes((prev) => ({ ...prev, [id]: { ...resultado, loading: false } }));
      } catch (err) {
        toast.error(err.message || 'Erro ao carregar transações da instância.');
        setDetalhes((prev) => ({ ...prev, [id]: { rows: [], summary: null, loading: false } }));
      }
    }
  }, [detalhes]);

  const criarInstancia = useCallback(async (payload) => {
    await criarInstanciaFechamento(payload);
    toast.success('Instância de Fechamento criada.');
    await carregar();
  }, [carregar]);

  // duplicar/atualizarStatus são disparados direto pelos botões do card (sem modal/try-catch do
  // lado do chamador) — capturam o próprio erro aqui pra nunca virar uma promise rejeitada sem
  // tratamento (ex: "Duplicar" bloqueado por já existir instância no mesmo período).
  const duplicar = useCallback(async (id) => {
    try {
      await duplicarInstanciaFechamento(id);
      toast.success('Instância duplicada para o próximo período.');
      await carregar();
    } catch (err) {
      toast.error(err.message || 'Erro ao duplicar instância.');
    }
  }, [carregar]);

  const atualizarStatus = useCallback(async (id, status) => {
    try {
      await atualizarStatusInstanciaFechamento(id, status);
      toast.success('Status atualizado.');
      await carregar();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar status.');
    }
  }, [carregar]);

  const linkarRecebimento = useCallback(async (id, settlementId) => {
    await linkarRecebimentoInstanciaFechamento(id, settlementId);
    toast.success('Recebimento linkado — status atualizado para Recebido.');
    await carregar();
  }, [carregar]);

  const excluir = useCallback(async (id) => {
    await excluirInstanciaFechamento(id);
    toast.success('Instância removida.');
    await carregar();
  }, [carregar]);

  const alternarSelecao = useCallback((id) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selecionarTodas = useCallback((marcado) => {
    setSelecionadas(marcado ? new Set(instancias.map((i) => i._id)) : new Set());
  }, [instancias]);

  return {
    instancias,
    loading,
    expandidas,
    detalhes,
    selecionadas,
    carregar,
    alternarExpandida,
    criarInstancia,
    duplicar,
    atualizarStatus,
    linkarRecebimento,
    excluir,
    alternarSelecao,
    selecionarTodas
  };
}
