import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import contaFixaApi from '../../services/contaFixaApi';
import ContaFixaFormModal from './ContaFixaFormModal';
import Card, { CardContent, CardHeader } from '../../components/shared/Card';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { formatarMoeda } from '../../utils/format';

const ContasFixas = () => {
  const navigate = useNavigate();
  const [contasFixas, setContasFixas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [contaFixaEditando, setContaFixaEditando] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await contaFixaApi.listar();
      setContasFixas(dados);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNova = () => {
    setContaFixaEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (contaFixa) => {
    setContaFixaEditando(contaFixa);
    setModalAberto(true);
  };

  const handleSalvar = async (dados) => {
    if (contaFixaEditando) {
      await contaFixaApi.atualizar(contaFixaEditando._id, dados);
    } else {
      await contaFixaApi.criar(dados);
    }
    setModalAberto(false);
    await carregar();
  };

  const handlePausarOuReativar = async (contaFixa) => {
    if (contaFixa.status === 'pausada') {
      await contaFixaApi.reativar(contaFixa._id);
    } else {
      await contaFixaApi.pausar(contaFixa._id);
    }
    await carregar();
  };

  const handleExcluir = async (contaFixa) => {
    if (!window.confirm(`Excluir "${contaFixa.nome}"? Isso não afeta transações já geradas.`)) return;
    await contaFixaApi.excluir(contaFixa._id);
    await carregar();
  };

  return (
    <div className="contas-fixas-page">
      <Card variant="glass" padding="md">
        <CardHeader>
          <SectionHeader
            title="Contas Fixas"
            subtitle="Lançamentos recorrentes mensais"
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" onClick={() => navigate('/contas-fixas/pendencias')}>
                  Ver pendências
                </Button>
                <Button variant="primary" onClick={abrirNova}>+ Nova Conta Fixa</Button>
              </div>
            }
          />
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p>Carregando...</p>
          ) : contasFixas.length === 0 ? (
            <EmptyState message="Nenhuma conta fixa cadastrada ainda." />
          ) : (
            <table className="contas-fixas-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Valor esperado</th>
                  <th>Dias (lanç. / venc.)</th>
                  <th>Modo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFixas.map((cf) => (
                  <tr key={cf._id}>
                    <td>{cf.nome}</td>
                    <td>{cf.tipo === 'gasto' ? 'Despesa' : 'Receita'}</td>
                    <td>{formatarMoeda(cf.valorEsperado)}</td>
                    <td>{cf.diaLancamento} / {cf.diaVencimento}</td>
                    <td>{cf.modo === 'automatico' ? 'Automático' : 'Confirmação'}</td>
                    <td>{cf.status}</td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicao(cf)}>Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => handlePausarOuReativar(cf)}>
                        {cf.status === 'pausada' ? 'Reativar' : 'Pausar'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleExcluir(cf)}>Excluir</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {modalAberto && (
        <ContaFixaFormModal
          contaFixa={contaFixaEditando}
          onSave={handleSalvar}
          onClose={() => setModalAberto(false)}
        />
      )}
    </div>
  );
};

export default ContasFixas;
