import { useState, useEffect, useCallback } from 'react';
import { obterTransacoes } from '../api';
import { toast } from 'react-toastify';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Hook customizado para gerenciar os dados do Dashboard
const useDashboardData = (proprietario, usuarioCarregado) => {
  const [transacoes, setTransacoes] = useState([]);
  const [resumoPeriodo, setResumoPeriodo] = useState({
    totalGastos: 0,
    totalRecebiveis: 0,
    saldo: 0
  });
  const [transacoesPorData, setTransacoesPorData] = useState({});
  const [dadosGrafico, setDadosGrafico] = useState({
    labels: [],
    datasets: [
      { label: 'Gastos', data: [], borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
      { label: 'Recebíveis', data: [], borderColor: 'rgb(75, 192, 192)', tension: 0.1 }
    ]
  });
  const [semDados, setSemDados] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(true); // Inicia como true
  const [proprietarioExibicao, setProprietarioExibicao] = useState('');
  const [periodoSelecionado, setPeriodoSelecionado] = useState('mesAtual');

  // Função para obter as datas de início e fim com base no período
  const getDatasPeriodo = useCallback((periodo) => {
    const hoje = new Date();
    switch (periodo) {
      case 'semanaAtual':
        return { inicio: startOfWeek(hoje, { locale: ptBR }), fim: endOfWeek(hoje, { locale: ptBR }) };
      case 'mesPassado':
        const mesAnterior = subMonths(hoje, 1);
        return { inicio: startOfMonth(mesAnterior), fim: endOfMonth(mesAnterior) };
      case 'anoAtual':
        return { inicio: startOfYear(hoje), fim: endOfYear(hoje) };
      case 'mesAtual':
      default:
        return { inicio: startOfMonth(hoje), fim: endOfMonth(hoje) };
    }
  }, []);

  // Função para calcular resumo e gráfico com base no período
  const calcularDadosDashboard = useCallback((transacoesFiltradas, periodo, proprietarioAtual) => {
    if (!proprietarioAtual) return; // Não calcula sem proprietário

    const { inicio, fim } = getDatasPeriodo(periodo);

    // Filtrar transações pelo período selecionado
    const transacoesPeriodo = transacoesFiltradas.filter(t => {
      const dataTransacao = new Date(t.data);
      const dataFimAjustada = new Date(fim);
      dataFimAjustada.setHours(23, 59, 59, 999);
      return dataTransacao >= inicio && dataTransacao <= dataFimAjustada;
    });

    // Calcular resumo do período
    const resumo = transacoesPeriodo.reduce((acc, t) => {
      // Tentativa de encontrar o valor específico para o proprietário no array de pagamentos
      const pagamentoProprietario = t.pagamentos?.find(p => p.pessoa && p.pessoa.toLowerCase() === proprietarioAtual.toLowerCase());
      const valorConsiderado = pagamentoProprietario?.valor ?? t.valor; // Usa valor do pagamento se existir, senão valor total
      
      if (t.tipo === 'gasto') {
        acc.totalGastos += valorConsiderado;
      } else {
        acc.totalRecebiveis += valorConsiderado;
      }
      return acc;
    }, { totalGastos: 0, totalRecebiveis: 0 });

    resumo.saldo = resumo.totalRecebiveis - resumo.totalGastos;
    setResumoPeriodo(resumo);

    // Calcular dados para o gráfico (mantendo últimos 6 meses)
    const ultimosMeses = [];
    const gastosUltimosMeses = [];
    const recebiveisUltimosMeses = [];

    for (let i = 5; i >= 0; i--) {
      const data = new Date();
      data.setMonth(data.getMonth() - i);
      const mes = format(data, 'MMM', { locale: ptBR });
      const ano = data.getFullYear();
      ultimosMeses.push(`${mes}/${ano}`);

      const transacoesMesGrafico = transacoesFiltradas.filter(t => {
        const dataTransacao = new Date(t.data);
        return dataTransacao.getMonth() === data.getMonth() &&
               dataTransacao.getFullYear() === data.getFullYear();
      });

      const gastosMes = transacoesMesGrafico
        .filter(t => t.tipo === 'gasto')
        .reduce((acc, t) => {
            const pagamentoProprietario = t.pagamentos?.find(p => p.pessoa && p.pessoa.toLowerCase() === proprietarioAtual.toLowerCase());
            return acc + (pagamentoProprietario?.valor ?? t.valor);
        }, 0);

      const recebiveisMes = transacoesMesGrafico
        .filter(t => t.tipo === 'recebivel')
         .reduce((acc, t) => {
            const pagamentoProprietario = t.pagamentos?.find(p => p.pessoa && p.pessoa.toLowerCase() === proprietarioAtual.toLowerCase());
            return acc + (pagamentoProprietario?.valor ?? t.valor);
        }, 0);

      gastosUltimosMeses.push(gastosMes);
      recebiveisUltimosMeses.push(recebiveisMes);
    }

    setDadosGrafico({
      labels: ultimosMeses,
      datasets: [
        { label: 'Gastos', data: gastosUltimosMeses, borderColor: 'rgb(255, 99, 132)', tension: 0.1 },
        { label: 'Recebíveis', data: recebiveisUltimosMeses, borderColor: 'rgb(75, 192, 192)', tension: 0.1 }
      ]
    });

     // Agrupar transações por data para o calendário (usa todas as transações)
     const porData = transacoesFiltradas.reduce((acc, t) => {
        const data = t.data.split('T')[0];
        if (!acc[data]) acc[data] = [];
        acc[data].push(t);
        return acc;
      }, {});
      setTransacoesPorData(porData);

  }, [getDatasPeriodo]); // Depende de getDatasPeriodo

  // Função para carregar transações - Usar useCallback para evitar recriação desnecessária
  const fetchTransacoes = useCallback(async () => {
    if (!proprietario || !usuarioCarregado) { // Só busca se tiver proprietário e usuário carregado
        // Se não tem proprietário, reseta estados e marca como não carregando
        if(!proprietario) {
            setTransacoes([]);
            setResumoPeriodo({ totalGastos: 0, totalRecebiveis: 0, saldo: 0 });
            setDadosGrafico({ labels: [], datasets: [] });
            setTransacoesPorData({});
            setSemDados(false); 
            setProprietarioExibicao('');
            setCarregandoDados(false); // Importante: indica que o carregamento (ou tentativa) terminou
        }
      return;
    }

    setCarregandoDados(true);
    setSemDados(false);

    try {
      const params = { proprietario };
      const response = await obterTransacoes(params);

      if (response.transacoes.length === 0) {
        setSemDados(true);
        setTransacoes([]);
        setResumoPeriodo({ totalGastos: 0, totalRecebiveis: 0, saldo: 0 });
        setDadosGrafico({ labels: [], datasets: [] });
        setTransacoesPorData({});
        setProprietarioExibicao(proprietario); // Usa o nome definido nas prefs
      } else {
        setSemDados(false);
        // Ordena as transações por data decrescente (mais recentes primeiro)
        const transacoesDoProprietario = response.transacoes.sort((a, b) => new Date(b.data) - new Date(a.data));
        setTransacoes(transacoesDoProprietario);

        // Tenta pegar nome capitalizado do primeiro pagamento encontrado
        const primeiroPagamento = transacoesDoProprietario.flatMap(t => t.pagamentos || []).find(p => p.pessoa);
        const nomeExibicao = primeiroPagamento?.pessoa || proprietario;
        setProprietarioExibicao(nomeExibicao);

        // Calcula os dados para o período padrão (mesAtual)
        calcularDadosDashboard(transacoesDoProprietario, periodoSelecionado, proprietario);
      }
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast.error('Erro ao carregar dados do dashboard');
      setSemDados(true);
      setTransacoes([]);
      setResumoPeriodo({ totalGastos: 0, totalRecebiveis: 0, saldo: 0 });
      setDadosGrafico({ labels: [], datasets: [] });
      setTransacoesPorData({});
      setProprietarioExibicao(proprietario); // Mesmo com erro, mostra o nome das prefs
    } finally {
      setCarregandoDados(false); // Finaliza o carregamento independentemente do resultado
    }
  }, [proprietario, usuarioCarregado, calcularDadosDashboard, periodoSelecionado]); // Adiciona periodoSelecionado como dependencia?
  // Não, periodoSelecionado não deve disparar fetch, apenas cálculo.

  // Efeito para buscar dados quando proprietario ou status de carregamento do usuário mudar
  useEffect(() => {
    fetchTransacoes();
  }, [fetchTransacoes]); // fetchTransacoes já tem proprietario e usuarioCarregado como deps

  // Efeito para recalcular quando o período selecionado mudar
  useEffect(() => {
    if (transacoes.length > 0 && !carregandoDados && proprietario) {
       // Recalcula APENAS se tiver transações, não estiver carregando e tiver proprietario
      calcularDadosDashboard(transacoes, periodoSelecionado, proprietario);
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoSelecionado, transacoes, proprietario]); // Recalcula se período, transações ou proprietário (caso recalcular seja necessário ao mudar proprietario também)
   // A dependência de transações aqui garante que rode após fetch inicial

  return {
    transacoes,
    resumoPeriodo,
    transacoesPorData,
    dadosGrafico,
    semDados,
    carregandoDados,
    proprietarioExibicao,
    periodoSelecionado,
    setPeriodoSelecionado, // Exporta a função para mudar o período
    fetchTransacoes // Exporta para permitir refresh manual se necessário
  };
};

export default useDashboardData; 