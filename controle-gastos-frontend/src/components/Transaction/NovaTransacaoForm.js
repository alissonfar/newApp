// src/components/Transaction/NovaTransacaoForm.js

import React, { useEffect, useState, useRef } from 'react';
import Select from 'react-select'; // Import do React-Select
import { toast } from 'react-toastify'; // Import do toast do React Toastify
import { Tooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { criarTransacao, atualizarTransacao, obterPreviewParcelas, listarVinculosConjuntos } from '../../api';
import { useData } from '../../context/DataContext';
import patrimonioApi from '../../services/patrimonioApi';
import IconRenderer from '../shared/IconRenderer';
import SubcontaSelect from '../shared/SubcontaSelect';
import './NovaTransacaoForm.css';
import { getTodayBR, getYesterdayBR, toISOStringBR, formatDateBR } from '../../utils/dateUtils';

// Componente do Modal de Atalhos
const ShortcutsHelp = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="shortcuts-help-overlay" onClick={onClose}>
      <div className="shortcuts-help-content" onClick={e => e.stopPropagation()}>
        <h3>Atalhos de Teclado</h3>
        <div className="shortcuts-list">
          <div className="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Space</kbd>
            <span>Salvar e Continuar</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
            <span>Salvar e Fechar</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>H</kbd>
            <span>Definir data como Hoje</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>Y</kbd>
            <span>Definir data como Ontem</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>P</kbd>
            <span>Adicionar novo pagamento</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>R</kbd>
            <span>Remover último pagamento</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>D</kbd>
            <span>Focar na Descrição</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>V</kbd>
            <span>Focar no Valor Total</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>T</kbd>
            <span>Focar no Tipo</span>
          </div>
          <div className="shortcut-item">
            <kbd>Esc</kbd>
            <span>Fechar modal</span>
          </div>
        </div>
        <button className="close-shortcuts-btn" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
};

