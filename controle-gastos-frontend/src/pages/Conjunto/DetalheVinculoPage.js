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
  obterExtratoVinculo,
  registrarAcertoVinculo,
  estornarAcerto
} from '../../api';
import { getDateRangeForPeriod, PERIODOS_RAPIDOS } from '../../utils/dateUtils';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import ModalTransacao from '../../components/Modal/ModalTransacao';
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
  const [acertoTipo, setAcertoTipo] = useState('compensacao');
  const [acertoData, setAcertoData] = useState('');
  const [acertoObservacao, setAcertoObservacao] = useState('');
  const [salvandoAcerto, setSalvandoAcerto] = useState(false);
  const [estornandoId, setEstornandoId] = useState(null);
  const [extrato, setExtrato] = useState({ items: [], total: 0 });
  const [filtroTransacao, setFiltroTransacao] = useState('');

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      setCarregando(true);
      const range = getDateRangeForPeriod(PERIODOS_RAPIDOS.MES_ATUAL);
      const [v, res, trans, ac, ext] = await Promise.all([
        obterVinculoConjunto(id),
        obterResumoVinculo(id, range || {}),
        listarTransacoesVinculo(id, { limit: 50 }),
        listarAcertosVinculo(id),
        obterExtratoVinculo(id, { limit: 50 })
      ]);
      setVinculo(v);
      setResumo(res);
      setTransacoes({ items: trans.items || trans.transacoes || [], total: trans.total || 0 });
      setAcertos(Array.isArray(ac) ? ac : []);
      setExtrato({ items: ext.items || [], total: ext.total || 0 });
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
      const params = { ...periodo, limit: 50 };
      if (filtroTransacao === 'euDevo') params.euDevo = true;
      if (filtroTransacao === 'outroDeve') params.outroDeve = true;
      const [res, trans] = await Promise.all([
        obterResumoVinculo(id, periodo),
        listarTransacoesVinculo(id, params)
      ]);
      setResumo(res);
      setTransacoes({ items: trans.items || trans.transacoes || [], total: trans.total || 0 });
    } catch (err) {
      console.error(err);
    }
  }, [id, periodo, filtroTransacao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!carregando && periodo.dataInicio) {
      carregarComPeriodo();
    }
  }, [carregando, carregarComPeriodo, periodo.dataInicio, periodo.dataFim, filtroTransacao]);

  const handlePeriodChange = (p) => {
    setPeriodo(prev => ({ ...prev, ...p }));
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
      const payload = {
        valor,
        direcao: acertoDirecao,
        data: acertoData,
        observacao: acertoObservacao || undefined,
        tipo: acertoTipo
      };
      if (acertoTipo === 'pagamento_individual') {
        payload.ladoAfetado = acertoDirecao === 'paguei' ? 'usuario' : 'participante';
      }
      await registrarAcertoVinculo(id, payload);
      toast.success('Acerto registrado com sucesso.');
      setModalAcerto(false);
      setAcertoValor('');
      setAcertoDirecao('paguei');
      setAcertoTipo('compensacao');
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

  const saldo = vinculo.saldo ?? resumo?.saldoLiquido ?? 0;
  const totalEuDevo = resumo?.totalEuDevo ?? 0;
  const totalOutroDeve = resumo?.totalOutroDeve ?? 0;
  const saldoLiquido = resumo?.saldoLiquido ?? saldo;
  const items = transacoes.items || transacoes;
  const extratoItems = extrato.items || [];

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
          <div className="resumo-metricas">
            <div className="metrica metrica-eu-devo">
              <span className="metrica-label">Eu devo</span>
              <span className="metrica-valor">{formatarMoeda(totalEuDevo)}</span>
            </div>
            <div className="metrica metrica-outro-deve">
              <span className="metrica-label">Outro deve</span>
              <span className="metrica-valor">{formatarMoeda(totalOutroDeve)}</span>
            </div>
            <div className="metrica metrica-saldo">
              <span className="metrica-label">Saldo líquido</span>
              <span className="metrica-valor">{formatarMoeda(saldoLiquido)}</span>
            </div>
          </div>
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
          <div className="filtros-transacao">
            <span>Filtrar:</span>
            <label>
              <input type="radio" name="filtroTrans" value="" checked={filtroTransacao === ''} onChange={() => setFiltroTransacao('')} />
              {' '}Todos
            </label>
            <label>
              <input type="radio" name="filtroTrans" value="euDevo" checked={filtroTransacao === 'euDevo'} onChange={() => setFiltroTransacao('euDevo')} />
              {' '}O que EU devo
            </label>
            <label>
              <input type="radio" name="filtroTrans" value="outroDeve" checked={filtroTransacao === 'outroDeve'} onChange={() => setFiltroTransacao('outroDeve')} />
              {' '}O que o outro deve
            </label>
          </div>
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

      <div className="detalhe-vinculo-extrato">
        <Card>
          <SectionHeader title="Extrato financeiro" icon={<FaReceipt />} />
          {extratoItems.length === 0 ? (
            <EmptyState message="Nenhum lançamento no extrato" />
          ) : (
            <ul className="lista-extrato">
              {extratoItems.map((item) => (
                <li key={`${item.tipo}-${item._id}`} className={`extrato-item extrato-${item.tipo}`}>
                  {item.tipo === 'transacao' ? (
                    <>
                      <span className="extrato-data">{formatarData(item.data)}</span>
                      <span className="extrato-desc">{item.descricao}</span>
                      <span className="extrato-detalhe">
                        {item.contaConjunta?.pagoPor === 'outro' ? 'Outro pagou' : 'Eu paguei'} · {formatarMoeda(item.contaConjunta?.valorTotal || item.valor)}
                      </span>
                      <Badge variant={item.contaConjunta?.acertadoEm ? 'success' : 'warning'}>
                        {item.contaConjunta?.acertadoEm ? 'Quitado' : 'Pendente'}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <span className="extrato-data">{formatarData(item.data)}</span>
                      <span className="extrato-desc">
                        Acerto: {item.direcao === 'paguei' ? 'Paguei' : 'Recebi'} {formatarMoeda(item.valor)}
                      </span>
                      {item.tipo && (
                        <Badge variant={item.tipo === 'pagamento_individual' ? 'info' : 'neutral'}>
                          {item.tipo === 'pagamento_individual' ? 'Individual' : 'Compensação'}
                        </Badge>
                      )}
                    </>
                  )}
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
                  {a.tipo && (
                    <Badge variant={a.tipo === 'pagamento_individual' ? 'info' : 'neutral'}>
                      {a.tipo === 'pagamento_individual' ? 'Individual' : 'Compensação'}
                    </Badge>
                  )}
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
        <ModalTransacao onClose={() => !salvandoAcerto && setModalAcerto(false)}>
          <div className="modal-acerto-container">
            <h2>Registrar Acerto</h2>
            <form onSubmit={handleRegistrarAcerto} className="modal-acerto-form">
              <div className="form-section modal-acerto-section">
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
                  <label>Tipo de acerto</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="tipo"
                        value="compensacao"
                        checked={acertoTipo === 'compensacao'}
                        onChange={() => setAcertoTipo('compensacao')}
                      />
                      <span>Compensação (padrão)</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="tipo"
                        value="pagamento_individual"
                        checked={acertoTipo === 'pagamento_individual'}
                        onChange={() => setAcertoTipo('pagamento_individual')}
                      />
                      <span>Pagamento individual</span>
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label>Direção</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="direcao"
                        value="paguei"
                        checked={acertoDirecao === 'paguei'}
                        onChange={() => setAcertoDirecao('paguei')}
                      />
                      <span>Paguei ao participante</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="direcao"
                        value="recebi"
                        checked={acertoDirecao === 'recebi'}
                        onChange={() => setAcertoDirecao('recebi')}
                      />
                      <span>Recebi do participante</span>
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
                    placeholder="Ex: Pagamento via PIX"
                  />
                </div>
                <div className="modal-acerto-actions">
                  <Button type="button" variant="ghost" onClick={() => setModalAcerto(false)} disabled={salvandoAcerto}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" disabled={salvandoAcerto}>
                    {salvandoAcerto ? 'Salvando...' : 'Registrar'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </ModalTransacao>
      )}
    </div>
  );
};

export default DetalheVinculoPage;
