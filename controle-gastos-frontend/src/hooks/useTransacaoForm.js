import { useState, useEffect, useRef, useCallback } from 'react';
import { getTodayBR, toISOStringBR } from '../utils/dateUtils';

export default function useTransacaoForm({ transacao, proprietarioPadrao }) {
  const [_id, set_Id] = useState(transacao?._id);
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(() => {
    if (transacao) {
      if (typeof transacao.data === 'string') return transacao.data.split('T')[0];
      if (transacao.data instanceof Date) return transacao.data.toISOString().split('T')[0];
    }
    return getTodayBR();
  });
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  const [observacao, setObservacao] = useState(transacao ? transacao.observacao : '');
  const [isImportada, setIsImportada] = useState(!!transacao?.importacao);
  const [importacaoId, setImportacaoId] = useState(transacao?.importacao || null);
  const [emprestimoId, setEmprestimoId] = useState('');

  const tipoRef = useRef(null);
  const descricaoRef = useRef(null);
  const valorRef = useRef(null);

  useEffect(() => {
    if (!transacao) {
      setData(getTodayBR());
    }
  }, [transacao]);

  useEffect(() => {
    if (transacao) {
      set_Id(transacao._id);
      setTipo(transacao.tipo);
      setDescricao(transacao.descricao);
      setData(
        typeof transacao.data === 'string'
          ? transacao.data.split('T')[0]
          : transacao.data instanceof Date
            ? transacao.data.toISOString().split('T')[0]
            : ''
      );
      setValorTotal(String(transacao.valor));
      setObservacao(transacao.observacao || '');
      setIsImportada(!!transacao.importacao);
      setImportacaoId(transacao.importacao || null);
    }
  }, [transacao]);

  const handleValorTotalChange = useCallback((raw, pagamentos, isContaConjunta, pagoPor, handlePagamentoChangeFn) => {
    setValorTotal(raw);
    if (isContaConjunta && pagoPor === 'outro') {
      if (pagamentos.length === 1 && handlePagamentoChangeFn) handlePagamentoChangeFn(0, 'valor', raw);
    } else if (pagamentos.length === 1 && handlePagamentoChangeFn) {
      handlePagamentoChangeFn(0, 'valor', raw);
    }
  }, []);

  const resetForm = useCallback((keepTipo = true) => {
    set_Id(null);
    if (!keepTipo) setTipo('gasto');
    setDescricao('');
    setData(getTodayBR());
    setValorTotal('');
    setObservacao('');
    setEmprestimoId('');
    setIsImportada(false);
    setImportacaoId(null);
  }, []);

  const buildPayload = useCallback((overrides = {}) => {
    const payload = {
      _id,
      tipo,
      descricao,
      data: toISOStringBR(data),
      valor: parseFloat(valorTotal),
      observacao,
      ...overrides
    };
    if (emprestimoId) payload.emprestimoId = emprestimoId;
    else payload.emprestimoId = null;
    return payload;
  }, [_id, tipo, descricao, data, valorTotal, observacao, emprestimoId]);

  const setHoje = useCallback(() => setData(getTodayBR()), []);
  const setOntem = useCallback(() => {
    const hoje = new Date();
    const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
    setData(ontem.toISOString().split('T')[0]);
  }, []);

  const focusDescricao = useCallback(() => {
    setTimeout(() => descricaoRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (transacao && tipoRef.current) {
      tipoRef.current.focus();
    } else if (descricaoRef.current) {
      descricaoRef.current.focus();
    }
  }, [transacao]);

  return {
    formState: { _id, tipo, descricao, data, valorTotal, observacao, isImportada, importacaoId, emprestimoId },
    setters: { setTipo, setDescricao, setData, setValorTotal, setObservacao, setId: set_Id, setIsImportada, setImportacaoId, setEmprestimoId },
    handleValorTotalChange,
    resetForm,
    buildPayload,
    setHoje,
    setOntem,
    focusDescricao,
    refs: { tipoRef, descricaoRef, valorRef }
  };
}
