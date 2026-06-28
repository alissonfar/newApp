import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSpinner, FaExclamationTriangle, FaArrowRight, FaCreditCard } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import PatrimonioStatCard from '../../components/Patrimonio/PatrimonioStatCard';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import Badge from '../../components/shared/Badge';
import EmptyState from '../../components/shared/EmptyState';
import { useBreadcrumbTrailing } from '../../context/BreadcrumbContext';
import { formatDateBR } from '../../utils/dateUtils';
import './FaturasPage.css';

function gerarOpcoesMes() {
  const hoje = new Date();
  const opcoes = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const value = ano + '-' + mes;
    opcoes.push({ value, label });
  }
  return opcoes;
}

function mesAtual() {
  const hoje = new Date();
  return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
}

const OPCOES_MES = gerarOpcoesMes();

const FaturasPage = () => {
  const navigate = useNavigate();
  const [faturas, setFaturas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [anoMes, setAnoMes] = useState(mesAtual());

  useBreadcrumbTrailing('Minhas Faturas');

  const carregar = async (mes) => {
    try {
      setCarregando(true);
      setErro(null);
      const data = await patrimonioApi.obterFaturas(mes);
      setFaturas(data);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar faturas');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar(anoMes);
  }, [anoMes]);

  const formatarMoeda = (v) => 'R$ ' + ((v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  const totalConsolidado = faturas.reduce((acc, f) => acc + (f.saldoAtual || 0), 0);
  const totalFaturaMes = faturas.reduce((acc, f) => acc + (f.faturaMes || 0), 0);

  if (carregando) {
    return (
      <div className="faturas-page">
        <div className="faturas-loading">
          <FaSpinner className="spinner" />
          <p>Carregando faturas...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="faturas-page">
        <div className="faturas-erro">
          <FaExclamationTriangle />
          <p>{erro}</p>
          <Button variant="primary" onClick={() => carregar(anoMes)}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="faturas-page">
      <div className="faturas-header">
        <h1><FaCreditCard /> Minhas Faturas</h1>
        <div className="faturas-header-actions">
          <select
            className="faturas-mes-select"
            value={anoMes}
            onChange={(e) => setAnoMes(e.target.value)}
          >
            {OPCOES_MES.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Button variant="primary" onClick={() => carregar(anoMes)}>
            Atualizar
          </Button>
        </div>
      </div>

      {faturas.length > 0 && (
        <div className="faturas-cards">
          <PatrimonioStatCard
            label="Total Faturas (saldo devedor)"
            valor={formatarMoeda(totalConsolidado)}
            icon="creditcard"
            corBorda="#f44336"
          />
          <PatrimonioStatCard
            label={'Total a pagar no m\u00eas'}
            valor={formatarMoeda(totalFaturaMes)}
            icon="chartline"
            badge={{ label: 'Fatura do m\u00eas selecionado', variant: 'warning' }}
            corBorda="#ff9800"
          />
        </div>
      )}

      <div className="faturas-lista">
        <SectionHeader title={'Cart\u00f5es de Cr\u00e9dito'} />
        {faturas.length > 0 ? (
          <div className="faturas-grid">
            {faturas.map((f) => (
              <Card key={f.subcontaId} className="fatura-card" style={{ borderLeft: '4px solid #f44336' }}>
                <div className="fatura-card__header">
                  <div className="fatura-card__info">
                    <h3>{f.instituicao?.nome || 'Institui\u00e7\u00e3o'}</h3>
                    <p className="fatura-card__nome">{f.nome}</p>
                  </div>
                  {f.faturaMesLabel && (
                    <Badge variant="warning">{f.faturaMesLabel}</Badge>
                  )}
                </div>
                <div className="fatura-card__body">
                  <div className="fatura-card__stat">
                    <span className="fatura-card__label">Saldo devedor</span>
                    <span className="fatura-card__valor">{formatarMoeda(f.saldoAtual)}</span>
                  </div>
                  <div className="fatura-card__stat">
                    <span className="fatura-card__label">{'Fatura do m\u00eas'}</span>
                    <span className={'fatura-card__valor ' + (f.faturaMes > 0 ? 'fatura-card__valor--negativo' : 'fatura-card__valor--positivo')}>
                      {formatarMoeda(f.faturaMes)}
                    </span>
                  </div>
                  <div className="fatura-card__detalhes">
                    <span>Compras: {formatarMoeda(f.totalComprasMes)}</span>
                    <span>Pagamentos: {formatarMoeda(f.totalPagamentosMes)}</span>
                  </div>
                </div>
                <div className="fatura-card__footer">
                  <span className="fatura-card__data">
                    {'\u00daltima confirma\u00e7\u00e3o: '}
                    {f.dataUltimaConfirmacao ? formatDateBR(f.dataUltimaConfirmacao) : 'Nunca'}
                  </span>
                  <Button
                    variant="ghost"
                    icon={<FaArrowRight size={12} />}
                    onClick={() => navigate('/patrimonio/contas/' + f.subcontaId)}
                  >
                    Detalhes
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState message={'Nenhum cart\u00e3o de cr\u00e9dito cadastrado ou sincronizado.'}>
            <Button variant="primary" onClick={() => navigate('/pluggy')}>
              Configurar Open Finance
            </Button>
          </EmptyState>
        )}
      </div>
    </div>
  );
};

export default FaturasPage;
