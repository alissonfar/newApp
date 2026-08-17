import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FaCheck, FaForward } from 'react-icons/fa';
import { toast } from 'react-toastify';
import contaFixaApi from '../../services/contaFixaApi';
import { useData } from '../../context/DataContext';
import usePagamentos from '../../hooks/usePagamentos';
import TabPagamentos from '../../components/Transaction/TabPagamentos';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import PageHeader from '../../components/shared/PageHeader';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import '../../components/Transaction/NovaTransacaoForm.css';
import './PendenciasContasFixas.css';

const PendenciaCard = ({ pendencia, categorias, allTags, onConfirmado, onPulado }) => {
  const { contaFixa, ciclo } = pendencia;
  const [valorTotal, setValorTotal] = useState(String(contaFixa.valorEsperado));
  const [salvando, setSalvando] = useState(false);

  const transacaoParaPagamentos = useMemo(
    () => ({ pagamentos: contaFixa.pagamentosTemplate }),
    [contaFixa]
  );

  const pagamentos = usePagamentos({
    transacao: transacaoParaPagamentos,
    proprietarioPadrao: '',
    valorTotal
  });

  const handleConfirmar = async () => {
    if (!pagamentos.isValid()) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total.');
      return;
    }
    setSalvando(true);
    try {
      await contaFixaApi.confirmar(contaFixa._id, {
        valor: parseFloat(valorTotal),
        pagamentos: pagamentos.buildPagamentosPayload()
      });
      toast.success(`"${contaFixa.nome}" confirmada e lançada.`);
      onConfirmado();
    } catch (err) {
      toast.error(err?.response?.data?.erro || 'Erro ao confirmar lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  const handlePular = async () => {
    try {
      await contaFixaApi.pular(contaFixa._id);
      toast.info(`"${contaFixa.nome}" pulada este mês.`);
      onPulado();
    } catch (err) {
      toast.error('Erro ao pular este mês.');
    }
  };

  return (
    <div className="pagamento-item">
      <div className="pagamento-item-header">
        <span className="pagamento-numero">{contaFixa.nome}</span>
        <span className="parcela-valor-info">
          Vencimento: {new Date(ciclo.dataVencimento).toLocaleDateString('pt-BR')}
        </span>
      </div>

      <div className="form-section pagamento-field-valor">
        <label>Valor total</label>
        <input
          type="number"
          step="0.01"
          value={valorTotal}
          onChange={(e) => setValorTotal(e.target.value)}
        />
      </div>

      <TabPagamentos
        pagamentos={pagamentos.pagamentos}
        handlePagamentoChange={pagamentos.handlePagamentoChange}
        addPagamento={pagamentos.addPagamento}
        removePagamento={pagamentos.removePagamento}
        splitEqually={pagamentos.splitEqually}
        splitInto={pagamentos.splitInto}
        applyPreset={pagamentos.applyPreset}
        duplicatePagamento={pagamentos.duplicatePagamento}
        toggleFixed={pagamentos.toggleFixed}
        fillRemaining={pagamentos.fillRemaining}
        distributeRemaining={pagamentos.distributeRemaining}
        categorias={categorias}
        allTags={allTags}
        proprietarioPadrao=""
        valorTotal={valorTotal}
        showValidationWarning={pagamentos.showValidationWarning}
        soma={pagamentos.soma}
        saldoRestante={pagamentos.saldoRestante}
        enableEmprestimo={false}
      />

      <div className="pendencia-item__acoes">
        <Button variant="ghost" size="sm" startIcon={<FaForward />} onClick={handlePular} disabled={salvando}>Pular este mês</Button>
        <Button variant="primary" size="sm" startIcon={<FaCheck />} onClick={handleConfirmar} loading={salvando}>Confirmar lançamento</Button>
      </div>
    </div>
  );
};

const PendenciasContasFixas = () => {
  const { categorias, tags } = useData();
  const [pendencias, setPendencias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await contaFixaApi.listarPendencias();
      setPendencias(dados);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="pendencias-contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <PageHeader icon={<EventRepeatIcon />} title="Contas Fixas Pendentes" subtitle="Revise e confirme os lançamentos deste mês" />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : pendencias.length === 0 ? (
            <EmptyState message="Nenhuma conta fixa pendente de confirmação." />
          ) : (
            pendencias.map((p) => (
              <PendenciaCard
                key={p.contaFixa._id}
                pendencia={p}
                categorias={categorias}
                allTags={tags}
                onConfirmado={carregar}
                onPulado={carregar}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PendenciasContasFixas;
