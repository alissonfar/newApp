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
import useDuplicateCheck from '../../hooks/useDuplicateCheck';
import useEmprestimoForm from '../../hooks/useEmprestimoForm';
import { criarEmprestimo } from '../../api';
import TransacaoTabs from './TransacaoTabs';
import TabPrincipal from './TabPrincipal';
import TabPagamentos from './TabPagamentos';
import TabAvancado from './TabAvancado';
import TabResumo from './TabResumo';
import ShortcutsHelp from './ShortcutsHelp';
import './NovaTransacaoForm.css';
import './TransacaoTabs.css';
import './TabResumo.css';
import { toISOStringBR } from '../../utils/dateUtils';

const NovaTransacaoForm = ({ onSuccess, onClose, transacao, proprietarioPadrao = '', mostrarParcelamentoEmEdicao = false }) => {
  const containerRef = useRef(null);
  const form = useTransacaoForm({ transacao, proprietarioPadrao });
  const contaConjunta = useContaConjunta({ transacao });
  const parcelamento = useParcelamento({
    valorTotal: form.formState.valorTotal,
    data: form.formState.data,
    transacao,
    mostrarParcelamentoEmEdicao
  });
  const pagamentos = usePagamentos({
    transacao,
    proprietarioPadrao,
    valorTotal: form.formState.valorTotal,
    isContaConjunta: contaConjunta.state.isContaConjunta,
    pagoPor: contaConjunta.state.pagoPor,
    parteUsuario: contaConjunta.state.parteUsuario,
    parcelamentos: parcelamento.state.parcelamentos
  });

  // Keep parcelamento hook in sync with current pagamentos for preview generation
  parcelamento.pagamentosRef.current = pagamentos.pagamentos;

  const { categorias, tags: allTags, loadingData, errorData } = useData();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const handleSubmitRef = useRef(null);
  const closeRef = useRef(null);

  const duplicate = useDuplicateCheck({
    descricao: form.formState.descricao,
    data: form.formState.data,
    valorTotal: form.formState.valorTotal,
    enabled: form.formState.descricao.length >= 3
  });

  const emprestimoForm = useEmprestimoForm({
    transacao,
    tipoTransacao: form.formState.tipo,
    valorTotal: form.formState.valorTotal
  });

  closeRef.current = onClose;

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

    const empError = emprestimoForm.validar();
    if (empError) {
      toast.error(empError);
      return;
    }

    setIsSaving(true);
    try {
      let valorFinal = parseFloat(formState.valorTotal);
      let contaConjuntaPayload = contaConjunta.buildPayload(formState.valorTotal);
      if (contaConjuntaPayload) {
        valorFinal = contaConjunta.getValorFinal(formState.valorTotal);
      }

      let emprestimoIdParaTransacao = null;
      if (emprestimoForm.state.ativo) {
        if (emprestimoForm.state.modo === 'vincular') {
          emprestimoIdParaTransacao = emprestimoForm.state.emprestimoId;
        } else {
          const valorEsperado = parseFloat(emprestimoForm.state.novoValorEsperado) || 0;
          const novoEmp = await criarEmprestimo({
            pessoaId: emprestimoForm.state.pessoaId,
            direcao: emprestimoForm.state.direcao,
            valorEsperadoRetorno: valorEsperado,
            tipoRetorno: emprestimoForm.state.novoTipoRetorno,
            prazoFinal: emprestimoForm.state.novoPrazoFinal
          });
          emprestimoIdParaTransacao = novoEmp._id || novoEmp.id;
        }
      }

      const pagamentosPayload = pagamentos.buildPagamentosPayload();

      const pagamentosComParcelamento = pagamentosPayload.map(p => {
        const idx = pagamentos.pagamentos.findIndex(
          pg => pg.pessoa === p.pessoa && Math.abs(parseFloat(pg.valor || 0) - (p.valor || 0)) < 0.01
        );
        if (idx >= 0 && parcelamento.state.parcelamentos[idx]?.ativo) {
          const conf = parcelamento.state.parcelamentos[idx];
          return {
            ...p,
            parcelamento: {
              ativo: true,
              quantidade: parseInt(conf.quantidade, 10) || 2,
              intervaloDias: parseInt(conf.intervaloDias, 10) || 30
            }
          };
        }
        return p;
      });

      const transacaoData = {
        _id: formState._id,
        tipo: formState.tipo,
        descricao: formState.descricao,
        data: toISOStringBR(formState.data),
        valor: valorFinal,
        observacao: formState.observacao,
        pagamentos: pagamentosComParcelamento
      };
      if (contaConjuntaPayload) transacaoData.contaConjunta = contaConjuntaPayload;
      if (emprestimoIdParaTransacao) transacaoData.emprestimoId = emprestimoIdParaTransacao;
      else transacaoData.emprestimoId = null;

      let response;
      if (formState.isImportada && formState.importacaoId) {
        transacaoData.status = 'revisada';
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

      if (closeModal) {
        await onSuccess(response);
        onClose();
      } else {
        await onSuccess(response);
        form.resetForm(true);
        pagamentos.setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {}, fixed: false }]);
        contaConjunta.reset();
        parcelamento.reset();
        emprestimoForm.reset();
        toast.success('Salvo! Pronto para a proxima.', { autoClose: 1500 });
        setTimeout(() => refs.descricaoRef.current?.focus(), 80);
      }
    } catch (error) {
      console.error('Erro ao salvar transacao:', error);
      toast.error(error.message || 'Erro ao salvar transacao.');
    } finally {
      setIsSaving(false);
    }
  }, [formState, form, pagamentos, contaConjunta, parcelamento, emprestimoForm, onSuccess, onClose, proprietarioPadrao, refs]);

  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { closeRef.current?.(); return; }

      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); handleSubmitRef.current?.(null, true); return; }
      if (e.ctrlKey && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); handleSubmitRef.current?.(null, false); return; }
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); handleSubmitRef.current?.(null, true); return; }

      if (e.altKey) {
        const tag = e.target?.tagName;
        const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        if (!isInput) return;
        switch (e.key.toLowerCase()) {
          case 'h': e.preventDefault(); form.setHoje(); break;
          case 'y': e.preventDefault(); form.setOntem(); break;
          case 'p': e.preventDefault(); pagamentos.addPagamento(); break;
          case 'r': e.preventDefault(); pagamentos.removePagamento(); break;
          case 'd': e.preventDefault(); refs.descricaoRef.current?.focus(); break;
          case 'v': e.preventDefault(); refs.valorRef.current?.focus(); break;
          case 't': e.preventDefault(); refs.tipoRef.current?.focus(); break;
          default: break;
        }
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [form, pagamentos, refs]);

  const onSubmitSaveClose = useCallback((e) => handleSubmit(e, true), [handleSubmit]);
  const onSubmitSaveContinue = useCallback((e) => handleSubmit(e, false), [handleSubmit]);

  if (loadingData) {
    return <div className="loading-indicator">Carregando dados essenciais...</div>;
  }
  if (errorData) {
    return <div className="error-message">Erro ao carregar categorias e tags. Tente atualizar a pagina.</div>;
  }

  return (
    <div className="nova-transacao-form-container" ref={containerRef}>
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
        isSaving={isSaving}
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
          duplicatePagamento={pagamentos.duplicatePagamento}
          toggleFixed={pagamentos.toggleFixed}
          fillRemaining={pagamentos.fillRemaining}
          distributeRemaining={pagamentos.distributeRemaining}
          parcelamentos={parcelamento.state.parcelamentos}
          previews={parcelamento.state.previews}
          toggleParcelamento={parcelamento.toggleParcelamento}
          setParcelamentoField={parcelamento.setParcelamentoField}
          categorias={categorias}
          allTags={allTags}
          proprietarioPadrao={proprietarioPadrao}
          showInForm={parcelamento.state.showInForm}
          valorTotal={formState.valorTotal}
          showValidationWarning={pagamentos.showValidationWarning}
          soma={pagamentos.soma}
          saldoRestante={pagamentos.saldoRestante}
        />
        <TabAvancado
          data-tab="avancado"
          parcelamento={parcelamento}
          contaConjunta={contaConjunta}
          valorTotal={formState.valorTotal}
          parteUsuario={contaConjunta.state.parteUsuario}
          setParteUsuario={onParteUsuarioChange}
          transacao={transacao}
          emprestimoForm={emprestimoForm}
        />
        <TabResumo
          data-tab="resumo"
          formState={formState}
          pagamentos={pagamentos}
          parcelamento={parcelamento}
          contaConjunta={contaConjunta}
          allTags={allTags}
          categorias={categorias}
          duplicate={duplicate}
        />
      </TransacaoTabs>
    </div>
  );
};

export default NovaTransacaoForm;
