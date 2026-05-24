import { useState, useEffect, useCallback, useMemo } from 'react';
import { listarVinculosConjuntos } from '../api';

export default function useContaConjunta({ transacao }) {
  const [isContaConjunta, setIsContaConjunta] = useState(false);
  const [vinculos, setVinculos] = useState([]);
  const [vinculoId, setVinculoId] = useState('');
  const [pagoPor, setPagoPor] = useState('usuario');
  const [valorTotalCompra, setValorTotalCompra] = useState('');
  const [parteUsuario, setParteUsuario] = useState('');

  useEffect(() => {
    if (isContaConjunta) {
      listarVinculosConjuntos().then(setVinculos).catch(() => setVinculos([]));
    }
  }, [isContaConjunta]);

  useEffect(() => {
    if (transacao?.contaConjunta?.ativo) {
      setIsContaConjunta(true);
      setVinculoId(transacao.contaConjunta.vinculoId?._id || transacao.contaConjunta.vinculoId || '');
      setPagoPor(transacao.contaConjunta.pagoPor || 'usuario');
      setValorTotalCompra(String(transacao.contaConjunta.valorTotal || transacao.valor));
      setParteUsuario(String(transacao.contaConjunta.parteUsuario ?? transacao.valor));
    } else if (transacao) {
      setIsContaConjunta(false);
      setVinculoId('');
      setPagoPor('usuario');
      setValorTotalCompra('');
      setParteUsuario('');
    }
  }, [transacao]);

  const parteOutro = useMemo(() => {
    const vTotal = pagoPor === 'outro'
      ? parseFloat(valorTotalCompra || 0)
      : parseFloat(transacao ? String(transacao.valor) : '0') || 0;
    const pUsuario = parseFloat(parteUsuario || 0);
    const pOutro = Math.round((vTotal - pUsuario) * 100) / 100;
    return pOutro;
  }, [pagoPor, valorTotalCompra, parteUsuario, transacao]);

  const toggle = useCallback((checked) => {
    setIsContaConjunta(checked);
    if (!checked) {
      setVinculoId('');
      setPagoPor('usuario');
      setValorTotalCompra('');
      setParteUsuario('');
    }
  }, []);

  const validateContaConjunta = useCallback((valorTotalAtual) => {
    if (!isContaConjunta) return null;
    if (!vinculoId) return 'Selecione um vínculo para conta conjunta.';
    const vTotal = pagoPor === 'outro' ? parseFloat(valorTotalCompra) || 0 : parseFloat(valorTotalAtual) || 0;
    const pUsuario = parseFloat(parteUsuario || (pagoPor === 'outro' ? valorTotalAtual : valorTotalAtual)) || 0;
    const pOutro = vTotal - pUsuario;
    if (Math.abs(pUsuario + pOutro - vTotal) > 0.01) {
      return 'Minha parte + parte do outro deve ser igual ao valor total.';
    }
    if (vTotal <= 0) {
      return 'Valor total deve ser maior que zero.';
    }
    return null;
  }, [isContaConjunta, vinculoId, pagoPor, valorTotalCompra, parteUsuario]);

  const getValorFinal = useCallback((valorTotalAtual) => {
    if (!isContaConjunta || !vinculoId) return parseFloat(valorTotalAtual);
    const vTotal = pagoPor === 'outro'
      ? parseFloat(valorTotalCompra) || 0
      : parseFloat(valorTotalAtual) || 0;
    const pUsuario = parseFloat(parteUsuario || valorTotalAtual) || 0;
    return pagoPor === 'outro' ? pUsuario : vTotal;
  }, [isContaConjunta, vinculoId, pagoPor, valorTotalCompra, parteUsuario]);

  const buildPayload = useCallback((valorTotalAtual) => {
    if (!isContaConjunta || !vinculoId) return null;
    const vTotal = pagoPor === 'outro'
      ? parseFloat(valorTotalCompra) || 0
      : parseFloat(valorTotalAtual) || 0;
    const pUsuario = parseFloat(parteUsuario || valorTotalAtual) || 0;
    const pOutro = Math.round((vTotal - pUsuario) * 100) / 100;
    return {
      ativo: true,
      vinculoId,
      pagoPor,
      valorTotal: vTotal,
      parteUsuario: pUsuario,
      parteOutro: pOutro
    };
  }, [isContaConjunta, vinculoId, pagoPor, valorTotalCompra, parteUsuario]);

  const handleParteUsuarioChange = useCallback((raw, setValorTotal) => {
    setParteUsuario(raw);
    if (pagoPor === 'outro' && setValorTotal) {
      setValorTotal(raw);
    }
  }, [pagoPor]);

  const reset = useCallback(() => {
    setIsContaConjunta(false);
    setVinculoId('');
    setPagoPor('usuario');
    setValorTotalCompra('');
    setParteUsuario('');
  }, []);

  return {
    state: { isContaConjunta, vinculoId, pagoPor, valorTotalCompra, parteUsuario, vinculos },
    setters: { setVinculoId, setPagoPor, setValorTotalCompra, setParteUsuario },
    toggle,
    parteOutro,
    validateContaConjunta,
    getValorFinal,
    buildPayload,
    handleParteUsuarioChange,
    reset
  };
}
