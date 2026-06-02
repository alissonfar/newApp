import { useState, useEffect, useCallback, useRef } from 'react';
import { obterPreviewParcelas } from '../api';

export default function useParcelamento({ valorTotal, data, transacao, mostrarParcelamentoEmEdicao }) {
  const [parcelamentos, setParcelamentos] = useState(() => {
    if (transacao?.pagamentos) {
      const init = {};
      transacao.pagamentos.forEach((p, i) => {
        if (p.parcelamento?.ativo || p.installmentNumber != null) {
          init[i] = {
            ativo: p.parcelamento?.ativo || !!(p.installmentNumber != null),
            quantidade: String(p.parcelamento?.quantidade || p.installmentTotal || 2),
            intervaloDias: String(p.parcelamento?.intervaloDias || 30)
          };
        }
      });
      return init;
    }
    return {};
  });

  const [previews, setPreviews] = useState({});
  const pagamentosRef = useRef([]);

  useEffect(() => {
    if (transacao?.pagamentos) {
      const init = {};
      transacao.pagamentos.forEach((p, i) => {
        if (p.parcelamento?.ativo || p.installmentNumber != null) {
          init[i] = {
            ativo: p.parcelamento?.ativo || !!(p.installmentNumber != null),
            quantidade: String(p.parcelamento?.quantidade || p.installmentTotal || 2),
            intervaloDias: String(p.parcelamento?.intervaloDias || 30)
          };
        }
      });
      setParcelamentos(init);
    } else if (transacao) {
      setParcelamentos({});
    }
  }, [transacao]);

  useEffect(() => {
    const timers = [];
    if (!data) return;

    Object.entries(parcelamentos).forEach(([indexStr, conf]) => {
      const index = parseInt(indexStr, 10);
      if (!conf?.ativo) return;

      const numParcelas = parseInt(conf.quantidade, 10) || 2;
      const intervalDays = parseInt(conf.intervaloDias, 10) || 30;
      if (numParcelas < 2 || intervalDays < 1) return;

      const timer = setTimeout(async () => {
        try {
          const pagamentosAtuais = pagamentosRef.current || [];

          const pagamentosParaPreview = pagamentosAtuais.map((p, i) => {
            const c = parcelamentos[i];
            if (c?.ativo && c.quantidade && parseInt(c.quantidade, 10) >= 2) {
              return {
                pessoa: p.pessoa,
                valor: parseFloat(p.valor) || 0,
                tags: p.paymentTags || {},
                parcelamento: {
                  ativo: true,
                  quantidade: parseInt(c.quantidade, 10) || 2,
                  intervaloDias: parseInt(c.intervaloDias, 10) || 30
                }
              };
            }
            return {
              pessoa: p.pessoa,
              valor: parseFloat(p.valor) || 0,
              tags: p.paymentTags || {}
            };
          });

          const resultado = await obterPreviewParcelas({
            totalAmount: 0,
            totalInstallments: 2,
            intervalInDays: 30,
            startDate: data,
            pagamentos: pagamentosParaPreview
          });

          setPreviews(prev => ({
            ...prev,
            [index]: resultado?.parcelas || null
          }));
        } catch {
          setPreviews(prev => ({ ...prev, [index]: null }));
        }
      }, 300);

      timers.push(timer);
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [parcelamentos, data]);

  const toggleParcelamento = useCallback((index, checked) => {
    setParcelamentos(prev => {
      if (checked) {
        return { ...prev, [index]: { ativo: true, quantidade: '2', intervaloDias: '30' } };
      }
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  }, []);

  const setParcelamentoField = useCallback((index, field, value) => {
    setParcelamentos(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value }
    }));
  }, []);

  const temAlgumParcelamento = Object.values(parcelamentos).some(c => c?.ativo);

  const reset = useCallback(() => {
    setParcelamentos({});
    setPreviews({});
  }, []);

  const showInForm = !transacao || mostrarParcelamentoEmEdicao;

  return {
    state: { parcelamentos, previews, showInForm, temAlgumParcelamento },
    toggleParcelamento,
    setParcelamentoField,
    pagamentosRef,
    reset
  };
}
