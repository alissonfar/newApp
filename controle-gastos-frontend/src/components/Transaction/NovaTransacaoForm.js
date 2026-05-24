import React, { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Tooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { criarTransacao, atualizarTransacao } from '../../api';
import { useData } from '../../context/DataContext';
import useTransacaoForm from '../../hooks/useTransacaoForm';
import usePagamentos from '../../hooks/usePagamentos';
import useContaConjunta from '../../hooks/useContaConjunta';
import useParcelamento from '../../hooks/useParcelamento';
import TransacaoTabs from './TransacaoTabs';
import TabPrincipal from './TabPrincipal';
import TabPagamentos from './TabPagamentos';
import TabAvancado from './TabAvancado';
import ShortcutsHelp from './ShortcutsHelp';
import './NovaTransacaoForm.css';
import './TransacaoTabs.css';
import { toISOStringBR } from '../../utils/dateUtils';

const NovaTransacaoForm = ({ onSuccess, onClose, transacao, proprietarioPadrao = '', mostrarParcelamentoEmEdicao = false }) => {
  const form = useTransacaoForm({ transacao, proprietarioPadrao });
  const contaConjunta = useContaConjunta({ transacao });
  const parcelamento = useParcelamento({ valorTotal: form.formState.valorTotal, data: form.formState.data, transacao, mostrarParcelamentoEmEdicao });
  const pagamentos = usePagamentos({
    transacao,
    proprietarioPadrao,
    valorTotal: form.formState.valorTotal,
    isParcelado: parcelamento.state.isParcelado,
    isContaConjunta: contaConjunta.state.isContaConjunta,
    pagoPor: contaConjunta.state.pagoPor,
    parteUsuario: contaConjunta.state.parteUsuario
  });

  const { categorias, tags: allTags, loadingData, errorData } = useData();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const handleSubmitRef = useRef(null);

  const { formState, setters: fsSetters, refs } = form;

  const onValorTotalChange = useCallback((e) => {
    const raw = e.target.value;
    fsSetters.setValorTotal(raw);
    if (contaConjunta.state.isContaConjunta && contaConjunta.state.pagoPor === 'outro') {
      contaConjunta.setters.setParteUsuario(raw);
      if (pagamentos.pagamentos.length === 1) pagamentos.handlePagamentoChange(0, 'valor', raw);
    } else if (pagamentos.pagamentos.length === 1) {
      pagamentos.handlePagamentoChange(0, 'valor', raw);
    }
  }, [fsSetters, contaConjunta.state.isContaConjunta, contaConjunta.state.pagoPor, contaConjunta.setters, pagamentos]);

  const onParteUsuarioChange = useCallback((raw) => {
    contaConjunta.setters.setParteUsuario(raw);
    if (contaConjunta.state.pagoPor === 'outro') {
      fsSetters.setValorTotal(raw);
      if (pagamentos.pagamentos.length === 1) {
        pagamentos.handlePagamentoChange(0, 'valor', raw);
      }
    }
  }, [contaConjunta.state.pagoPor, contaConjunta.setters, fsSetters, pagamentos]);

  const handleSubmit = useCallback(async (e, closeModal = true) => {
    e?.preventDefault?.();

    if (!pagamentos.isValid()) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total da transacao.');
      return;
    }

    const ccError = contaConjunta.validateContaConjunta(formState.valorTotal);
    if (ccError) {
      toast.error(ccError);
      return;
    }

    try {
      let valorFinal = parseFloat(formState.valorTotal);
      let contaConjuntaPayload = contaConjunta.buildPayload(formState.valorTotal);
      if (contaConjuntaPayload) {
        valorFinal = contaConjunta.getValorFinal(formState.valorTotal);
      }

      const transacaoData = {
        _id: formState._id,
        tipo: formState.tipo,
        descricao: formState.descricao,
        data: toISOStringBR(formState.data),
        valor: valorFinal,
        observacao: formState.observacao,
        pagamentos: pagamentos.buildPagamentosPayload()
      };
      if (formState.subconta) transacaoData.subconta = formState.subconta;
      else transacaoData.subconta = null;
      if (contaConjuntaPayload) transacaoData.contaConjunta = contaConjuntaPayload;

      const parcelamentoPayload = parcelamento.buildPayload();
      if (parcelamentoPayload) {
        Object.assign(transacaoData, parcelamentoPayload);
      }

      let response;
      if (formState.isImportada && formState.importacaoId) {
        const { default: importacaoService } = await import('../../services/importacaoService');
        response = await importacaoService.atualizarTransacao(formState.importacaoId, formState._id, transacaoData);
      } else if (formState._id) {
        response = await atualizarTransacao(formState._id, transacaoData);
      } else {
        response = await criarTransacao(transacaoData);
      }

      if (response?.erro) {
        throw new Error(response.erro);
      }

      await onSuccess(response);

      if (closeModal) {
        onClose();
      } else {
        form.resetForm(true);
        pagamentos.setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
        contaConjunta.reset();
        parcelamento.reset();
        setTimeout(() => refs.descricaoRef.current?.focus(), 50);
      }
    } catch (error) {
      console.error('Erro ao salvar transacao:', error);
      toast.error(error.message || 'Erro ao salvar transacao.');
    }
  }, [formState, form, pagamentos, contaConjunta, parcelamento, onSuccess, onClose, proprietarioPadrao, refs]);

  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
        if (e.key !== 'Escape' && !e.ctrlKey && !e.altKey) return;
      }
      if (e.key === 'Escape') { onClose(); return; }
      if (e.ctrlKey && e.keyCode === 32) { e.preventDefault(); handleSubmitRef.current?.(null, false); return; }
      if (e.ctrlKey && e.keyCode === 13) { e.preventDefault(); handleSubmitRef.current?.(null, true); return; }
      if (e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); form.setHoje(); return; }
      if (e.altKey && e.key.toLowerCase() === 'y') { e.preventDefault(); form.setOntem(); return; }
      if (e.altKey && e.key.toLowerCase() === 'p') { e.preventDefault(); pagamentos.addPagamento(); return; }
      if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); pagamentos.removePagamento(); return; }
      if (e.altKey && e.key.toLowerCase() === 'd') { e.preventDefault(); refs.descricaoRef.current?.focus(); return; }
      if (e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); refs.valorRef.current?.focus(); return; }
      if (e.altKey && e.key.toLowerCase() === 't') { e.preventDefault(); refs.tipoRef.current?.focus(); return; }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, form, pagamentos, refs]);

  const onSubmitSaveClose = useCallback((e) => handleSubmit(e, true), [handleSubmit]);
  const onSubmitSaveContinue = useCallback((e) => handleSubmit(e, false), [handleSubmit]);

  if (loadingData) {
    return <div className="loading-indicator">Carregando dados essenciais...</div>;
  }
  if (errorData) {
    return <div className="error-message">Erro ao carregar categorias e tags. Tente atualizar a pagina.</div>;
  }

  return (
    <div className="nova-transacao-form-container">
      <h2>{transacao ? 'Editar Transacao' : 'Nova Transacao'}</h2>

      <IconButton className="help-icon" onClick={() => setShowShortcuts(true)} color="primary">
        <Tooltip title="Ver atalhos de teclado">
          <HelpOutlineIcon />
        </Tooltip>
      </IconButton>

      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      <TransacaoTabs
        onSubmitSaveClose={onSubmitSaveClose}
        onSubmitSaveContinue={onSubmitSaveContinue}
        isEditing={!!transacao}
      >
        <TabPrincipal
          data-tab="principal"
          tipo={formState.tipo}
          setTipo={fsSetters.setTipo}
          tipoRef={refs.tipoRef}
          descricao={formState.descricao}
          setDescricao={fsSetters.setDescricao}
          descricaoRef={refs.descricaoRef}
          data={formState.data}
          setData={fsSetters.setData}
          valorTotal={formState.valorTotal}
          onValorTotalChange={onValorTotalChange}
          valorRef={refs.valorRef}
          observacao={formState.observacao}
          setObservacao={fsSetters.setObservacao}
          onToday={form.setHoje}
          onYesterday={form.setOntem}
          showValidationWarning={pagamentos.showValidationWarning}
        />
        <TabPagamentos
          data-tab="pagamentos"
          pagamentos={pagamentos.pagamentos}
          handlePagamentoChange={pagamentos.handlePagamentoChange}
          addPagamento={pagamentos.addPagamento}
          removePagamento={pagamentos.removePagamento}
          splitEqually={pagamentos.splitEqually}
          splitInto={pagamentos.splitInto}
          clearPaymentTags={pagamentos.clearPaymentTags}
          duplicatePagamento={pagamentos.duplicatePagamento}
          isParcelado={parcelamento.state.isParcelado}
          totalParcelas={parcelamento.state.totalParcelas}
          categorias={categorias}
          allTags={allTags}
          proprietarioPadrao={proprietarioPadrao}
        />
        <TabAvancado
          data-tab="avancado"
          parcelamento={parcelamento}
          contaConjunta={contaConjunta}
          subcontas={formState.subcontas}
          subconta={formState.subconta}
          setSubconta={fsSetters.setSubconta}
          valorTotal={formState.valorTotal}
          parteUsuario={contaConjunta.state.parteUsuario}
          setParteUsuario={onParteUsuarioChange}
          transacao={transacao}
        />
      </TransacaoTabs>
    </div>
  );
};

export default NovaTransacaoForm;
