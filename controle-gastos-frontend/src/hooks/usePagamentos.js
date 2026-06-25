import { useState, useEffect, useCallback, useMemo } from 'react';

const empFieldsPadrao = () => ({
  empAtivo: false,
  empPessoaId: '',
  empModo: 'vincular',
  empNovoTipoRetorno: 'valor_fixo',
  empNovoPrazoFinal: '',
  empNovoValorEsperado: '',
  empEmprestimosPessoa: [],
  empLoadingEmprestimos: false
});

export default function usePagamentos({ transacao, proprietarioPadrao, valorTotal, isContaConjunta, pagoPor, parteUsuario, parcelamentos }) {
  const [pagamentos, setPagamentos] = useState(() => {
    if (transacao?.pagamentos?.length > 0) {
      return transacao.pagamentos.map(p => ({
        ...p,
        paymentTags: p.tags || {},
        parcelamento: p.parcelamento || null,
        installmentNumber: p.installmentNumber || null,
        installmentTotal: p.installmentTotal || null,
        // Vínculo pagamento-level de Empréstimo (caminho novo). Mutuamente
        // exclusivo com `transacao.emprestimoId` (caminho legado).
        emprestimoId: p.emprestimoId || null,
        // Campos da suíte de Empréstimo por pagamento (caminho novo,
        // 2+ pagamentos). Pré-popula a partir do vínculo salvo.
        ...empFieldsPadrao(),
        empAtivo: !!p.emprestimoId,
        empPessoaId: p.emprestimoPessoaId || '',
        empModo: p.emprestimoModo || 'vincular',
        empNovoTipoRetorno: p.emprestimoTipoRetorno || 'valor_fixo',
        empNovoPrazoFinal: p.emprestimoPrazoFinal || '',
        empNovoValorEsperado: p.emprestimoValorEsperado != null ? String(p.emprestimoValorEsperado) : '',
        fixed: false
      }));
    }
    return [{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {}, parcelamento: null, emprestimoId: null, ...empFieldsPadrao(), fixed: false }];
  });

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
          installmentTotal: p.installmentTotal || null,
          emprestimoId: p.emprestimoId || null,
          ...empFieldsPadrao(),
          empAtivo: !!p.emprestimoId,
          empPessoaId: p.emprestimoPessoaId || '',
          empModo: p.emprestimoModo || 'vincular',
          empNovoTipoRetorno: p.emprestimoTipoRetorno || 'valor_fixo',
          empNovoPrazoFinal: p.emprestimoPrazoFinal || '',
          empNovoValorEsperado: p.emprestimoValorEsperado != null ? String(p.emprestimoValorEsperado) : '',
          fixed: false
        }))
      );
    } else if (!transacao) {
      setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {}, parcelamento: null, emprestimoId: null, ...empFieldsPadrao(), fixed: false }]);
    }
  }, [transacao, proprietarioPadrao]);

  const isPagamentoParcelado = useCallback((index) => {
    const conf = parcelamentos && parcelamentos[index];
    return !!(conf?.ativo) || !!(pagamentos[index]?.parcelamento?.ativo);
  }, [parcelamentos, pagamentos]);

  const soma = useMemo(() => {
    return pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }, [pagamentos]);

  const saldoRestante = useMemo(() => {
    return Math.max(0, valorEsperadoParaSoma - soma);
  }, [valorEsperadoParaSoma, soma]);

  const showValidationWarning = valorEsperadoParaSoma > 0 && Math.abs(valorEsperadoParaSoma - soma) > 0.01;

  const handlePagamentoChange = useCallback((index, field, value) => {
    setPagamentos(prev => {
      const novos = [...prev];
      novos[index] = { ...novos[index], [field]: value };
      return novos;
    });
  }, []);

  const addPagamento = useCallback(() => {
    setPagamentos(prev => [...prev, { pessoa: proprietarioPadrao || '', valor: '', paymentTags: {}, parcelamento: null, emprestimoId: null, ...empFieldsPadrao(), fixed: false }]);
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
          parcelamento: null,
          emprestimoId: null,
          ...empFieldsPadrao(),
          fixed: false
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
      const copy = { ...source, paymentTags: { ...(source.paymentTags || {}) }, parcelamento: null, ...empFieldsPadrao(), fixed: false };
      const novos = [...prev];
      novos.splice(index + 1, 0, copy);
      return novos;
    });
  }, []);

  /**
   * Seta o `emprestimoId` em um pagamento específico (caminho novo).
   * Use `null` para desvincular. Validação de exclusividade mútua com
   * o TX-level emprestimoId é feita no submit do form.
   *
   * Mantida por compatibilidade (fluxo antigo: user escolhia empréstimo
   * direto). O fluxo novo (suíte rica por pagamento) usa
   * `onPagamentoEmprestimoFieldChange` + `setPagamentoEmprestimoIdByField`
   * (abaixo) e o `NovaTransacaoForm.handleSubmit` cria o Empréstimo via
   * `criarEmprestimo` antes de salvar a TX.
   */
  const setPagamentoEmprestimoId = useCallback((index, empId) => {
    setPagamentos(prev => {
      if (!prev[index]) return prev;
      const novos = [...prev];
      novos[index] = { ...novos[index], emprestimoId: empId || null };
      return novos;
    });
  }, []);

  /**
   * Atualiza qualquer campo da suíte de Empréstimo de um pagamento
   * específico. Usado pelo `EmprestimoFormFields` aninhado na
   * `TabPagamentos`. Quando o user desmarca `empAtivo`, limpa o resto
   * da suíte E o `emprestimoId` final do payload.
   *
   * `field` é SEM prefixo `emp` (ex: 'pessoaId', 'modo', 'emprestimoId',
   * 'novoTipoRetorno', 'novoPrazoFinal', 'novoValorEsperado', 'ativo').
   * A função prefixa internamente para casar com o state do pagamento.
   */
  const onPagamentoEmprestimoFieldChange = useCallback((index, field, value) => {
    setPagamentos(prev => {
      if (!prev[index]) return prev;
      const novos = [...prev];
      const current = novos[index];
      // Mapeia campo "legado" (sem prefixo) → campo do state (com prefixo emp)
      const stateField = field === 'ativo' ? 'empAtivo'
        : field === 'pessoaId' ? 'empPessoaId'
        : field === 'modo' ? 'empModo'
        : field === 'emprestimoId' ? 'emprestimoId' // já é o do payload
        : field === 'novoTipoRetorno' ? 'empNovoTipoRetorno'
        : field === 'novoPrazoFinal' ? 'empNovoPrazoFinal'
        : field === 'novoValorEsperado' ? 'empNovoValorEsperado'
        : field;
      const next = { ...current, [stateField]: value };
      // Toggle off da suíte → limpa tudo (estado consistente)
      if (field === 'ativo' && !value) {
        Object.assign(next, empFieldsPadrao(), { fixed: current.fixed });
      } else if (field === 'pessoaId') {
        // Trocou de pessoa → limpa lista cacheada e o empréstimo vinculado
        next.empEmprestimosPessoa = [];
        next.emprestimoId = null;
      } else if (field === 'modo' && value === 'vincular') {
        // Voltou para vincular → limpa campos de "criar"
        next.empNovoTipoRetorno = 'valor_fixo';
        next.empNovoPrazoFinal = '';
      } else if (field === 'modo' && value === 'criar') {
        // Mudou para criar → limpa o empréstimo vinculado (vai ser
        // criado pelo NovaTransacaoForm.handleSubmit)
        next.emprestimoId = null;
      }
      novos[index] = next;
      return novos;
    });
  }, []);

  /**
   * Seta o resultado de carregar a lista de Empréstimos para o pagamento
   * `index` filtrado por pessoa. Chamado pelo `TabPagamentos` quando o
   * pai resolve `listarEmprestimos({ pessoaId, status: 'ativo' })`.
   */
  const setPagamentoEmprestimosPessoa = useCallback((index, lista) => {
    setPagamentos(prev => {
      if (!prev[index]) return prev;
      const novos = [...prev];
      novos[index] = {
        ...novos[index],
        empEmprestimosPessoa: lista || [],
        empLoadingEmprestimos: false
      };
      return novos;
    });
  }, []);

  const setPagamentoEmprestimoLoading = useCallback((index, loading) => {
    setPagamentos(prev => {
      if (!prev[index]) return prev;
      const novos = [...prev];
      novos[index] = { ...novos[index], empLoadingEmprestimos: !!loading };
      return novos;
    });
  }, []);

  /** Retorna os índices de pagamentos que têm `emprestimoId` setado. */
  const getPagamentosComEmprestimo = useCallback(() => {
    return pagamentos
      .map((p, i) => (p && p.emprestimoId ? i : -1))
      .filter(i => i >= 0);
  }, [pagamentos]);

  const toggleFixed = useCallback((index) => {
    setPagamentos(prev => {
      if (!prev[index]) return prev;
      const novos = [...prev];
      novos[index] = { ...novos[index], fixed: !novos[index].fixed };
      return novos;
    });
  }, []);

  const fillRemaining = useCallback((index) => {
    setPagamentos(prev => {
      if (!prev[index]) return prev;
      const sum = prev.reduce((acc, pag) => {
        const v = parseFloat(pag.valor || 0);
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
      const restante = valorEsperadoParaSoma - sum + (parseFloat(prev[index].valor || 0) || 0);
      const rounded = Math.max(0, Math.round(restante * 100) / 100);
      const novos = [...prev];
      novos[index] = { ...novos[index], valor: String(rounded) };
      return novos;
    });
  }, [valorEsperadoParaSoma]);

  const distributeRemaining = useCallback(() => {
    setPagamentos(prev => {
      const fixedSum = prev.reduce((acc, p) => {
        return p.fixed ? acc + (parseFloat(p.valor || 0) || 0) : acc;
      }, 0);
      const remaining = Math.max(0, valorEsperadoParaSoma - fixedSum);
      const nonFixed = prev.filter(p => !p.fixed);
      if (nonFixed.length === 0) return prev;
      const share = Math.floor((remaining / nonFixed.length) * 100) / 100;
      const remainder = Math.round((remaining - share * (nonFixed.length - 1)) * 100) / 100;
      let nfIdx = 0;
      return prev.map(p => {
        if (p.fixed) return p;
        const isLast = nfIdx === nonFixed.length - 1;
        nfIdx++;
        return { ...p, valor: String(isLast ? remainder : share) };
      });
    });
  }, [valorEsperadoParaSoma]);

  const isValid = useCallback(() => {
    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return Math.abs(valorEsperadoParaSoma - soma) <= 0.01;
  }, [pagamentos, valorEsperadoParaSoma]);

  /**
   * Validação leve do vínculo de Empréstimo por pagamento (caminho novo).
   * Retorna uma string de erro ou null. Critérios:
   *  - empAtivo + pessoaId obrigatório
   *  - modo 'vincular' + emprestimoId obrigatório
   *  - modo 'criar' + novoPrazoFinal obrigatório
   *  - tipoTransacao === 'gasto' + novoValorEsperado ≥ 0 obrigatório
   */
  const validarEmprestimos = useCallback((tipoTransacao) => {
    for (let i = 0; i < pagamentos.length; i++) {
      const p = pagamentos[i];
      if (!p.empAtivo) continue;
      if (!p.empPessoaId) return `Pagamento ${i + 1}: selecione uma pessoa para o empréstimo.`;
      if (p.empModo === 'vincular') {
        if (!p.emprestimoId) return `Pagamento ${i + 1}: selecione um empréstimo para vincular.`;
      } else {
        if (!p.empNovoPrazoFinal) return `Pagamento ${i + 1}: informe o prazo final do novo empréstimo.`;
      }
      if (tipoTransacao === 'gasto') {
        const v = parseFloat(p.empNovoValorEsperado);
        if (p.empNovoValorEsperado === '' || isNaN(v) || v < 0) {
          return `Pagamento ${i + 1}: informe o valor esperado de retorno (≥ 0).`;
        }
      }
    }
    return null;
  }, [pagamentos]);

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

        // Vínculo pagamento-level de Empréstimo (caminho novo).
        if (p.emprestimoId) {
          payload.emprestimoId = p.emprestimoId;
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
    toggleFixed,
    fillRemaining,
    distributeRemaining,
    setPagamentoEmprestimoId,
    onPagamentoEmprestimoFieldChange,
    setPagamentoEmprestimosPessoa,
    setPagamentoEmprestimoLoading,
    getPagamentosComEmprestimo,
    validarEmprestimos,
    isValid,
    showValidationWarning,
    valorEsperadoParaSoma,
    buildPagamentosPayload,
    isPagamentoParcelado,
    soma,
    saldoRestante
  };
}
