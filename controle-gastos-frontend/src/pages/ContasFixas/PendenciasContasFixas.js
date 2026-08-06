import React, { useEffect, useState, useCallback } from 'react';
import contaFixaApi from '../../services/contaFixaApi';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { formatarMoeda } from '../../utils/format';

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
    await contaFixaApi.confirmar(pendencia.contaFixa._id, {
      valor: valorEditado ? Number(valorEditado) : undefined
    });
    await carregar();
  };

  const handlePular = async (pendencia) => {
    await contaFixaApi.pular(pendencia.contaFixa._id);
    await carregar();
  };

  return (
    <div className="pendencias-contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <SectionHeader title="Contas Fixas Pendentes" subtitle="Revise e confirme os lançamentos deste mês" />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : pendencias.length === 0 ? (
            <EmptyState message="Nenhuma conta fixa pendente de confirmação." />
          ) : (
            pendencias.map((p) => (
              <div key={p.contaFixa._id} className="pendencia-item">
                <div>
                  <strong>{p.contaFixa.nome}</strong>
                  <p>Vencimento: {new Date(p.ciclo.dataVencimento).toLocaleDateString('pt-BR')}</p>
                </div>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={p.contaFixa.valorEsperado}
                  placeholder={formatarMoeda(p.contaFixa.valorEsperado)}
                  onChange={(e) => setValoresEditados({ ...valoresEditados, [p.contaFixa._id]: e.target.value })}
                />
                <div className="pendencia-item__acoes">
                  <Button variant="ghost" size="sm" onClick={() => handlePular(p)}>Pular este mês</Button>
                  <Button variant="primary" size="sm" onClick={() => handleConfirmar(p)}>Confirmar lançamento</Button>
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
