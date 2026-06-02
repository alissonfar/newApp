import { useState, useEffect, useCallback } from 'react';

export default function usePagamentos({ transacao, proprietarioPadrao, valorTotal, isContaConjunta, pagoPor, parteUsuario, parcelamentos }) {
  const [pagamentos, setPagamentos] = useState(() => {
    if (transacao?.pagamentos?.length > 0) {
      return transacao.pagamentos.map(p => ({
        ...p,
        paymentTags: p.tags || {},
        parcelamento: p.parcelamento || null,
        installmentNumber: p.installmentNumber || null,
        installmentTotal: p.installmentTotal || null
      }));
    }
    return [{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {}, parcelamento: null }];
  });

  const [showValidationWarning, setShowValidationWarning] = useState(false);

  const valorEsperadoParaSoma = (isContaConjunta && pagoPor === 'outro')
    ? parseFloat(parteUsuario || 0)
    : parseFloat(valorTotal || 0);

  useEffect(() => {
    if (transacao?.pagamentos?.length > 0) {
      setPagamentos(
        transacao.pagamentos.map(p => ({
          pessoa: p.pessoa,
          valor: String(p.valor),
          paymentTags: p.tags || {},
          parcelamento: p.parcelamento || null,
          installmentNumber: p.installmentNumber || null,
          installmentTotal: p.installmentTotal || null
        }))
      );
    } else if (!transacao) {
      setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {}, parcelamento: null }]);
    }
  }, [transacao, proprietarioPadrao]);

  const isPagamentoParcelado = useCallback((index) => {
    const conf = parcelamentos && parcelamentos[index];
    return !!(conf?.ativo) || !!(pagamentos[index]?.parcelamento?.ativo);
  }, [parcelamentos, pagamentos]);

  useEffect(() => {
    if (pagamentos.length === 0) {
      setShowValidationWarning(false);
      return;
    }
    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    const diferenca = Math.abs(valorEsperadoParaSoma - soma);
    setShowValidationWarning(diferenca > 0.01);
  }, [pagamentos, valorEsperadoParaSoma]);

  const handlePagamentoChange = useCallback((index, field, value) => {
    setPagamentos(prev => {
      const novos = [...prev];
      novos[index] = { ...novos[index], [field]: value };
      return novos;
    });
  }, []);

  const addPagamento = useCallback(() => {
    setPagamentos(prev => [...prev, { pessoa: proprietarioPadrao || '', valor: '', paymentTags: {}, parcelamento: null }]);
  }, [proprietarioPadrao]);

  const removePagamento = useCallback((index = null) => {
    setPagamentos(prev => {
      if (prev.length <= 1) return prev;
      if (index !== null && index !== undefined) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.slice(0, -1);
    });
  }, []);

  const splitEqually = useCallback(() => {
    setPagamentos(prev => {
      if (prev.length === 0) return prev;
      const total = valorEsperadoParaSoma;
      if (total <= 0 || prev.length === 1) return prev;
      const share = Math.floor((total / prev.length) * 100) / 100;
      const remainder = Math.round((total - share * (prev.length - 1)) * 100) / 100;
      return prev.map((p, i) => ({
        ...p,
        valor: String(i === prev.length - 1 ? remainder : share)
      }));
    });
  }, [valorEsperadoParaSoma]);

  const splitInto = useCallback((totalParts) => {
    setPagamentos(prev => {
      const n = Math.max(2, Math.min(20, totalParts));
      const total = valorEsperadoParaSoma;
      if (total <= 0) return prev;
      const share = Math.floor((total / n) * 100) / 100;
      const remainder = Math.round((total - share * (n - 1)) * 100) / 100;
      const pessoa = prev[0]?.pessoa || proprietarioPadrao || '';
      const tags = prev[0]?.paymentTags || {};
      const newPayments = [];
      for (let i = 0; i < n; i++) {
        newPayments.push({
          pessoa,
          valor: String(i === n - 1 ? remainder : share),
          paymentTags: i === 0 ? { ...tags } : {},
          parcelamento: null
        });
      }
      return newPayments;
    });
  }, [valorEsperadoParaSoma, proprietarioPadrao]);

  const clearPaymentTags = useCallback((index) => {
    setPagamentos(prev => {
      if (!prev[index]) return prev;
      const novos = [...prev];
      novos[index] = { ...novos[index], paymentTags: {} };
      return novos;
    });
  }, []);

  const duplicatePagamento = useCallback((index) => {
    setPagamentos(prev => {
      const source = prev[index];
      if (!source) return prev;
      const copy = { ...source, paymentTags: { ...(source.paymentTags || {}) }, parcelamento: null };
      const novos = [...prev];
      novos.splice(index + 1, 0, copy);
      return novos;
    });
  }, []);

  const isValid = useCallback(() => {
    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return Math.abs(valorEsperadoParaSoma - soma) <= 0.01;
  }, [pagamentos, valorEsperadoParaSoma]);

  const buildPagamentosPayload = useCallback(() => {
    return pagamentos
      .filter(p => p.pessoa && p.pessoa.trim() !== '')
      .map(p => {
        const payload = {
          pessoa: p.pessoa,
          valor: parseFloat(p.valor) || 0,
          tags: p.paymentTags || {}
        };

        if (p.parcelamento?.ativo) {
          payload.parcelamento = {
            ativo: true,
            quantidade: parseInt(p.parcelamento.quantidade, 10) || 2,
            intervaloDias: parseInt(p.parcelamento.intervaloDias, 10) || 30
          };
        }

        return payload;
      });
  }, [pagamentos]);

  return {
    pagamentos,
    setPagamentos,
    handlePagamentoChange,
    addPagamento,
    removePagamento,
    splitEqually,
    splitInto,
    clearPaymentTags,
    duplicatePagamento,
    isValid,
    showValidationWarning,
    valorEsperadoParaSoma,
    buildPagamentosPayload,
    isPagamentoParcelado
  };
}
