import { useState, useEffect, useCallback } from 'react';

export default function usePagamentos({ transacao, proprietarioPadrao, valorTotal, isParcelado, isContaConjunta, pagoPor, parteUsuario }) {
  const [pagamentos, setPagamentos] = useState(() => {
    if (transacao?.pagamentos?.length > 0) {
      return transacao.pagamentos.map(p => ({
        ...p,
        paymentTags: p.tags || {}
      }));
    }
    return [{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }];
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
          paymentTags: p.tags || {}
        }))
      );
    } else if (!transacao) {
      setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
    }
  }, [transacao, proprietarioPadrao]);

  useEffect(() => {
    if (isParcelado && !transacao) {
      const expectedValor = valorTotal || '';
      setPagamentos(prev => {
        const current = prev[0];
        if (!current || String(current.valor) !== String(expectedValor)) {
          const pessoa = current?.pessoa || proprietarioPadrao || '';
          const tags = current?.paymentTags || {};
          return [{ pessoa, valor: expectedValor, paymentTags: tags }];
        }
        return prev;
      });
    }
  }, [isParcelado, transacao, valorTotal, proprietarioPadrao]);

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
    setPagamentos(prev => [...prev, { pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
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
          paymentTags: i === 0 ? { ...tags } : {}
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
      const copy = { ...source, paymentTags: { ...(source.paymentTags || {}) } };
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
    return pagamentos.map(p => ({
      pessoa: p.pessoa,
      valor: parseFloat(p.valor),
      tags: p.paymentTags
    }));
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
    buildPagamentosPayload
  };
}
