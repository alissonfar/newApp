import { useState, useEffect, useCallback } from 'react';
import patrimonioApi from '../services/patrimonioApi';

/**
 * Hook para obter dados da taxa CDI atual.
 * Faz uma única chamada ao montar e expõe refetch para atualização manual.
 * @returns {{ cdi: object|null, loading: boolean, error: string|null, refetch: function }}
 */
function useCdiData() {
  const [cdi, setCdi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCdi = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await patrimonioApi.obterTaxaCDI(forceRefresh);
      const taxa = response?.taxa ?? null;
      setCdi(taxa);
      if (!taxa) {
        setError(response?.mensagem || 'Taxa CDI não disponível.');
      }
    } catch (err) {
      setCdi(null);
      setError(err.message || 'Erro ao carregar taxa CDI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCdi(false);
  }, [fetchCdi]);

  const refetch = useCallback(() => {
    fetchCdi(true);
  }, [fetchCdi]);

  return { cdi, loading, error, refetch };
}

export default useCdiData;
