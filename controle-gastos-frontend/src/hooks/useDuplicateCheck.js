import { useState, useEffect, useRef } from 'react';
import { obterTransacoes } from '../api';

export default function useDuplicateCheck({ descricao, data, valorTotal, enabled }) {
  const [isDuplicate, setIsDuplicate] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !descricao || !data) {
      setIsDuplicate(null);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const result = await obterTransacoes({
          search: descricao,
          dataInicio: data,
          dataFim: data,
          limit: 5
        });

        const transacoes = result?.transacoes || [];
        if (transacoes.length === 0) {
          setIsDuplicate(false);
        } else {
          const valor = parseFloat(valorTotal || 0);
          const similar = transacoes.find(t => t.descricao.toLowerCase() === descricao.toLowerCase() || (valor > 0 && Math.abs(t.valor - valor) < 0.02));
          setIsDuplicate(similar ? { count: transacoes.length, similar: similar.descricao } : false);
        }
      } catch {
        setIsDuplicate(null);
      } finally {
        setIsChecking(false);
      }
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [descricao, data, valorTotal, enabled]);

  return { isDuplicate, isChecking };
}