const NovaTransacaoForm = ({ onSuccess, onClose, transacao, proprietarioPadrao = '', mostrarParcelamentoEmEdicao = false }) => {
  // Estados dos dados gerais
  const [_id, set_Id] = useState(transacao?._id);
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(transacao ? (typeof transacao.data === 'string' ? transacao.data.split('T')[0] : transacao.data instanceof Date ? transacao.data.toISOString().split('T')[0] : '') : '');
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  const [observacao, setObservacao] = useState(transacao ? transacao.observacao : '');
  
  // Novo estado para identificar se é uma transação importada
  const [isImportada, setIsImportada] = useState(transacao?.importacao ? true : false);
  const [importacaoId, setImportacaoId] = useState(transacao?.importacao || null);
  
  // Parcelamento (apenas para nova transação, não edição)
  const [isParcelado, setIsParcelado] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState('2');
  const [intervaloDias, setIntervaloDias] = useState('30');
  const [previewParcelas, setPreviewParcelas] = useState(null);
  
  // Pagamentos: usamos paymentTags para manipulação (mapeando p.tags do backend)
  const [pagamentos, setPagamentos] = useState(
    transacao && transacao.pagamentos && transacao.pagamentos.length > 0
      ? transacao.pagamentos.map(p => ({
          ...p,
          paymentTags: p.tags || {}
        }))
      : [{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]
  );
  
  // Obter categorias e tags do DataContext
  const { categorias, tags: allTags, loadingData, errorData } = useData();
  
  // Refs para focar e rolagem
  const tipoRef = useRef(null);
  const descricaoRef = useRef(null);
  const valorRef = useRef(null);
  
  // Adicionar estado para controlar a visibilidade do modal de atalhos
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Estado para mostrar aviso de validação (não-bloqueante)
  const [showValidationWarning, setShowValidationWarning] = useState(false);

  // Subconta (opcional) - vinculação ao módulo Patrimônio
  const [subcontas, setSubcontas] = useState([]);
  const [subconta, setSubconta] = useState('');

  // Conta Conjunta (opcional)
  const [isContaConjunta, setIsContaConjunta] = useState(false);
  const [vinculos, setVinculos] = useState([]);
  const [vinculoId, setVinculoId] = useState('');
  const [pagoPor, setPagoPor] = useState('usuario');
  const [valorTotalCompra, setValorTotalCompra] = useState('');
  const [parteUsuario, setParteUsuario] = useState('');
  
  // Removido handleFocus - causava scroll excessivo durante navegação rápida por teclado
  
  // Ajustar useEffect para setar data inicial quando não for edição
  useEffect(() => {
    if (!transacao) {
      setData(getTodayBR());
    }
    // A dependência [transacao] permanece para garantir que execute quando o modo muda
  }, [transacao]);

  // Carregar subcontas para o select opcional
  useEffect(() => {
    patrimonioApi.listarSubcontas().then(setSubcontas).catch(() => setSubcontas([]));
  }, []);

  // Carregar vínculos quando conta conjunta ativa
  useEffect(() => {
    if (isContaConjunta) {
      listarVinculosConjuntos().then(setVinculos).catch(() => setVinculos([]));
    }
  }, [isContaConjunta]);

  // Sincronizar subconta quando transacao mudar (edição)
  useEffect(() => {
    const scId = transacao?.subconta?._id || transacao?.subconta || '';
    setSubconta(scId);
  }, [transacao]);
  
  // Quando parcelado, manter único pagamento com valor = valorTotal (só atualiza quando necessário para evitar loop)
  useEffect(() => {
    if (isParcelado && !transacao) {
      const current = pagamentos[0];
      const expectedValor = valorTotal || '';
      if (!current || String(current.valor) !== String(expectedValor)) {
        const pessoa = current?.pessoa || proprietarioPadrao || '';
        const tags = current?.paymentTags || {};
        setPagamentos([{ pessoa, valor: expectedValor, paymentTags: tags }]);
      }
    }
  }, [isParcelado, transacao, pagamentos, valorTotal, proprietarioPadrao]);

  // Preview de parcelas (debounce 300ms) - funciona em criação e em edição (modal de importação)
  useEffect(() => {
    const deveMostrarPreview = isParcelado && (!transacao || mostrarParcelamentoEmEdicao);
    if (!deveMostrarPreview) {
      setPreviewParcelas(null);
      return;
    }
    const numParcelas = parseInt(totalParcelas, 10) || 2;
    const intervalDays = parseInt(intervaloDias, 10) || 30;
    const valorParcelaOuTotal = parseFloat(valorTotal) || 0;
    // Na importação: 1 linha = valor é total; N linhas = valor é parcela. No manual: valor é sempre total.
    const valorEhParcela = transacao?.valorEhTotalNaImportacao === false;
    const valorTotalParaPreview = (transacao && transacao.isInstallment && valorEhParcela)
      ? valorParcelaOuTotal * numParcelas
      : valorParcelaOuTotal;
    // Ao editar parcela: data é da parcela atual; calcular data inicial (1ª parcela)
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

  // Valor esperado para soma dos pagamentos (Conta Conjunta Fluxo B: parteUsuario)
  const valorEsperadoParaSoma = (isContaConjunta && pagoPor === 'outro')
    ? parseFloat(parteUsuario || 0)
    : parseFloat(valorTotal || 0);

  // Validação visual em tempo real (não-bloqueante)
  useEffect(() => {
    if (pagamentos.length === 0) {
      setShowValidationWarning(false);
      return;
    }
    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    const total = valorEsperadoParaSoma;
    const diferenca = Math.abs(total - soma);
    setShowValidationWarning(diferenca > 0.01);
  }, [valorTotal, parteUsuario, isContaConjunta, pagoPor, pagamentos, valorEsperadoParaSoma]);

  // Sempre que "transacao" mudar (modo edição), preenche os estados
  useEffect(() => {
    if (transacao) {
      set_Id(transacao._id);
      setTipo(transacao.tipo);
      setDescricao(transacao.descricao);
      setData(typeof transacao.data === 'string' ? transacao.data.split('T')[0] : transacao.data instanceof Date ? transacao.data.toISOString().split('T')[0] : '');
      setValorTotal(String(transacao.valor));
      setObservacao(transacao.observacao || '');
      
      // Atualiza os estados de importação
      setIsImportada(!!transacao.importacao);
      setImportacaoId(transacao.importacao || null);
      
      if (transacao.pagamentos && transacao.pagamentos.length > 0) {
        const pagamentosProcessados = transacao.pagamentos.map(p => ({
          pessoa: p.pessoa,
          valor: String(p.valor),
          paymentTags: p.tags || {}
        }));
        setPagamentos(pagamentosProcessados);
      } else {
        setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
      }
      if (transacao.isInstallment && transacao.installmentTotal) {
        setIsParcelado(true);
        setTotalParcelas(String(transacao.installmentTotal));
        setIntervaloDias(String(transacao.installmentIntervalDays || transacao.installmentIntervalMonths * 30 || 30));
      } else {
        setIsParcelado(false);
        setTotalParcelas('2');
        setIntervaloDias('30');
      }
      if (transacao.contaConjunta?.ativo) {
        setIsContaConjunta(true);
        setVinculoId(transacao.contaConjunta.vinculoId?._id || transacao.contaConjunta.vinculoId || '');
        setPagoPor(transacao.contaConjunta.pagoPor || 'usuario');
        setValorTotalCompra(String(transacao.contaConjunta.valorTotal || transacao.valor));
        setParteUsuario(String(transacao.contaConjunta.parteUsuario ?? transacao.valor));
      } else {
        setIsContaConjunta(false);
        setVinculoId('');
        setPagoPor('usuario');
        setValorTotalCompra('');
        setParteUsuario('');
      }
    }
  }, [transacao, proprietarioPadrao]);

  // Manipulação dos pagamentos
  const handlePagamentoChange = (index, field, value) => {
    const novosPagamentos = [...pagamentos];
    novosPagamentos[index][field] = value;
    setPagamentos(novosPagamentos);
  };
  
  const addPagamento = () => {
    setPagamentos([...pagamentos, { pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
  };
  
  const removePagamento = (index = null) => {
    if (pagamentos.length <= 1) return;

    if (index !== null && index !== undefined) {
      // Remove pagamento específico
      const novosPagamentos = pagamentos.filter((_, i) => i !== index);
      setPagamentos(novosPagamentos);
    } else {
      // Remove o último (comportamento do atalho Alt+R)
      setPagamentos(pagamentos.slice(0, -1));
    }
  };
  
  // Se houver apenas 1 pagamento, replica o valor total
  const handleValorTotalChange = (e) => {
    const raw = e.target.value;
    setValorTotal(raw);
    if (isContaConjunta && pagoPor === 'outro') {
      setParteUsuario(raw);
      if (pagamentos.length === 1) handlePagamentoChange(0, 'valor', raw);
    } else if (pagamentos.length === 1) {
      handlePagamentoChange(0, 'valor', raw);
    }
  };

  const handleParteUsuarioChange = (raw) => {
    setParteUsuario(raw);
    if (pagoPor === 'outro') {
      setValorTotal(raw);
      if (pagamentos.length === 1) {
        handlePagamentoChange(0, 'valor', raw);
      }
    }
  };
  
  // Validação: a soma dos pagamentos deve ser igual ao valor esperado (valor total ou parteUsuario em Fluxo B)
  const validatePagamentos = () => {
    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return Math.abs(valorEsperadoParaSoma - soma) <= 0.01;
  };
  
  // Ref para handleSubmit (evita dependência instável no useEffect de atalhos)
  const handleSubmitRef = useRef(null);

  // Atalhos de teclado consolidados
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.ctrlKey && e.keyCode === 32) {
        e.preventDefault();
        handleSubmitRef.current?.(new Event('submit'), false);
        return;
      }
      if (e.ctrlKey && e.keyCode === 13) {
        e.preventDefault();
        handleSubmitRef.current?.(new Event('submit'), true);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setData(getTodayBR());
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setData(getYesterdayBR());
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPagamentos(prev => [...prev, { pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setPagamentos(prev => (prev.length <= 1 ? prev : prev.slice(0, -1)));
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        descricaoRef.current?.focus();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        valorRef.current?.focus();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        tipoRef.current?.focus();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, proprietarioPadrao]);
  
  const setHoje = () => {
    setData(getTodayBR());
  };

  const setOntem = () => {
    setData(getYesterdayBR());
  };

  const handleSubmit = async (e, closeModal = true) => {
    e.preventDefault();

    if (!validatePagamentos()) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total da transação.');
      return;
    }
    if (isContaConjunta && !vinculoId) {
      toast.error('Selecione um vínculo para conta conjunta.');
      return;
    }
    if (isContaConjunta && vinculoId) {
      const vTotal = pagoPor === 'outro' ? parseFloat(valorTotalCompra) || 0 : parseFloat(valorTotal) || 0;
      const pUsuario = parseFloat(parteUsuario || (pagoPor === 'outro' ? valorTotal : valorTotal)) || 0;
      const pOutro = vTotal - pUsuario;
      if (Math.abs(pUsuario + pOutro - vTotal) > 0.01) {
        toast.error('Minha parte + parte do outro deve ser igual ao valor total.');
        return;
      }
      if (vTotal <= 0) {
        toast.error('Valor total deve ser maior que zero.');
        return;
      }
    }
    
    try {
      const numParcelas = parseInt(totalParcelas, 10) || 2;
      const intervalDays = parseInt(intervaloDias, 10) || 30;
      const parcelasValidas = numParcelas >= 2 && numParcelas <= 60;
      const intervaloValido = intervalDays >= 1 && intervalDays <= 365;
      const ehParcelado = isParcelado && !transacao && parcelasValidas && intervaloValido;
      const ehParceladoNaEdicao = mostrarParcelamentoEmEdicao && isParcelado && parcelasValidas && intervaloValido;

      let valorFinal = parseFloat(valorTotal);
      let contaConjuntaPayload = null;
      if (isContaConjunta && vinculoId) {
        const vTotal = pagoPor === 'outro'
          ? parseFloat(valorTotalCompra) || 0
          : parseFloat(valorTotal) || 0;
        const pUsuario = parseFloat(parteUsuario || valorTotal) || 0;
        const pOutro = Math.round((vTotal - pUsuario) * 100) / 100;
        contaConjuntaPayload = {
          ativo: true,
          vinculoId,
          pagoPor,
          valorTotal: vTotal,
          parteUsuario: pUsuario,
          parteOutro: pOutro
        };
        valorFinal = pagoPor === 'outro' ? pUsuario : vTotal;
      }

      const transacaoData = {
        _id,
        tipo,
        descricao,
        data: toISOStringBR(data),
        valor: valorFinal,
        observacao,
        pagamentos: pagamentos.map(p => ({
          pessoa: p.pessoa,
          valor: parseFloat(p.valor),
          tags: p.paymentTags
        }))
      };
      if (subconta) transacaoData.subconta = subconta;
      else transacaoData.subconta = null;
      if (contaConjuntaPayload) transacaoData.contaConjunta = contaConjuntaPayload;

      if (ehParcelado || ehParceladoNaEdicao) {
        transacaoData.isInstallment = true;
        transacaoData.totalInstallments = numParcelas;
        transacaoData.installmentIntervalDays = parseInt(intervaloDias, 10) || 30;
      }

      let response;

      // Se for uma transação importada
      if (isImportada && importacaoId) {
        // Importa o serviço de importação dinamicamente para evitar dependência circular
        const { default: importacaoService } = await import('../../services/importacaoService');

        response = await importacaoService.atualizarTransacao(
          importacaoId,
          _id,
          transacaoData
        );
      } else if (_id) {
        // Transação normal - edição
        response = await atualizarTransacao(_id, transacaoData);
      } else {
        // Transação normal - criação
        response = await criarTransacao(transacaoData);
      }

      if (response?.erro) {
        throw new Error(response.erro);
      }

      // Chama o callback de sucesso com a resposta
      await onSuccess(response);

      if (closeModal) {
        onClose();
      } else {
        // Limpa o formulário para nova entrada, preservando o tipo (90% dos lançamentos são do mesmo tipo)
        set_Id(null);
        // setTipo('gasto'); // NÃO resetar - mantém o tipo atual
        setDescricao('');
        setData(getTodayBR());
        setValorTotal('');
        setObservacao('');
        setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
        setSubconta('');
        setIsContaConjunta(false);
        setVinculoId('');
        setPagoPor('usuario');
        setValorTotalCompra('');
        setParteUsuario('');
        setIsImportada(false);
        setImportacaoId(null);
        setIsParcelado(false);
        setTotalParcelas('2');
        setIntervaloDias('30');
        // Foca no primeiro campo (Descrição, já que Tipo raramente muda)
        setTimeout(() => descricaoRef.current?.focus(), 50);
      }
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      toast.error(error.message || 'Erro ao salvar transação.');
    }
  };

  handleSubmitRef.current = handleSubmit;

  // Foca no campo apropriado quando o componente é montado ou transação muda
  useEffect(() => {
    // Se está editando, foca no tipo (pode precisar mudar)
    // Se é nova transação, foca na descrição (mais eficiente para lançamentos repetitivos)
    if (transacao && tipoRef.current) {
      tipoRef.current.focus();
    } else if (descricaoRef.current) {
      descricaoRef.current.focus();
    }
  }, [transacao]);

  // Adicionar tratamento para loading e erro dos dados do contexto
  if (loadingData) {
    return <div className="loading-indicator">Carregando dados essenciais...</div>; // Ou um spinner
  }

  if (errorData) {
    return <div className="error-message">Erro ao carregar categorias e tags. Tente atualizar a página.</div>;
  }

  return (
    <div className="nova-transacao-form-container">
      <h2>{transacao ? 'Editar Transação' : 'Nova Transação'}</h2>
      
      {/* Ícone de ajuda */}
      <IconButton 
        className="help-icon"
        onClick={() => setShowShortcuts(true)}
        color="primary"
      >
        <Tooltip title="Ver atalhos de teclado">
          <HelpOutlineIcon />
        </Tooltip>
      </IconButton>

      {/* Modal de atalhos */}
      <ShortcutsHelp 
        open={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />

      <form onSubmit={(e) => handleSubmit(e, true)}>
        <div className="form-grid">
          <div className="left-column">
            <div className="form-section">
              <label>Tipo:</label>
              <select
                ref={tipoRef}
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                required
                tabIndex={1}
              >
                <option value="gasto">Gasto</option>
                <option value="recebivel">Recebível</option>
              </select>
            </div>
            <div className="form-section">
              <label>Descrição:</label>
              <input
                type="text"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                required
                ref={descricaoRef}
                tabIndex={2}
              />
            </div>
            <div className="form-section">
              <label>Data:</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                required
                tabIndex={3}
              />
              <div className="date-shortcuts">
                <Tooltip title="Alt + H">
                  <button type="button" onClick={setHoje}>Hoje</button>
                </Tooltip>
                <Tooltip title="Alt + Y">
                  <button type="button" onClick={setOntem}>Ontem</button>
                </Tooltip>
              </div>
            </div>
            <div className="form-section">
              <label>Valor Total:</label>
              <input
                type="number"
                step="0.01"
                value={valorTotal}
                onChange={handleValorTotalChange}
                required
                ref={valorRef}
                tabIndex={4}
                style={showValidationWarning ? { borderColor: '#ff9800', borderWidth: '2px' } : {}}
              />
              {showValidationWarning && (
                <div style={{
                  color: '#ff9800',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  ⚠️ Soma dos pagamentos diferente do valor total
                </div>
              )}
            </div>
            {(!transacao || mostrarParcelamentoEmEdicao) && (
              <div className="form-section parcelamento-section">
                <label>
                  <input
                    type="checkbox"
                    checked={isParcelado}
                    onChange={(e) => setIsParcelado(e.target.checked)}
                    tabIndex={41}
                  />
                  {' '}Parcelado?
                </label>
                {isParcelado && (
                  <div className="parcelamento-campos">
                    <div className="form-section">
                      <label>Quantidade de parcelas:</label>
                      <input
                        type="number"
                        min="2"
                        max="60"
                        value={totalParcelas}
                        onChange={(e) => setTotalParcelas(e.target.value)}
                        tabIndex={42}
                      />
                    </div>
                    <div className="form-section">
                      <label>Intervalo (dias):</label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={intervaloDias}
                        onChange={(e) => setIntervaloDias(e.target.value)}
                        tabIndex={43}
                      />
                    </div>
                  </div>
                )}
                {previewParcelas && previewParcelas.parcelas && previewParcelas.parcelas.length > 0 && (
                  <div className="preview-parcelas-section">
                    <h4>Preview das parcelas</h4>
                    <div className="preview-parcelas-table-wrapper">
                      <table className="preview-parcelas-table">
                        <thead>
                          <tr>
                            <th>Parcela</th>
                            <th>Data</th>
                            <th>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewParcelas.parcelas.map((p) => (
                            <tr key={p.installmentNumber}>
                              <td>{p.installmentNumber}/{previewParcelas.parcelas.length}</td>
                              <td>{formatDateBR(p.date)}</td>
                              <td>R$ {parseFloat(p.value).toFixed(2).replace('.', ',')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="preview-parcelas-resumo">
                      <p><strong>Valor total:</strong> R$ {parseFloat(previewParcelas.valorTotal || 0).toFixed(2).replace('.', ',')}</p>
                      <p><strong>Intervalo:</strong> {previewParcelas.intervalInDays} dias</p>
                      <p><strong>Data inicial:</strong> {formatDateBR(previewParcelas.startDate)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="form-section">
              <label>Observação:</label>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows="3"
                placeholder="Adicione uma observação (opcional)"
                tabIndex={90}
              />
            </div>
            {subcontas.length > 0 && (
              <div className="form-section">
                <label>Subconta (opcional):</label>
                <SubcontaSelect
                  subcontas={subcontas}
                  value={subconta}
                  onChange={setSubconta}
                  placeholder="Nenhuma"
                  allowEmpty
                  className="subconta-select-nova-transacao"
                  tabIndex={91}
                />
              </div>
            )}
            <div className="form-section conta-conjunta-section">
              <label>
                <input
                  type="checkbox"
                  checked={isContaConjunta}
                  onChange={(e) => {
                    setIsContaConjunta(e.target.checked);
                    if (!e.target.checked) {
                      setVinculoId('');
                      setPagoPor('usuario');
                      setValorTotalCompra('');
                      setParteUsuario('');
                    }
                  }}
                  tabIndex={92}
                />
                {' '}Esta é uma conta conjunta
              </label>
              {isContaConjunta && (
                <div className="conta-conjunta-campos">
                  <div className="form-section">
                    <label>Vínculo:</label>
                    <select
                      value={vinculoId}
                      onChange={(e) => setVinculoId(e.target.value)}
                      required={isContaConjunta}
                      tabIndex={93}
                    >
                      <option value="">Selecione...</option>
                      {vinculos.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v.nome} ({v.participante})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-section">
                    <label>Quem pagou:</label>
                    <div className="radio-group">
                      <label>
                        <input
                          type="radio"
                          name="pagoPor"
                          value="usuario"
                          checked={pagoPor === 'usuario'}
                          onChange={() => setPagoPor('usuario')}
                          tabIndex={94}
                        />
                        {' '}Eu paguei
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="pagoPor"
                          value="outro"
                          checked={pagoPor === 'outro'}
                          onChange={() => setPagoPor('outro')}
                          tabIndex={95}
                        />
                        {' '}Outro participante pagou
                      </label>
                    </div>
                  </div>
                  {pagoPor === 'outro' && (
                    <>
                      <div className="form-section">
                        <label>Valor total da compra:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={valorTotalCompra}
                          onChange={(e) => setValorTotalCompra(e.target.value)}
                          tabIndex={96}
                        />
                      </div>
                      <div className="form-section">
                        <label>Minha parte:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={parteUsuario}
                          onChange={(e) => handleParteUsuarioChange(e.target.value)}
                          tabIndex={97}
                        />
                        {valorTotalCompra && parteUsuario && (
                          <span className="parte-outro-info">
                            Parte do outro: R$ {(parseFloat(valorTotalCompra) - parseFloat(parteUsuario || 0)).toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {pagoPor === 'usuario' && (
                    <div className="form-section">
                      <label>Minha parte (do valor total):</label>
                      <input
                        type="number"
                        step="0.01"
                        value={parteUsuario}
                        onChange={(e) => setParteUsuario(e.target.value)}
                        placeholder={valorTotal}
                        tabIndex={98}
                      />
                      {valorTotal && parteUsuario && (
                        <span className="parte-outro-info">
                          Parte do outro: R$ {(parseFloat(valorTotal) - parseFloat(parteUsuario || 0)).toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="right-column">
            <div className="form-section pagamentos-section">
              <h3>Pagamentos</h3>
              {pagamentos.map((pag, index) => (
                <div key={index} className="pagamento-item">
                  <div className="form-section">
                    <label>Pessoa:</label>
                    <input
                      type="text"
                      value={pag.pessoa}
                      onChange={e => handlePagamentoChange(index, 'pessoa', e.target.value)}
                      required
                      tabIndex={5 + (index * 10)}
                          />
                  </div>
                  <div className="form-section">
                    <label>Valor:</label>
                    {isParcelado ? (
                      <span className="parcela-valor-info">Será dividido em {totalParcelas} parcelas</span>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={pag.valor}
                        onChange={e => handlePagamentoChange(index, 'valor', e.target.value)}
                        required
                        tabIndex={6 + (index * 10)}
                      />
                    )}
                  </div>

                  {/* Tags por Categoria */}
                  <div className="tags-section">
                    <h4>Tags para Pagamento</h4>
                    {categorias.map((cat) => {
                     
                      
                      const options = allTags.filter(t => t.categoria === cat._id).map(t => ({
                        value: t._id,
                        label: t.nome,
                        cor: t.cor,
                        icone: t.icone
                      }));
                      const selectedValues = ((pag.paymentTags && pag.paymentTags[cat._id]) || []).map(tagId => {
                        const tag = allTags.find(t => t._id === tagId);
                    
                        return tag ? {
                          value: tag._id,
                          label: tag.nome,
                          cor: tag.cor,
                          icone: tag.icone
                        } : null;
                      }).filter(Boolean);

                      return (
                        <div key={cat._id} className="tag-category-group">
                          <label>
                            <IconRenderer 
                              nome={cat.icone || 'folder'} 
                              size={20} 
                              cor={cat.cor || '#000'} 
                            />
                            {cat.nome}
                          </label>
                          <Select
                            isMulti
                            options={options}
                            value={selectedValues}
                            onChange={(selected) => {
                              const newPaymentTags = { ...pag.paymentTags };
                              newPaymentTags[cat._id] = selected.map(s => s.value);
                              handlePagamentoChange(index, 'paymentTags', newPaymentTags);
                            }}
                            onKeyDown={(e) => {
                              // Enter seleciona a opção focada
                              if (e.key === 'Enter') {
                                e.stopPropagation(); // Previne submit do form
                                // react-select já trata Enter nativamente
                              }
                              // Tab apenas navega (sem selecionar)
                              // tabSelectsValue={false} garante que não seleciona
                            }}
                            // Configurações otimizadas para navegação por teclado
                            tabIndex={50 + (index * 10) + categorias.indexOf(cat)}
                            blurInputOnSelect={false}
                            closeMenuOnSelect={false}
                            tabSelectsValue={false}
                            openMenuOnFocus={false}
                            backspaceRemovesValue={true}
                            components={{
                              DropdownIndicator: null, // Remove a setinha do dropdown
                              IndicatorSeparator: null // Remove o separador
                            }}
                            styles={{
                              control: (provided) => ({
                                ...provided,
                                border: '1px solid rgba(44, 62, 80, 0.2)',
                                borderRadius: 'var(--borda-radius)',
                                minHeight: '38px',
                                boxShadow: 'none',
                                '&:hover': {
                                  border: '1px solid var(--cor-primaria)'
                                }
                              }),
                              option: (provided, state) => ({
                                ...provided,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: state.data.cor || provided.color,
                                backgroundColor: state.isFocused ? '#f0f0f0' : 'white',
                                '&:hover': {
                                  backgroundColor: '#f0f0f0'
                                }
                              }),
                              multiValue: (provided, state) => ({
                                ...provided,
                                backgroundColor: state.data.cor + '20',
                                borderRadius: '12px',
                                padding: '2px'
                              }),
                              multiValueLabel: (provided, state) => ({
                                ...provided,
                                color: state.data.cor,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }),
                              menu: (provided) => ({
                                ...provided,
                                zIndex: 999
                              }),
                              menuList: (provided) => ({
                                ...provided,
                                maxHeight: '200px'
                              })
                            }}
                            formatOptionLabel={({ label, cor, icone }) => (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IconRenderer nome={icone || 'tag'} size={20} cor={cor} />
                                <span>{label}</span>
                              </div>
                            )}
                            placeholder="Selecione as tags..."
                            className="tag-select"
                            classNamePrefix="tag-select"
                            isClearable={false}
                            isSearchable={true}
                            menuPlacement="auto"
                            noOptionsMessage={() => "Nenhuma tag encontrada"}
                            loadingMessage={() => "Carregando..."}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {!isParcelado && (
                    <button type="button" onClick={() => removePagamento(index)}>
                      Remover Pagamento
                    </button>
                  )}
                  <hr />
                </div>
              ))}
              {!isParcelado && (
                <Tooltip title="Alt + P">
                  <button type="button" onClick={addPagamento}>
                    Adicionar Pagamento
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
        <div className="form-buttons">
          <Tooltip title="Ctrl + Enter">
            <button
              type="submit"
              className="submit-btn"
              onClick={(e) => handleSubmit(e, true)}
              tabIndex={91}
            >
              {transacao ? 'Atualizar e Fechar' : 'Salvar e Fechar'}
            </button>
          </Tooltip>
          <Tooltip title="Ctrl + Space">
            <button
              type="button"
              className="submit-btn"
              onClick={(e) => handleSubmit(e, false)}
              tabIndex={92}
            >
              {transacao ? 'Atualizar e Continuar' : 'Salvar e Continuar'}
            </button>
          </Tooltip>
        </div>
      </form>
    </div>
  );
};

export default NovaTransacaoForm;
