import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  listarRecebimentosDisponiveis,
  listarPendentes,
  criarSettlement,
  obterPessoasDistintas
} from '../../../api';

const initialDraftRecebimentos = { dataInicio: '', dataFim: '' };
const initialDraftPendentes = { pessoa: '', dataInicio: '', dataFim: '' };

const initialState = {
  recebimentosDisponiveis: [],
  loadingRecebimentos: false,
  recebimentoSelecionado: null,
  tagSelecionada: '',
  draftFiltrosRecebimentos: initialDraftRecebimentos,
  appliedFiltrosRecebimentos: null,
  hasBuscadoRecebimentos: false,
  draftFiltrosPendentes: initialDraftPendentes,
  appliedFiltrosPendentes: null,
  pendentes: [],
  loadingPendentes: false,
  transacoesSelecionadas: [],
  pessoasOptions: [],
  tabAtiva: 0,
  confirmando: false
};

const ACTIONS = {
  SET_RECEBIMENTOS: 'SET_RECEBIMENTOS',
  SET_LOADING_RECEBIMENTOS: 'SET_LOADING_RECEBIMENTOS',
  SET_RECEBIMENTO_SELECIONADO: 'SET_RECEBIMENTO_SELECIONADO',
  SET_TAG: 'SET_TAG',
  SET_DRAFT_FILTROS_RECEBIMENTOS: 'SET_DRAFT_FILTROS_RECEBIMENTOS',
  SET_APPLIED_FILTROS_RECEBIMENTOS: 'SET_APPLIED_FILTROS_RECEBIMENTOS',
  SET_HAS_BUSCADO_RECEBIMENTOS: 'SET_HAS_BUSCADO_RECEBIMENTOS',
  SET_DRAFT_FILTROS_PENDENTES: 'SET_DRAFT_FILTROS_PENDENTES',
  SET_APPLIED_FILTROS_PENDENTES: 'SET_APPLIED_FILTROS_PENDENTES',
  SET_PENDENTES: 'SET_PENDENTES',
  SET_LOADING_PENDENTES: 'SET_LOADING_PENDENTES',
  SET_TRANSACOES_SELECIONADAS: 'SET_TRANSACOES_SELECIONADAS',
  TOGGLE_SELECAO: 'TOGGLE_SELECAO',
  SET_PESSOAS_OPTIONS: 'SET_PESSOAS_OPTIONS',
  SET_TAB: 'SET_TAB',
  SET_CONFIRMANDO: 'SET_CONFIRMANDO',
  RESET_CONCILIACAO: 'RESET_CONCILIACAO'
};

function recebimentosReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_RECEBIMENTOS:
      return { ...state, recebimentosDisponiveis: action.payload };
    case ACTIONS.SET_LOADING_RECEBIMENTOS:
      return { ...state, loadingRecebimentos: action.payload };
    case ACTIONS.SET_RECEBIMENTO_SELECIONADO:
      return { ...state, recebimentoSelecionado: action.payload };
    case ACTIONS.SET_TAG:
      return { ...state, tagSelecionada: action.payload };
    case ACTIONS.SET_DRAFT_FILTROS_RECEBIMENTOS:
      return { ...state, draftFiltrosRecebimentos: { ...state.draftFiltrosRecebimentos, ...action.payload } };
    case ACTIONS.SET_APPLIED_FILTROS_RECEBIMENTOS:
      return { ...state, appliedFiltrosRecebimentos: action.payload };
    case ACTIONS.SET_HAS_BUSCADO_RECEBIMENTOS:
      return { ...state, hasBuscadoRecebimentos: action.payload };
    case ACTIONS.SET_DRAFT_FILTROS_PENDENTES:
      return { ...state, draftFiltrosPendentes: { ...state.draftFiltrosPendentes, ...action.payload } };
    case ACTIONS.SET_APPLIED_FILTROS_PENDENTES:
      return { ...state, appliedFiltrosPendentes: action.payload };
    case ACTIONS.SET_PENDENTES:
      return { ...state, pendentes: action.payload };
    case ACTIONS.SET_LOADING_PENDENTES:
      return { ...state, loadingPendentes: action.payload };
    case ACTIONS.SET_TRANSACOES_SELECIONADAS:
      return { ...state, transacoesSelecionadas: action.payload };
    case ACTIONS.TOGGLE_SELECAO: {
      const id = action.payload;
      const next = state.transacoesSelecionadas.includes(id)
        ? state.transacoesSelecionadas.filter((x) => x !== id)
        : [...state.transacoesSelecionadas, id];
      return { ...state, transacoesSelecionadas: next };
    }
    case ACTIONS.SET_PESSOAS_OPTIONS:
      return { ...state, pessoasOptions: action.payload };
    case ACTIONS.SET_TAB:
      return { ...state, tabAtiva: action.payload };
    case ACTIONS.SET_CONFIRMANDO:
      return { ...state, confirmando: action.payload };
    case ACTIONS.RESET_CONCILIACAO:
      return {
        ...state,
        recebimentoSelecionado: null,
        tagSelecionada: '',
        transacoesSelecionadas: [],
        pendentes: [],
        appliedFiltrosPendentes: null
      };
    default:
      return state;
  }
}

