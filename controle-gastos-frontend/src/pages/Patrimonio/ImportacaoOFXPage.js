import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUpload, FaSpinner, FaChevronRight, FaFileAlt } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import { toast } from 'react-toastify';
import SubcontaSelect from '../../components/shared/SubcontaSelect';
import './ImportacaoOFXPage.css';

const ImportacaoOFXPage = () => {
  const navigate = useNavigate();
  const [importacoes, setImportacoes] = useState([]);
  const [subcontas, setSubcontas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [subcontaId, setSubcontaId] = useState('');
  const [arquivo, setArquivo] = useState(null);

  const carregar = async () => {
    try {
      setCarregando(true);
      const [imp, sub] = await Promise.all([
        patrimonioApi.listarImportacoesOFX(),
        patrimonioApi.listarSubcontas()
      ]);
      setImportacoes(imp);
      setSubcontas(sub.filter(s => ['corrente', 'rendimento_automatico'].includes(s.tipo)));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar importações');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatarData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!arquivo || !subcontaId) {
      toast.warn('Selecione o arquivo OFX e a subconta');
      return;
    }
    try {
      setEnviando(true);
      const imp = await patrimonioApi.uploadOFX(arquivo, subcontaId);
      toast.success('Arquivo processado com sucesso');
      setArquivo(null);
      setSubcontaId('');
      navigate(`/patrimonio/importacoes-ofx/${imp._id}`);
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao processar arquivo OFX');
    } finally {
      setEnviando(false);
    }
  };

  const statusLabel = (s) => {
    const map = { processando: 'Processando', revisao: 'Em revisão', finalizada: 'Finalizada', cancelada: 'Cancelada' };
    return map[s] || s;
  };

  return (
    <div className="importacao-ofx-page">
      <h1>Importação OFX</h1>
      <p className="subtitulo">Importe extratos bancários no formato OFX para atualizar o saldo da subconta.</p>

      <section className="upload-section">
        <h2>Nova importação</h2>
        <form onSubmit={handleUpload} className="upload-form">
          <div className="form-row">
            <label>Subconta</label>
            <SubcontaSelect
              subcontas={subcontas}
              value={subcontaId}
              onChange={setSubcontaId}
              placeholder="Selecione a subconta"
              filterTipos={['corrente', 'rendimento_automatico']}
            />
          </div>
          <div className="form-row">
            <label>Arquivo OFX</label>
            <input
              type="file"
              accept=".ofx,.qfx"
              onChange={(e) => setArquivo(e.target.files?.[0])}
              required
            />
          </div>
          <button type="submit" disabled={enviando}>
            {enviando ? <><FaSpinner className="spin" /> Processando...</> : <><FaUpload /> Enviar</>}
          </button>
        </form>
      </section>

      <section className="lista-section">
        <h2>Importações recentes</h2>
        {carregando ? (
          <div className="loading"><FaSpinner className="spin" /> Carregando...</div>
        ) : importacoes.length === 0 ? (
          <p className="vazio">Nenhuma importação OFX ainda.</p>
        ) : (
          <ul className="lista-importacoes">
            {importacoes.map((imp) => (
              <li
                key={imp._id}
                onClick={() => navigate(`/patrimonio/importacoes-ofx/${imp._id}`)}
                style={{
                  borderLeft: `4px solid ${imp.subconta?.instituicao?.cor || 'var(--cor-primaria)'}`
                }}
              >
                <div className="item-info">
                  <FaFileAlt />
                  <div>
                    <strong>{imp.nomeArquivo}</strong>
                    <span>{imp.subconta?.nome || 'Subconta'} • {formatarData(imp.createdAt)}</span>
                  </div>
                </div>
                <div className="item-stats">
                  <span className={`status status-${imp.status}`}>{statusLabel(imp.status)}</span>
                  <span>{imp.totalTransacoes} transações</span>
                  <span>Saldo: {formatarMoeda(imp.saldoFinalExtrato)}</span>
                </div>
                <FaChevronRight />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ImportacaoOFXPage;
