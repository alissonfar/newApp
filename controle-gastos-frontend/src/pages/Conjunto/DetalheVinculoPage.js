import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaSpinner, FaReceipt } from 'react-icons/fa';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import {
  obterVinculoConjunto,
  obterResumoVinculo,
  listarTransacoesVinculo,
  listarAcertosVinculo,
  registrarAcertoVinculo,
  estornarAcerto
} from '../../api';
import { getDateRangeForPeriod, PERIODOS_RAPIDOS } from '../../utils/dateUtils';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
import Badge from '../../components/shared/Badge';
import PeriodQuickFilter from '../../components/shared/PeriodQuickFilter';
import './DetalheVinculoPage.css';

const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatarData = (d) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '-';

const DetalheVinculoPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vinculo, setVinculo] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [transacoes, setTransacoes] = useState({ items: [], total: 0 });
  const [acertos, setAcertos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAcerto, setModalAcerto] = useState(false);
  const [periodo, setPeriodo] = useState({ dataInicio: '', dataFim: '' });
  const [acertoValor, setAcertoValor] = useState('');
  const [acertoDirecao, setAcertoDirecao] = useState('paguei');
  const [acertoData, setAcertoData] = useState('');
  const [acertoObservacao, setAcertoObservacao] = useState('');
  const [salvandoAcerto, setSalvandoAcerto] = useState(false);
  const [estornandoId, setEstornandoId] = useState(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setCarregando(true);
      const range = getDateRangeForPeriod(PERIODOS_RAPIDOS.MES_ATUAL);
      const [v, res, trans, ac] = await Promise.all([
        obterVinculoConjunto(id),
        obterResumoVinculo(id, range || {}),
        listarTransacoesVinculo(id, { limit: 50 }),
        listarAcertosVinculo(id)
      ]);
      setVinculo(v);
      setResumo(res);
      setTransacoes({ items: trans.items || trans.transacoes || [], total: trans.total || 0 });
      setAcertos(Array.isArray(ac) ? ac : []);
      if (range) setPeriodo({ dataInicio: range.dataInicio, dataFim: range.dataFim });
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  const carregarComPeriodo = useCallback(async () => {
    if (!id) return;
    try {
      const [res, trans] = await Promise.all([
        obterResumoVinculo(id, periodo),
        listarTransacoesVinculo(id, { ...periodo, limit: 50 })
      ]);
      setResumo(res);
      setTransacoes({ items: trans.items || trans.transacoes || [], total: trans.total || 0 });
    } catch (err) {
      console.error(err);
    }
  }, [id, periodo.dataInicio, periodo.dataFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!carregando && periodo.dataInicio) {
      carregarComPeriodo();
    }
  }, [periodo.dataInicio, periodo.dataFim]);

  const handlePeriodChange = (p) => {
    setPeriodo({ dataInicio: p.dataInicio || '', dataFim: p.dataFim || '' });
  };

  const handleRegistrarAcerto = async (e) => {
    e.preventDefault();
    const valor = parseFloat(acertoValor);
    if (!valor || valor <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (!acertoData) {
      toast.error('Informe a data do acerto.');
      return;
    }
    try {
      setSalvandoAcerto(true);
      await registrarAcertoVinculo(id, {
        valor,
        direcao: acertoDirecao,
        data: acertoData,
        observacao: acertoObservacao || undefined
      });
      toast.success('Acerto registrado com sucesso.');
      setModalAcerto(false);
      setAcertoValor('');
      setAcertoDirecao('paguei');
      setAcertoData('');
      setAcertoObservacao('');
      carregar();
    } catch (err) {
      toast.error(err.message || 'Erro ao registrar acerto.');
    } finally {
      setSalvandoAcerto(false);
    }
  };

  const handleEstornarAcerto = async (acertoId) => {
    if (!window.confirm('Estornar este acerto? As transações serão reabertas.')) return;
    try {
      setEstornandoId(acertoId);
      await estornarAcerto(acertoId);
      toast.success('Acerto estornado.');
      carregar();
    } catch (err) {
      toast.error(err.message || 'Erro ao estornar.');
    } finally {
      setEstornandoId(null);
    }
  };

  if (carregando) {
    return (
      <div className="detalhe-vinculo-page">
        <div className="detalhe-vinculo-loading">
          <FaSpinner className="spinner" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!vinculo) {
    return (
      <div className="detalhe-vinculo-page">
        <EmptyState message="Vínculo não encontrado.">
          <Button variant="primary" onClick={() => navigate('/conjunto')}>
            Voltar
          </Button>
        </EmptyState>
      </div>
    );
  }

  const saldo = vinculo.saldo ?? 0;
  const items = transacoes.items || transacoes;

  return (
    <div className="detalhe-vinculo-page">
      <div className="detalhe-vinculo-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/conjunto')}>
          Voltar
        </Button>
      </div>

      <div className="detalhe-vinculo-placar">
        <Card className="placar-card">
          <h2>{vinculo.nome}</h2>
          <p className="participante-nome">{vinculo.participante}</p>
          <p className={`saldo-atual ${saldo >= 0 ? 'positivo' : 'negativo'}`}>
            {saldo >= 0 ? 'Te devem: ' : 'Você deve: '}
            {formatarMoeda(Math.abs(saldo))}
          </p>
          <Button variant="primary" onClick={() => {
            setModalAcerto(true);
            setAcertoData(new Date().toISOString().split('T')[0]);
          }}>
            Registrar Acerto
          </Button>
        </Card>
      </div>

      <div className="detalhe-vinculo-resumo">
        <Card>
          <SectionHeader title="Resumo por período" icon={<FaReceipt />} />
          <PeriodQuickFilter
            dataInicio={periodo.dataInicio}
            dataFim={periodo.dataFim}
            onChange={handlePeriodChange}
          />
          {resumo && (
            <div className="resumo-totais">
              <p>Total: {formatarMoeda(resumo.totalGeral)}</p>
              <p>Sua parte: {formatarMoeda(resumo.parteUsuarioGeral)}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="detalhe-vinculo-transacoes">
        <Card>
          <SectionHeader title="Lançamentos conjuntos" icon={<FaReceipt />} />
          {items.length === 0 ? (
            <EmptyState message="Nenhuma transação conjunta" />
          ) : (
            <ul className="lista-transacoes">
              {items.map((t) => (
                <li key={t._id}>
                  <div className="transacao-item">
                    <span className="transacao-desc">{t.descricao}</span>
                    <span className="transacao-detalhe">
                      {t.contaConjunta?.pagoPor === 'outro' ? 'Outro pagou' : 'Eu paguei'} ·{' '}
                      {formatarMoeda(t.contaConjunta?.valorTotal || t.valor)} total
                    </span>
                    <span className="transacao-parte">Sua parte: {formatarMoeda(t.contaConjunta?.parteUsuario ?? t.valor)}</span>
                    <span className="transacao-data">{formatarData(t.data)}</span>
                    <Badge variant={t.contaConjunta?.acertadoEm ? 'success' : 'warning'}>
                      {t.contaConjunta?.acertadoEm ? 'Quitado' : 'Pendente'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="detalhe-vinculo-acertos">
        <Card>
          <SectionHeader title="Histórico de acertos" icon={<FaReceipt />} />
          {acertos.length === 0 ? (
            <EmptyState message="Nenhum acerto registrado" />
          ) : (
            <ul className="lista-acertos">
              {acertos.map((a) => (
                <li key={a._id}>
                  <span className="acerto-data">{formatarData(a.data)}</span>
                  <span className="acerto-dir">{a.direcao === 'paguei' ? 'Paguei' : 'Recebi'}</span>
                  <span className="acerto-valor">{formatarMoeda(a.valor)}</span>
                  {a.observacao && <span className="acerto-obs">{a.observacao}</span>}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleEstornarAcerto(a._id)}
                    disabled={estornandoId === a._id}
                  >
                    {estornandoId === a._id ? 'Estornando...' : 'Estornar'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {modalAcerto && (
        <div className="modal-overlay" onClick={() => !salvandoAcerto && setModalAcerto(false)}>
          <div className="modal-content modal-acerto" onClick={(e) => e.stopPropagation()}>
            <h3>Registrar Acerto</h3>
            <form onSubmit={handleRegistrarAcerto}>
              <div className="form-group">
                <label>Valor</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={acertoValor}
                  onChange={(e) => setAcertoValor(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Direção</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="direcao"
                      value="paguei"
                      checked={acertoDirecao === 'paguei'}
                      onChange={() => setAcertoDirecao('paguei')}
                    />
                    {' '}Paguei ao participante
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="direcao"
                      value="recebi"
                      checked={acertoDirecao === 'recebi'}
                      onChange={() => setAcertoDirecao('recebi')}
                    />
                    {' '}Recebi do participante
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label>Data</label>
                <input
                  type="date"
                  value={acertoData}
                  onChange={(e) => setAcertoData(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Observação (opcional)</label>
                <input
                  type="text"
                  value={acertoObservacao}
                  onChange={(e) => setAcertoObservacao(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={() => setModalAcerto(false)} disabled={salvandoAcerto}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={salvandoAcerto}>
                  {salvandoAcerto ? 'Salvando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetalheVinculoPage;