const RecebimentosContext = createContext(null);

export function RecebimentosProvider({ children }) {
  const [state, dispatch] = useReducer(recebimentosReducer, initialState);
  const abortRecebimentosRef = useRef(null);
  const abortPendentesRef = useRef(null);

  const carregarRecebimentosDisponiveis = useCallback(async (filtrosOverride) => {
    if (abortRecebimentosRef.current) abortRecebimentosRef.current.abort();
    abortRecebimentosRef.current = new AbortController();

    dispatch({ type: ACTIONS.SET_LOADING_RECEBIMENTOS, payload: true });
    try {
      const filtros = filtrosOverride ?? state.appliedFiltrosRecebimentos ?? state.draftFiltrosRecebimentos ?? {};
      const params = {};
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;
      params.signal = abortRecebimentosRef.current.signal;

      const transacoes = await listarRecebimentosDisponiveis(params);
      dispatch({ type: ACTIONS.SET_RECEBIMENTOS, payload: transacoes });
    } catch (err) {
      if (err.name === 'AbortError') return;
      toast.error(err.message || 'Erro ao carregar recebimentos.');
      dispatch({ type: ACTIONS.SET_RECEBIMENTOS, payload: [] });
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING_RECEBIMENTOS, payload: false });
      abortRecebimentosRef.current = null;
    }
  }, [state.appliedFiltrosRecebimentos, state.draftFiltrosRecebimentos]);

  const carregarPendentes = useCallback(async (filtrosOverride) => {
    if (!state.recebimentoSelecionado) return;

    if (abortPendentesRef.current) abortPendentesRef.current.abort();
    abortPendentesRef.current = new AbortController();

    dispatch({ type: ACTIONS.SET_LOADING_PENDENTES, payload: true });
    try {
      const filtros = filtrosOverride ?? state.appliedFiltrosPendentes ?? state.draftFiltrosPendentes ?? {};
      const params = {
        excludeTransactionId: state.recebimentoSelecionado._id,
        signal: abortPendentesRef.current.signal
      };
      if (filtros.pessoa) params.pessoa = filtros.pessoa;
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;

      const transacoes = await listarPendentes(params);
      dispatch({ type: ACTIONS.SET_PENDENTES, payload: transacoes });
      dispatch({ type: ACTIONS.SET_TRANSACOES_SELECIONADAS, payload: [] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      toast.error(err.message || 'Erro ao carregar pendentes.');
      dispatch({ type: ACTIONS.SET_PENDENTES, payload: [] });
    } finally {
      dispatch({ type: ACTIONS.SET_LOADING_PENDENTES, payload: false });
      abortPendentesRef.current = null;
    }
  }, [
    state.recebimentoSelecionado,
    state.appliedFiltrosPendentes,
    state.draftFiltrosPendentes
  ]);

  const applyFiltrosRecebimentos = useCallback((filtrosOverride) => {
    const draft = filtrosOverride
      ? { ...state.draftFiltrosRecebimentos, ...filtrosOverride }
      : { ...state.draftFiltrosRecebimentos };
    if (filtrosOverride) {
      dispatch({ type: ACTIONS.SET_DRAFT_FILTROS_RECEBIMENTOS, payload: filtrosOverride });
    }
    dispatch({ type: ACTIONS.SET_APPLIED_FILTROS_RECEBIMENTOS, payload: draft });
    dispatch({ type: ACTIONS.SET_HAS_BUSCADO_RECEBIMENTOS, payload: true });
    carregarRecebimentosDisponiveis(draft);
  }, [state.draftFiltrosRecebimentos, carregarRecebimentosDisponiveis]);

  const applyFiltrosPendentes = useCallback((filtrosOverride) => {
    if (!state.recebimentoSelecionado) return;
    const draft = filtrosOverride
      ? { ...state.draftFiltrosPendentes, ...filtrosOverride }
      : { ...state.draftFiltrosPendentes };
    if (filtrosOverride) {
      dispatch({ type: ACTIONS.SET_DRAFT_FILTROS_PENDENTES, payload: filtrosOverride });
    }
    dispatch({ type: ACTIONS.SET_APPLIED_FILTROS_PENDENTES, payload: draft });
    carregarPendentes(draft);
  }, [state.draftFiltrosPendentes, state.recebimentoSelecionado, carregarPendentes]);

  const carregarPessoas = useCallback(async () => {
    try {
      const pessoas = await obterPessoasDistintas();
      dispatch({ type: ACTIONS.SET_PESSOAS_OPTIONS, payload: pessoas });
    } catch {
      dispatch({ type: ACTIONS.SET_PESSOAS_OPTIONS, payload: [] });
    }
  }, []);

  useEffect(() => {
    carregarPessoas();
  }, [carregarPessoas]);

  useEffect(() => {
    if (!state.recebimentoSelecionado) {
      dispatch({ type: ACTIONS.SET_PENDENTES, payload: [] });
      dispatch({ type: ACTIONS.SET_TRANSACOES_SELECIONADAS, payload: [] });
      dispatch({ type: ACTIONS.SET_APPLIED_FILTROS_PENDENTES, payload: null });
    }
  }, [state.recebimentoSelecionado]);

  const toggleSelecao = useCallback((id) => {
    dispatch({ type: ACTIONS.TOGGLE_SELECAO, payload: id });
  }, []);

  const selectAllVisible = useCallback(() => {
    const ids = state.pendentes.map((t) => t._id);
    dispatch({ type: ACTIONS.SET_TRANSACOES_SELECIONADAS, payload: ids });
  }, [state.pendentes]);

  const clearSelection = useCallback(() => {
    dispatch({ type: ACTIONS.SET_TRANSACOES_SELECIONADAS, payload: [] });
  }, []);

  const handleConfirmar = useCallback(async () => {
    const { recebimentoSelecionado, tagSelecionada, transacoesSelecionadas, pendentes, appliedFiltrosRecebimentos } = state;
    const totalSelecionado = pendentes
      .filter((t) => transacoesSelecionadas.includes(t._id))
      .reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
    const valorRecebimento = recebimentoSelecionado
      ? Math.abs(parseFloat(recebimentoSelecionado.valor) || 0)
      : 0;
    const podeConfirmar =
      recebimentoSelecionado &&
      tagSelecionada &&
      transacoesSelecionadas.length > 0 &&
      totalSelecionado <= valorRecebimento;

    if (!podeConfirmar) return;
    dispatch({ type: ACTIONS.SET_CONFIRMANDO, payload: true });
    try {
      await criarSettlement({
        receivingTransactionId: recebimentoSelecionado._id,
        appliedTransactionIds: transacoesSelecionadas,
        tagId: tagSelecionada
      });
      toast.success('Conciliação realizada com sucesso!');
      dispatch({ type: ACTIONS.RESET_CONCILIACAO });
      carregarRecebimentosDisponiveis(appliedFiltrosRecebimentos ?? state.draftFiltrosRecebimentos);
    } catch (err) {
      toast.error(err.message || 'Erro ao criar conciliação.');
    } finally {
      dispatch({ type: ACTIONS.SET_CONFIRMANDO, payload: false });
    }
  }, [state, carregarRecebimentosDisponiveis]);

  const value = {
    ...state,
    transacoesSelecionadasSet: new Set(state.transacoesSelecionadas),
    carregarRecebimentosDisponiveis,
    carregarPendentes,
    applyFiltrosRecebimentos,
    applyFiltrosPendentes,
    carregarPessoas,
    toggleSelecao,
    selectAllVisible,
    clearSelection,
    handleConfirmar,
    setRecebimentoSelecionado: (v) =>
      dispatch({ type: ACTIONS.SET_RECEBIMENTO_SELECIONADO, payload: v }),
    setTagSelecionada: (v) => dispatch({ type: ACTIONS.SET_TAG, payload: v }),
    setDraftFiltrosRecebimentos: (payload) =>
      dispatch({ type: ACTIONS.SET_DRAFT_FILTROS_RECEBIMENTOS, payload }),
    setDraftFiltrosPendentes: (payload) =>
      dispatch({ type: ACTIONS.SET_DRAFT_FILTROS_PENDENTES, payload }),
    setTabAtiva: (v) => dispatch({ type: ACTIONS.SET_TAB, payload: v })
  };

  return (
    <RecebimentosContext.Provider value={value}>
      {children}
    </RecebimentosContext.Provider>
  );
}

export function useRecebimentos() {
  const ctx = useContext(RecebimentosContext);
  if (!ctx) {
    throw new Error('useRecebimentos deve ser usado dentro de RecebimentosProvider');
  }
  return ctx;
}
