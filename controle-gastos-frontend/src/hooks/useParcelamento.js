import { useState, useEffect, useCallback } from 'react';
import { obterPreviewParcelas } from '../api';

export default function useParcelamento({ valorTotal, data, transacao, mostrarParcelamentoEmEdicao }) {
  const [isParcelado, setIsParcelado] = useState(() => {
    if (transacao?.isInstallment && transacao?.installmentTotal) return true;
    return false;
  });
  const [totalParcelas, setTotalParcelas] = useState(() => {
    if (transacao?.isInstallment && transacao?.installmentTotal) return String(transacao.installmentTotal);
    return '2';
  });
  const [intervaloDias, setIntervaloDias] = useState(() => {
    if (transacao?.isInstallment) return String(transacao.installmentIntervalDays || (transacao.installmentIntervalMonths || 1) * 30 || 30);
    return '30';
  });
  const [previewParcelas, setPreviewParcelas] = useState(null);

  useEffect(() => {
    if (transacao?.isInstallment && transacao?.installmentTotal) {
      setIsParcelado(true);
      setTotalParcelas(String(transacao.installmentTotal));
      setIntervaloDias(String(transacao.installmentIntervalDays || (transacao.installmentIntervalMonths || 1) * 30 || 30));
    } else if (transacao) {
      setIsParcelado(false);
      setTotalParcelas('2');
      setIntervaloDias('30');
    }
  }, [transacao]);

  useEffect(() => {
    const deveMostrarPreview = isParcelado && (!transacao || mostrarParcelamentoEmEdicao);
    if (!deveMostrarPreview) {
      setPreviewParcelas(null);
      return;
    }
    const numParcelas = parseInt(totalParcelas, 10) || 2;
    const intervalDays = parseInt(intervaloDias, 10) || 30;
    const valorParcelaOuTotal = parseFloat(valorTotal) || 0;
    const valorEhParcela = transacao?.valorEhTotalNaImportacao === false;
    const valorTotalParaPreview = (transacao && transacao.isInstallment && valorEhParcela)
      ? valorParcelaOuTotal * numParcelas
      : valorParcelaOuTotal;
    let startDateParaPreview = data;
    if (transacao && transacao.isInstallment && transacao.installmentNumber > 1 && data) {
      const [y, m, d] = data.split('-').map(Number);
      const dataParcelaAtual = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
      const diffDias = (transacao.installmentNumber - 1) * intervalDays;
      dataParcelaAtual.setUTCDate(dataParcelaAtual.getUTCDate() - diffDias);
      startDateParaPreview = dataParcelaAtual.toISOString().split('T')[0];
    }
    if (numParcelas < 2 || intervalDays < 1 || valorTotalParaPreview <= 0 || !data) {
      setPreviewParcelas(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const resultado = await obterPreviewParcelas({
          totalAmount: valorTotalParaPreview,
          totalInstallments: numParcelas,
          intervalInDays: intervalDays,
          startDate: startDateParaPreview
        });
        if (resultado.erro) {
          setPreviewParcelas(null);
        } else {
          setPreviewParcelas(resultado);
        }
      } catch {
        setPreviewParcelas(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isParcelado, totalParcelas, intervaloDias, valorTotal, data, transacao, mostrarParcelamentoEmEdicao]);

  const toggle = useCallback((checked) => {
    setIsParcelado(checked);
  }, []);

  const buildPayload = useCallback(() => {
    if (!isParcelado && !transacao) return null;
    const numParcelas = parseInt(totalParcelas, 10) || 2;
    const intervalDays = parseInt(intervaloDias, 10) || 30;
    const parcelasValidas = numParcelas >= 2 && numParcelas <= 60;
    const intervaloValido = intervalDays >= 1 && intervalDays <= 365;
    const ehParcelado = isParcelado && !transacao && parcelasValidas && intervaloValido;
    const ehParceladoNaEdicao = mostrarParcelamentoEmEdicao && isParcelado && parcelasValidas && intervaloValido;
    if (ehParcelado || ehParceladoNaEdicao) {
      return {
        isInstallment: true,
        totalInstallments: numParcelas,
        installmentIntervalDays: parseInt(intervaloDias, 10) || 30
      };
    }
    return null;
  }, [isParcelado, totalParcelas, intervaloDias, transacao, mostrarParcelamentoEmEdicao]);

  const reset = useCallback(() => {
    setIsParcelado(false);
    setTotalParcelas('2');
    setIntervaloDias('30');
    setPreviewParcelas(null);
  }, []);

  const showInForm = !transacao || mostrarParcelamentoEmEdicao;

  return {
    state: { isParcelado, totalParcelas, intervaloDias, previewParcelas, showInForm },
    setters: { setIsParcelado: toggle, setTotalParcelas, setIntervaloDias },
    buildPayload,
    reset
  };
}
