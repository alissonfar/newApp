import React, { useEffect, useState, useCallback } from 'react';
import { FaCheck, FaForward } from 'react-icons/fa';
import { toast } from 'react-toastify';
import contaFixaApi from '../../services/contaFixaApi';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import PageHeader from '../../components/shared/PageHeader';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { formatarMoeda } from '../../utils/format';
import '../../components/Transaction/NovaTransacaoForm.css';
import './PendenciasContasFixas.css';

const PendenciasContasFixas = () => {
  const [pendencias, setPendencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [valoresEditados, setValoresEditados] = useState({});

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

  const handleConfirmar = async (pendencia) => {
    const valorEditado = valoresEditados[pendencia.contaFixa._id];
    try {
      await contaFixaApi.confirmar(pendencia.contaFixa._id, {
        valor: valorEditado ? Number(valorEditado) : undefined
      });
      toast.success(`"${pendencia.contaFixa.nome}" confirmada e lançada.`);
      await carregar();
    } catch (err) {
      toast.error('Erro ao confirmar lançamento.');
    }
  };

  const handlePular = async (pendencia) => {
    try {
      await contaFixaApi.pular(pendencia.contaFixa._id);
      toast.info(`"${pendencia.contaFixa.nome}" pulada este mês.`);
      await carregar();
    } catch (err) {
      toast.error('Erro ao pular este mês.');
    }
  };

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
              <div key={p.contaFixa._id} className="pagamento-item">
                <div className="pagamento-item-header">
                  <span className="pagamento-numero">{p.contaFixa.nome}</span>
                  <span className="parcela-valor-info">
                    Vencimento: {new Date(p.ciclo.dataVencimento).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="pagamento-campos-principais">
                  <div className="form-section pagamento-field-valor">
                    <label>Valor</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={p.contaFixa.valorEsperado}
                      placeholder={formatarMoeda(p.contaFixa.valorEsperado)}
                      onChange={(e) => setValoresEditados({ ...valoresEditados, [p.contaFixa._id]: e.target.value })}
                    />
                  </div>
                  <div className="pendencia-item__acoes">
                    <Button variant="ghost" size="sm" startIcon={<FaForward />} onClick={() => handlePular(p)}>Pular este mês</Button>
                    <Button variant="primary" size="sm" startIcon={<FaCheck />} onClick={() => handleConfirmar(p)}>Confirmar lançamento</Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PendenciasContasFixas;
