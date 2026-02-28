import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaExchangeAlt, FaSpinner, FaArrowRight, FaCheck, FaClock } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './TransferenciasPage.css';

const TIPOS_LABEL = {
  corrente: 'Conta Corrente',
  rendimento_automatico: 'Rendimento Automático',
  caixinha: 'Caixinha',
  investimento_fixo: 'Investimento Fixo'
};

const TransferenciasPage = () => {
  const navigate = useNavigate();
  const [subcontas, setSubcontas] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [form, setForm] = useState({
    subcontaOrigemId: '',
    subcontaDestinoId: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd')
  });

  const carregar = async () => {
    try {
      setCarregando(true);
      const [subs, trans] = await Promise.all([
        patrimonioApi.listarSubcontas(),
        patrimonioApi.listarTransferencias(filtroStatus || undefined)
      ]);
      setSubcontas(subs.filter(s => s.ativo !== false));
      setTransferencias(trans);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [filtroStatus]);

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatarData = (d) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '-';

  const labelSubconta = (sc) => {
    const inst = sc.instituicao?.nome || 'Inst';
    const tipo = TIPOS_LABEL[sc.tipo] || sc.tipo;
    return `${inst} - ${sc.nome} (${tipo})`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valorNum = parseFloat(form.valor?.replace(',', '.'));
    if (!form.subcontaOrigemId || !form.subcontaDestinoId) {
      toast.warn('Selecione origem e destino');
      return;
    }
    if (form.subcontaOrigemId === form.subcontaDestinoId) {
      toast.warn('Origem e destino devem ser diferentes');
      return;
    }
    if (isNaN(valorNum) || valorNum <= 0) {
      toast.warn('Informe um valor válido');
      return;
    }
    try {
      setSalvando(true);
      await patrimonioApi.criarTransferencia({
        subcontaOrigemId: form.subcontaOrigemId,
        subcontaDestinoId: form.subcontaDestinoId,
        valor: valorNum,
        data: form.data ? new Date(form.data).toISOString() : new Date().toISOString()
      });
      toast.success('Transferência registrada');
      setForm({ ...form, subcontaOrigemId: '', subcontaDestinoId: '', valor: '' });
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao registrar transferência');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="transferencias-page">
      <button className="btn-voltar" onClick={() => navigate('/patrimonio')}>
        ← Voltar ao Patrimônio
      </button>

      <h1><FaExchangeAlt /> Transferências entre Contas</h1>
      <p className="subtitulo">
        Registre transferências entre suas subcontas (ex.: Caixinha → Conta Corrente). 
        Ao importar OFX, você poderá vincular transações do extrato a transferências pendentes.
      </p>

      <section className="form-section">
        <h2>Nova transferência</h2>
        <form onSubmit={handleSubmit} className="transferencia-form">
          <div className="form-row">
            <label>De (origem)</label>
            <select
              value={form.subcontaOrigemId}
              onChange={(e) => setForm({ ...form, subcontaOrigemId: e.target.value })}
              required
            >
              <option value="">Selecione a conta de origem</option>
              {subcontas.map((sc) => (
                <option key={sc._id} value={sc._id}>{labelSubconta(sc)}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Para (destino)</label>
            <select
              value={form.subcontaDestinoId}
              onChange={(e) => setForm({ ...form, subcontaDestinoId: e.target.value })}
              required
            >
              <option value="">Selecione a conta de destino</option>
              {subcontas.map((sc) => (
                <option key={sc._id} value={sc._id}>{labelSubconta(sc)}</option>
              ))}
            </select>
          </div>
          <div className="form-row-duo">
            <div className="form-row">
              <label>Valor (R$)</label>
              <input
                type="text"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label>Data</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" disabled={salvando}>
            {salvando ? <><FaSpinner className="spin" /> Salvando...</> : <><FaExchangeAlt /> Registrar transferência</>}
          </button>
        </form>
      </section>

      <section className="lista-section">
        <div className="lista-header">
          <h2>Histórico</h2>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="filtro-status"
          >
            <option value="">Todas</option>
            <option value="pendente">Pendentes</option>
            <option value="concluida">Concluídas</option>
          </select>
        </div>

        {carregando ? (
          <div className="loading"><FaSpinner className="spin" /> Carregando...</div>
        ) : transferencias.length === 0 ? (
          <p className="vazio">Nenhuma transferência registrada.</p>
        ) : (
          <ul className="lista-transferencias">
            {transferencias.map((t) => (
              <li key={t._id} className={`transferencia-item status-${t.status}`}>
                <div className="transferencia-info">
                  <div className="origem-destino">
                    <span className="conta">{t.subcontaOrigem?.nome || '-'}</span>
                    <FaArrowRight className="arrow" />
                    <span className="conta">{t.subcontaDestino?.nome || '-'}</span>
                  </div>
                  <div className="transferencia-meta">
                    <span className="valor">{formatarMoeda(t.valor)}</span>
                    <span className="data">{formatarData(t.data)}</span>
                  </div>
                </div>
                <div className="transferencia-status">
                  {t.status === 'concluida' ? (
                    <span className="badge concluida"><FaCheck /> Concluída</span>
                  ) : (
                    <span className="badge pendente"><FaClock /> Pendente</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default TransferenciasPage;
