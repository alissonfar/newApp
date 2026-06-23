// src/hooks/useEmprestimoForm.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { listarPessoas, listarEmprestimos } from '../api';

export default function useEmprestimoForm({ transacao, tipoTransacao, valorTotal }) {
  const [ativo, setAtivo] = useState(false);
  const [modo, setModo] = useState('vincular');
  const [pessoaId, setPessoaId] = useState('');
  const [emprestimoId, setEmprestimoId] = useState('');
  const [novoPrazoFinal, setNovoPrazoFinal] = useState('');
  const [novoTipoRetorno, setNovoTipoRetorno] = useState('valor_fixo');
  const [novoValorEsperado, setNovoValorEsperado] = useState(() => {
    if (valorTotal && !isNaN(parseFloat(valorTotal))) return String(parseFloat(valorTotal));
    return '';
  });

  const [pessoas, setPessoas] = useState([]);
  const [emprestimosPessoa, setEmprestimosPessoa] = useState([]);
  const [loadingPessoas, setLoadingPessoas] = useState(false);
  const [loadingEmprestimos, setLoadingEmprestimos] = useState(false);

  useEffect(() => {
    if (transacao?.emprestimoId) {
      setAtivo(true);
      setModo('vincular');
      const id = typeof transacao.emprestimoId === 'object'
        ? (transacao.emprestimoId._id || transacao.emprestimoId.id)
        : transacao.emprestimoId;
      setEmprestimoId(id);
    }
  }, [transacao]);

  useEffect(() => {
    if (!ativo) return;
    setLoadingPessoas(true);
    listarPessoas(true)
      .then(setPessoas)
      .catch(() => setPessoas([]))
      .finally(() => setLoadingPessoas(false));
  }, [ativo]);

  useEffect(() => {
    if (!ativo || !pessoaId || modo !== 'vincular') {
      setEmprestimosPessoa([]);
      return;
    }
    setLoadingEmprestimos(true);
    listarEmprestimos({ pessoaId, status: 'ativo' })
      .then((lista) => {
        const normalizada = (lista || []).map((e) => ({
          ...e,
          id: e._id || e.id,
          pessoaId: typeof e.pessoaId === 'object' ? e.pessoaId._id : e.pessoaId
        }));
        setEmprestimosPessoa(normalizada);
      })
      .catch(() => setEmprestimosPessoa([]))
      .finally(() => setLoadingEmprestimos(false));
  }, [ativo, pessoaId, modo]);

  useEffect(() => {
    if (!ativo || modo !== 'vincular') {
      setEmprestimoId('');
    }
  }, [modo, ativo]);

  const reset = useCallback(() => {
    setAtivo(false);
    setModo('vincular');
    setPessoaId('');
    setEmprestimoId('');
    setNovoPrazoFinal('');
    setNovoTipoRetorno('valor_fixo');
    setNovoValorEsperado(valorTotal ? String(parseFloat(valorTotal)) : '');
    setEmprestimosPessoa([]);
  }, [valorTotal]);

  const adicionarPessoa = useCallback((pessoa) => {
    setPessoas((prev) => {
      const semDuplicado = prev.filter((p) => p._id !== pessoa._id);
      return [...semDuplicado, pessoa];
    });
    setPessoaId(pessoa._id);
  }, []);

  const validar = useCallback(() => {
    if (!ativo) return null;
    if (!pessoaId) return 'Selecione uma pessoa para o empréstimo.';
    if (modo === 'vincular') {
      if (!emprestimoId) return 'Selecione um empréstimo para vincular.';
    } else {
      if (!novoPrazoFinal) return 'Informe o prazo final do novo empréstimo.';
      const v = parseFloat(novoValorEsperado);
      if (!novoValorEsperado || isNaN(v) || v < 0) {
        return 'Informe o valor esperado de retorno (≥ 0).';
      }
    }
    return null;
  }, [ativo, pessoaId, modo, emprestimoId, novoPrazoFinal, novoValorEsperado]);

  const avisoEmprestimoSemDesembolso = useMemo(() => {
    if (!ativo || modo !== 'vincular' || !emprestimoId) return null;
    if (tipoTransacao !== 'recebivel') return null;
    const emp = emprestimosPessoa.find((e) => e.id === emprestimoId || e._id === emprestimoId);
    if (!emp) return null;
    const desembolso = Number(emp.totalDisbursed) || 0;
    if (desembolso > 0) return null;
    return 'Este empréstimo não tem desembolso registrado. O valor recebido será contabilizado inteiramente como juros.';
  }, [ativo, modo, emprestimoId, tipoTransacao, emprestimosPessoa]);

  return {
    state: {
      ativo,
      modo,
      pessoaId,
      emprestimoId,
      novoPrazoFinal,
      novoTipoRetorno,
      novoValorEsperado,
      pessoas,
      emprestimosPessoa,
      loadingPessoas,
      loadingEmprestimos
    },
    setters: {
      setAtivo,
      setModo,
      setPessoaId,
      setEmprestimoId,
      setNovoPrazoFinal,
      setNovoTipoRetorno,
      setNovoValorEsperado
    },
    adicionarPessoa,
    reset,
    validar,
    avisoEmprestimoSemDesembolso
  };
}
