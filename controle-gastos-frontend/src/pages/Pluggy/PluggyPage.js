import React, { useState, useEffect } from 'react';
import { FaSync, FaCog, FaSpinner, FaCheck, FaPlus, FaTrash, FaPlug, FaLink, FaTimes, FaChevronRight } from 'react-icons/fa';
import { PluggyConnect } from 'react-pluggy-connect';
import pluggyApi from '../../services/pluggyApi';
import patrimonioApi from '../../services/patrimonioApi';
import { toast } from 'react-toastify';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import Pagination from '../../components/shared/Pagination';
import './PluggyPage.css';
import { formatDateBR } from '../../utils/dateUtils';

const PluggyPage = () => {
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [importacoes, setImportacoes] = useState([]);
  const [subcontas, setSubcontas] = useState([]);
  const [instituicoes, setInstituicoes] = useState([]);
  const [conexoes, setConexoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [expandedSyncId, setExpandedSyncId] = useState(null);
  const [importacoesPagina, setImportacoesPagina] = useState(1);
  const [importacoesTotalPaginas, setImportacoesTotalPaginas] = useState(0);
  const [importacoesTotal, setImportacoesTotal] = useState(0);

  const [showConfigForm, setShowConfigForm] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [ambiente, setAmbiente] = useState('sandbox');
  const [testando, setTestando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingItemId, setMappingItemId] = useState('');
  const [mappingConnectorName, setMappingConnectorName] = useState('');
  const [modalAccounts, setModalAccounts] = useState([]);
  const [modalMappings, setModalMappings] = useState({});
  const [existingMapped, setExistingMapped] = useState({});
  const [salvandoMapping, setSalvandoMapping] = useState(false);

  const [criandoSubcontaFor, setCriandoSubcontaFor] = useState({});
  const [novoSubcontaNome, setNovoSubcontaNome] = useState('');
  const [novoSubcontaTipo, setNovoSubcontaTipo] = useState('corrente');
  const [novoSubcontaInstituicao, setNovoSubcontaInstituicao] = useState('');
  const [novoSubcontaSaldo, setNovoSubcontaSaldo] = useState('');
  const [subcriando, setSubcriando] = useState(false);

  const [novoItemId, setNovoItemId] = useState('');
  const carregandoItemAccounts = false;

  const [showWidget, setShowWidget] = useState(false);
  const [connectToken, setConnectToken] = useState(null);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const carregarImportacoes = async (pagina) => {
    try {
      const result = await pluggyApi.listarImportacoes(pagina);
      setImportacoes(result.data || []);
      setImportacoesTotalPaginas(result.totalPages || 0);
      setImportacoesTotal(result.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const carregar = async () => {
    try {
      setCarregando(true);
      const [cfg, itms, subs, status, insts, conns] = await Promise.all([
        pluggyApi.obterConfig(),
        pluggyApi.listarItems(),
        patrimonioApi.listarSubcontas(),
        pluggyApi.obterStatusSync(),
        patrimonioApi.listarInstituicoes(),
        pluggyApi.listarConexoes()
      ]);
      setConfig(cfg);
      setItems(itms.items || []);
      setSubcontas(subs);
      setInstituicoes(insts || []);
      setSyncStatus(status);
      setConexoes(conns.conexoes || []);
      if (cfg.configurado) {
        setClientId(cfg.clientId || '');
        setAmbiente(cfg.ambiente || 'sandbox');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados Pluggy');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    carregarImportacoes(importacoesPagina);
  }, [importacoesPagina]);

  const formatarData = (d) => d ? formatDateBR(d) : '-';
  const formatarDataHora = (d) => d ? new Date(d).toLocaleString('pt-BR') : '-';
  const formatarMoeda = (v) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleTestarConexao = async () => {
    if (!clientId || !clientSecret) {
      toast.warn('Informe clientId e clientSecret');
      return;
    }
    try {
      setTestando(true);
      const resultado = await pluggyApi.testarConexao({ clientId, clientSecret, ambiente });
      if (resultado.ok) {
        toast.success(resultado.mensagem);
      } else {
        toast.error(resultado.mensagem);
      }
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.mensagem) || 'Erro ao testar conexao');
    } finally {
      setTestando(false);
    }
  };

  const handleSalvarConfig = async () => {
    if (!clientId || !clientSecret) {
      toast.warn('Informe clientId e clientSecret');
      return;
    }
    try {
      setSalvando(true);
      await pluggyApi.salvarConfig({ clientId, clientSecret, ambiente });
      toast.success('Configuracao salva com sucesso');
      setClientSecret('');
      setShowConfigForm(false);
      await carregar();
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao salvar configuracao');
    } finally {
      setSalvando(false);
    }
  };

  const handleConectarBanco = async () => {
    if (!config || !config.configurado) {
      toast.warn('Configure as credenciais Pluggy primeiro');
      return;
    }
    try {
      setWidgetLoading(true);
      const result = await pluggyApi.criarConnectToken();
      setConnectToken(result.accessToken);
      setShowWidget(true);
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao abrir widget');
    } finally {
      setWidgetLoading(false);
    }
  };

  const handleWidgetSuccess = async (data) => {
    const item = data && data.item;
    if (!item || !item.id) {
      toast.error('Item ID nao recebido do widget');
      return;
    }
    setShowWidget(false);
    setConnectToken(null);

    try {
      const connectorName = item.connector && item.connector.name ? item.connector.name : '';
      // Save the connection immediately so user can map later even if they close the modal
      await pluggyApi.salvarConexao(item.id, connectorName);
      const accountsData = await pluggyApi.obterAccountsDoItem(item.id);
      const accs = accountsData && accountsData.accounts ? accountsData.accounts : [];
      setConexoes(prev => {
        const exists = prev.some(c => c.itemId === item.id);
        if (exists) return prev;
        return [...prev, { itemId: item.id, connectorName, connectedAt: new Date().toISOString() }];
      });
      setModalAccounts(accs);
      setExistingMapped({});
      setModalMappings({});
      setMappingItemId(item.id);
      setMappingConnectorName(connectorName);
      setShowMappingModal(true);
      toast.success('Banco conectado com sucesso! Selecione as contas para mapear.');
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao carregar accounts do item');
    }
  };

  const handleWidgetError = (error) => {
    setShowWidget(false);
    setConnectToken(null);
    const msg = error && error.message ? error.message : 'Erro no widget';
    toast.error('Erro na conexao: ' + msg);
  };

  const handleWidgetClose = () => {
    setShowWidget(false);
    setConnectToken(null);
  };

  const handleMappingChange = (accountId, subcontaId) => {
    if (subcontaId === '__NEW__') {
      setCriandoSubcontaFor(prev => ({ ...prev, [accountId]: true }));
      setNovoSubcontaNome('');
      setNovoSubcontaTipo(accountId && modalAccounts.find(a => a.id === accountId)?.type === 'CREDIT' ? 'cartao_credito' : 'corrente');
      setNovoSubcontaInstituicao('');
      setNovoSubcontaSaldo('');
      setModalMappings(prev => ({ ...prev, [accountId]: '__NEW__' }));
    } else {
      setCriandoSubcontaFor(prev => ({ ...prev, [accountId]: false }));
      setModalMappings(prev => ({ ...prev, [accountId]: subcontaId }));
    }
  };

  const handleCriarSubconta = async (accountId) => {
    if (!novoSubcontaNome || !novoSubcontaInstituicao) {
      toast.warn('Preencha nome e instituicao da nova subconta');
      return;
    }
    try {
      setSubcriando(true);
      const tipoMap = {
        corrente: 'disponivel',
        rendimento_automatico: 'reserva_emergencia',
        caixinha: 'objetivo',
        investimento_fixo: 'guardado',
        cartao_credito: 'disponivel'
      };
      const saldo = parseFloat(novoSubcontaSaldo) || 0;
      const result = await patrimonioApi.criarSubconta({
        nome: novoSubcontaNome,
        tipo: novoSubcontaTipo,
        instituicao: novoSubcontaInstituicao,
        proposito: tipoMap[novoSubcontaTipo] || 'disponivel',
        saldoAtual: saldo > 0 ? saldo : undefined,
        fechamentoFatura: novoSubcontaTipo === 'cartao_credito' ? 0 : undefined
      });
      const novaSub = result.subconta || result;
      setSubcontas(prev => [...prev, novaSub]);
      setModalMappings(prev => ({ ...prev, [accountId]: novaSub._id }));
      setCriandoSubcontaFor(prev => ({ ...prev, [accountId]: false }));
      toast.success('Subconta criada e mapeada com sucesso');
    } catch (err) {
      toast.error((err.response && err.response.data && (err.response.data.erro || err.response.data.mensagem)) || 'Erro ao criar subconta');
    } finally {
      setSubcriando(false);
    }
  };

  const handleMapearMais = async (itemId, connectorName) => {
    try {
      const accs = await pluggyApi.obterAccountsDoItem(itemId);
      const mapped = {};
      const doItem = items.filter(i => i.itemId === itemId);
      doItem.forEach(m => {
        const sub = subcontas.find(s => s._id === m.subconta);
        mapped[m.accountId] = {
          subcontaId: m.subconta,
          subcontaNome: sub ? sub.nome : '?'
        };
      });
      setModalAccounts(accs.accounts || []);
      setExistingMapped(mapped);
      setModalMappings({});
      setMappingItemId(itemId);
      setMappingConnectorName(connectorName);
      setShowMappingModal(true);
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao carregar accounts');
    }
  };

  const handleSalvarTodos = async () => {
    const entries = Object.entries(modalMappings).filter(([, subcontaId]) => subcontaId && subcontaId !== '__NEW__');
    if (entries.length === 0) {
      toast.warn('Selecione ao menos uma subconta para mapear');
      return;
    }
    try {
      setSalvandoMapping(true);
      const mapeamentos = entries.map(([accountId, subcontaId]) => {
        const acc = modalAccounts.find(a => a.id === accountId);
        return {
          accountId,
          accountType: acc ? acc.type : 'BANK',
          accountSubtype: acc ? acc.subtype : null,
          accountName: acc ? (acc.name || acc.marketingName || '') : '',
          accountNumber: acc ? acc.number : '',
          subcontaId
        };
      });
      await pluggyApi.adicionarItemsBatch({
        itemId: mappingItemId,
        connectorName: mappingConnectorName,
        mapeamentos
      });
      toast.success(mapeamentos.length + ' mapeamento(s) salvo(s) com sucesso');
      setShowMappingModal(false);
      setModalMappings({});
      setExistingMapped({});
      setModalAccounts([]);
      setMappingItemId('');
      setMappingConnectorName('');
      await carregar();
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao salvar mapeamentos');
    } finally {
      setSalvandoMapping(false);
    }
  };

  const handleRemoverItem = async (itemId, accountId) => {
    if (!window.confirm('Remover este mapeamento?')) return;
    try {
      await pluggyApi.removerItem(itemId, accountId);
      toast.success('Mapeamento removido');
      await carregar();
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao remover mapeamento');
    }
  };

  const handleRemoverConexao = async (itemId) => {
    if (!window.confirm('Remover esta conexao? Os mapeamentos existentes serao mantidos.')) return;
    try {
      await pluggyApi.removerConexao(itemId);
      setConexoes(prev => prev.filter(c => c.itemId !== itemId));
      toast.success('Conexao removida');
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao remover conexao');
    }
  };

  const handleSync = async () => {
    if (items.length === 0) {
      toast.warn('Adicione pelo menos um mapeamento antes de sincronizar');
      return;
    }
    try {
      setSincronizando(true);
      const resultado = await pluggyApi.iniciarSync({});
      const totalTransacoes = (resultado.importacao && resultado.importacao.totalTransacoes) || 0;
      const totalJaImportadas = (resultado.importacao && resultado.importacao.totalJaImportadas) || 0;
      toast.success('Sincronizacao concluida: ' + totalTransacoes + ' transacoes encontradas, ' + totalJaImportadas + ' ja importadas');
      setImportacoesPagina(1);
      await carregar();
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao sincronizar');
    } finally {
      setSincronizando(false);
    }
  };

  const statusLabel = (s) => {
    const map = { processando: 'Processando', revisao: 'Em revisao', finalizada: 'Finalizada', cancelada: 'Cancelada', erro: 'Erro' };
    return map[s] || s;
  };

  const statusColor = (s) => {
    const map = { UPDATED: '#4caf50', UPDATING: '#ff9800', LOGIN_ERROR: '#f44336', OUTDATED: '#ff9800', DESCONHECIDO: '#9e9e9e' };
    return map[s] || '#9e9e9e';
  };

  const formatarProximoSync = () => {
    if (!syncStatus || !syncStatus.proximoSync) return 'Aguardando primeiro sync';
    return formatarDataHora(syncStatus.proximoSync);
  };

  if (carregando) {
    return (
      <div className="pluggy-page">
        <div className="loading"><FaSpinner className="spin" /> Carregando...</div>
      </div>
    );
  }

  return (
    <div className="pluggy-page">
      <h1><FaPlug /> Pluggy - Open Finance</h1>
      <p className="subtitulo">Sincronize automaticamente transacoes das suas contas bancarias via Pluggy.</p>

      <Card className="pluggy-section">
        <h2>Configuracao</h2>
        {config && config.configurado ? (
          <div className="config-status">
            <div className="config-info">
              <span className={'status-badge ' + (config.ativo ? 'ativo' : 'inativo')}>
                {config.ativo ? 'Configurado' : 'Inativo'}
              </span>
              <span className="info-label">Client ID</span>
              <span className="info-value">{config.clientId}</span>
              <span className="info-label">Ambiente</span>
              <span className="info-value">{config.ambiente}</span>
              {config.ultimaSync && config.ultimaSync.data && (
                <>
                  <span className="info-label">Ultimo sync</span>
                  <span className="info-value">{formatarDataHora(config.ultimaSync.data)} ({config.ultimaSync.totalTransacoes} transacoes)</span>
                </>
              )}
              {config.ultimoTesteConexao && config.ultimoTesteConexao.data && (
                <>
                  <span className="info-label">Ultimo teste</span>
                  <span className="info-value">{formatarDataHora(config.ultimoTesteConexao.data)} - {config.ultimoTesteConexao.sucesso ? 'Sucesso' : 'Falha'}</span>
                </>
              )}
            </div>
            <Button variant="secondary" onClick={() => setShowConfigForm(!showConfigForm)}>
              <FaCog /> Alterar credenciais
            </Button>
          </div>
        ) : (
          <div className="config-nao-configurado">
            <p>Pluggy nao configurado. Informe suas credenciais para comecar.</p>
            <Button variant="primary" onClick={() => setShowConfigForm(true)}>
              <FaCog /> Configurar credenciais
            </Button>
          </div>
        )}

        {showConfigForm && (
          <div className="config-form">
            <div className="form-row">
              <label>Client ID</label>
              <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Seu Client ID" />
            </div>
            <div className="form-row">
              <label>Client Secret</label>
              <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Seu Client Secret" />
            </div>
            <div className="form-row">
              <label>Ambiente</label>
              <select value={ambiente} onChange={(e) => setAmbiente(e.target.value)}>
                <option value="sandbox">Sandbox (testes)</option>
                <option value="production">Production</option>
              </select>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={handleTestarConexao} disabled={testando}>
                {testando ? <><FaSpinner className="spin" /> Testando...</> : 'Testar conexao'}
              </Button>
              <Button variant="primary" onClick={handleSalvarConfig} disabled={salvando}>
                {salvando ? <><FaSpinner className="spin" /> Salvando...</> : <><FaCheck /> Salvar</>}
              </Button>
              {!config || !config.configurado ? (
                <Button variant="ghost" onClick={() => setShowConfigForm(false)}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      <Card className="pluggy-section">
        <div className="section-header">
          <h2>Conectar Banco</h2>
          <Button variant="primary" onClick={handleConectarBanco} disabled={widgetLoading || !config || !config.configurado}>
            {widgetLoading ? <><FaSpinner className="spin" /> Abrindo...</> : <><FaLink /> Conectar banco</>}
          </Button>
        </div>
        <div className="etapas-guia">
          <span className={'etapa-passo' + (config && config.configurado ? ' concluida' : '')}>
            <FaCheck /> 1. Credenciais
          </span>
          <FaChevronRight className="etapa-seta" />
          <span className="etapa-passo ativa">
            2. Conectar
          </span>
          <FaChevronRight className="etapa-seta" />
          <span className="etapa-passo">
            3. Mapear contas
          </span>
          <FaChevronRight className="etapa-seta" />
          <span className="etapa-passo">
            4. Sincronizar
          </span>
        </div>
      </Card>

      {conexoes.length > 0 && (
        <Card className="pluggy-section">
          <div className="section-header">
            <h2>Conexoes ativas</h2>
          </div>
          <ul className="lista-conexoes">
            {conexoes.map((c) => {
              const hasMapping = items.some(i => i.itemId === c.itemId);
              return (
                <li key={c.itemId} className={'conexao-item' + (hasMapping ? ' has-mapping' : '')}>
                  <div className="conexao-info">
                    <span className="conexao-connector">{c.connectorName || 'Banco'}</span>
                    <span className="conexao-itemid">ID: {c.itemId}</span>
                    <span className="conexao-data">Conectado em: {formatarDataHora(c.connectedAt)}</span>
                    {hasMapping && <span className="status-badge ativo">Com mapeamento</span>}
                    {!hasMapping && <span className="status-badge inativo">Sem mapeamento</span>}
                  </div>
                  <div className="conexao-actions">
                    <Button variant="secondary" size="sm" onClick={() => handleMapearMais(c.itemId, c.connectorName)}>
                      <FaPlus /> Mapear contas
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleRemoverConexao(c.itemId)}>
                      <FaTrash />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      )}

      <Card className="pluggy-section">
        <div className="section-header">
          <h2>Mapeamentos (Item/Account - Subconta)</h2>
          <div className="header-actions">
            <details className="details-manual">
              <summary>Adicionar manualmente (Item ID)</summary>
              <div className="add-item-inline">
                <input
                  type="text"
                  value={novoItemId}
                  onChange={(e) => setNovoItemId(e.target.value)}
                  placeholder="Item ID (do MeuPluggy)"
                  className="item-id-input"
                />
                <input
                  type="text"
                  value={mappingConnectorName}
                  onChange={(e) => setMappingConnectorName(e.target.value)}
                  placeholder="Nome do banco"
                  className="connector-name-input"
                />
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => handleMapearMais(novoItemId, mappingConnectorName)}
                  disabled={carregandoItemAccounts || !novoItemId}
                >
                  {carregandoItemAccounts ? <FaSpinner className="spin" /> : <FaPlus />} Carregar accounts
                </Button>
              </div>
            </details>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="vazio">Nenhum mapeamento cadastrado. Use "Conectar banco" acima para comecar.</p>
        ) : (
          <ul className="lista-mapeamentos">
            {items.map((item) => {
              const sub = subcontas.find(s => s._id === item.subconta);
              return (
                <li key={item.itemId + '-' + item.accountId}>
                  <div className="item-info">
                    <span className="connector-name">{item.connectorName || 'Banco'}</span>
                    <span className="account-name">{item.accountName || item.accountId}</span>
                    <span className="subconta-name">
                      - {sub ? sub.nome : 'Subconta'}
                      {sub && sub.instituicao ? ' (' + sub.instituicao.nome + ')' : ''}
                    </span>
                  </div>
                  <div className="item-meta">
                    <span className="status-dot" style={{ backgroundColor: statusColor(item.status) }} />
                    <span className="status-text">{item.statusDetalhado ? item.statusDetalhado.label : item.status}</span>
                    {item.lastSyncAt && <span className="last-sync">Sync: {formatarDataHora(item.lastSyncAt)}</span>}
                    {sub && <span className="subconta-saldo-lista">Saldo: {formatarMoeda(sub.saldoAtual)}</span>}
                  </div>
                  <div className="item-actions">
                    <Button variant="secondary" size="sm" onClick={() => handleMapearMais(item.itemId, item.connectorName)} title="Mapear mais contas deste item">
                      <FaPlus /> Mapear
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleRemoverItem(item.itemId, item.accountId)}>
                      <FaTrash />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="pluggy-section">
        <div className="section-header">
          <h2>Sincronizacao</h2>
          <div className="sync-header-actions">
            {syncStatus && syncStatus.proximoSync && (
              <span className="proximo-sync-label">Proximo sync automatico: {formatarProximoSync()}</span>
            )}
            <Button variant="success" onClick={handleSync} disabled={sincronizando || items.length === 0}>
              {sincronizando ? <><FaSpinner className="spin" /> Sincronizando...</> : <><FaSync /> Sincronizar agora</>}
            </Button>
          </div>
        </div>

        <ul className="lista-importacoes">
          {importacoes.length === 0 ? (
            <li className="vazio-item">
              {importacoesPagina > 1 ? 'Nenhuma sync nesta página.' : 'Nenhuma sincronizacao realizada ainda.'}
            </li>
          ) : null}
          {importacoes.map((imp) => {
              const expanded = expandedSyncId === imp._id;
              const totalMoedas = Object.keys(imp.itens?.reduce((acc, it) => { Object.assign(acc, it.moedas); return acc; }, {}) || {}).length;
              return (
                <li key={imp._id} className={'sync-item' + (expanded ? ' sync-item--expanded' : '')} onClick={() => setExpandedSyncId(expanded ? null : imp._id)}>
                  <div className="sync-item__header">
                    <div className="item-info">
                      <FaSync />
                      <div>
                        <strong>Sync {formatarDataHora(imp.createdAt)}</strong>
                        <span className="sync-summary">
                          {imp.totalTransacoes} transações
                          {imp.totalPendentes > 0 ? ' ' : ''}{imp.totalPendentes > 0 && <span className="sync-pending-badge">{imp.totalPendentes} PENDING</span>}
                          {imp.totalJaImportadas > 0 ? ' ' : ''}{imp.totalJaImportadas > 0 && <span className="sync-duplicate-badge">{imp.totalJaImportadas} duplicadas</span>}
                          {imp.totalCreditos > 0 ? ' ' : ''}{imp.totalCreditos > 0 && <span>Créditos: {formatarMoeda(imp.totalCreditos)}</span>}
                          {imp.totalDebitos > 0 ? ' ' : ''}{imp.totalDebitos > 0 && <span>Débitos: {formatarMoeda(imp.totalDebitos)}</span>}
                        </span>
                        {imp.itens?.length > 0 && (
                          <span className="sync-accounts-line">
                            {imp.itens.map((it, i) => (
                              <span key={i} className={'sync-acct-tag sync-acct-tag--' + (it.accountType || 'BANK').toLowerCase()}>
                                {it.connectorName || it.accountName || it.accountId}
                                {it.accountType === 'CREDIT' ? ' (CR)' : ''}
                              </span>
                            ))}
                          </span>
                        )}
                        {(imp.dataInicioSync || imp.dataFimSync) && (
                          <span className="sync-periodo">
                            Período: {imp.dataInicioSync ? formatarData(imp.dataInicioSync) : '—'} a {imp.dataFimSync ? formatarData(imp.dataFimSync) : '—'}
                          </span>
                        )}
                        {totalMoedas > 1 && (
                          <span className="sync-moedas-line">
                            Moedas: {imp.itens?.reduce((acc, it) => {
                              if (it.moedas) Object.entries(it.moedas).forEach(([moeda, qtd]) => { acc[moeda] = (acc[moeda] || 0) + qtd; });
                              return acc;
                            }, {}) && Object.entries(imp.itens.reduce((acc, it) => {
                              if (it.moedas) Object.entries(it.moedas).forEach(([moeda, qtd]) => { acc[moeda] = (acc[moeda] || 0) + qtd; });
                              return acc;
                            }, {})).filter(([m]) => m !== 'BRL').map(([moeda, qtd]) => `${qtd}x ${moeda}`).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="item-stats">
                      <span className={'status status-' + imp.status}>{statusLabel(imp.status)}</span>
                    </div>
                  </div>
                  {expanded && imp.itens?.length > 0 && (
                    <div className="sync-item__detail">
                      <table className="sync-detail-table">
                        <thead>
                          <tr>
                            <th>Conta</th>
                            <th>Tipo</th>
                            <th>Trans.</th>
                            <th>Créditos</th>
                            <th>Débitos</th>
                            <th>PEND.</th>
                            <th>Ignor.</th>
                            <th>Dup.</th>
                            <th>Saldo (Pluggy)</th>
                            <th>Erro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imp.itens.map((it, i) => (
                            <tr key={i}>
                              <td>
                                <span className="sync-acct-name">{it.accountName || it.accountId}</span>
                                <span className="sync-connector-name">{it.connectorName || ''}</span>
                              </td>
                              <td><span className={'sync-type-badge sync-type-badge--' + (it.accountType || 'bank').toLowerCase()}>{it.accountType || 'BANK'}</span></td>
                              <td>{it.totalTransacoes}</td>
                              <td className="valor-credito">{it.totalCreditos > 0 ? formatarMoeda(it.totalCreditos) : '-'}</td>
                              <td className="valor-debito">{it.totalDebitos > 0 ? formatarMoeda(it.totalDebitos) : '-'}</td>
                              <td>{it.totalPendentes > 0 ? <span className="sync-pending-badge">{it.totalPendentes}</span> : '0'}</td>
                              <td>{it.totalIgnoradas || '0'}</td>
                              <td>{it.totalJaImportadas || '0'}</td>
                              <td className="valor-saldo">{it.saldoPluggy != null ? formatarMoeda(it.saldoPluggy) : '-'}</td>
                              <td>{it.erro ? <span className="sync-erro-label" title={it.erro}>Erro</span> : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {imp.erro && <div className="sync-erro-geral"><strong>Erro geral:</strong> {imp.erro}</div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination
            page={importacoesPagina}
            totalPages={importacoesTotalPaginas}
            totalRecords={importacoesTotal}
            onPageChange={setImportacoesPagina}
          />
      </Card>

      {showWidget && connectToken && (
        <div className="widget-overlay">
          <div className="widget-container">
            <div className="widget-header">
              <h3>Conectar Banco</h3>
              <button className="widget-close" onClick={handleWidgetClose}>
                <FaTimes />
              </button>
            </div>
            <div className="widget-body">
              <PluggyConnect
                connectToken={connectToken}
                onSuccess={handleWidgetSuccess}
                onError={handleWidgetError}
                onClose={handleWidgetClose}
                language="pt"
                includeSandbox={ambiente === 'sandbox'}
              />
            </div>
          </div>
        </div>
      )}

      {showMappingModal && (
        <div className="modal-overlay" onClick={() => setShowMappingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Mapear contas - {mappingConnectorName || 'Banco'}</h3>
            {modalAccounts.length === 0 ? (
              <p>Nenhuma account encontrada neste item.</p>
            ) : (
              <>
                <div className="accounts-list">
                  {modalAccounts.map((acc) => {
                    const already = existingMapped[acc.id];
                    return (
                      <div key={acc.id} className={'account-item' + (already ? ' already-mapped' : '')}>
                        <div className="account-header">
                          <div className="account-info">
                            <strong>{acc.name || acc.marketingName || acc.id}</strong>
                            <span>{acc.type} / {acc.subtype}{acc.number ? ' | Conta: ' + acc.number : ''}</span>
                            <span>Saldo: {formatarMoeda(acc.balance)}</span>
                          </div>
                          {already && (
                            <div className="already-mapped-badge">
                              <FaCheck /> {already.subcontaNome}
                            </div>
                          )}
                        </div>
                        <div className="account-map-row">
                          <label>Mapear para:</label>
                          <select
                            value={already ? already.subcontaId : (modalMappings[acc.id] || '')}
                            disabled={!!already}
                            onChange={(e) => handleMappingChange(acc.id, e.target.value)}
                          >
                            {!already && <option value="">--- Nao mapear ---</option>}
                            {!already && subcontas.map((s) => (
                              <option key={s._id} value={s._id}>
                                {s.nome} ({s.instituicao ? s.instituicao.nome : '?'}) - {formatarMoeda(s.saldoAtual)}
                              </option>
                            ))}
                            {!already && subcontas.length > 0 && (
                              <option value="__NEW__">+ Nova subconta...</option>
                            )}
                            {!already && subcontas.length === 0 && (
                              <option disabled>Nenhuma subconta disponivel</option>
                            )}
                          </select>
                        </div>
                        {criandoSubcontaFor[acc.id] && (
                          <div className="inline-subconta-form">
                            <input
                              type="text"
                              value={novoSubcontaNome}
                              onChange={(e) => setNovoSubcontaNome(e.target.value)}
                              placeholder="Nome* (ex: Conta Nubank)"
                            />
                            <select
                              value={novoSubcontaTipo}
                              onChange={(e) => setNovoSubcontaTipo(e.target.value)}
                            >
                              <option value="corrente">Corrente</option>
                              <option value="cartao_credito">Cartao de Credito</option>
                              <option value="rendimento_automatico">Rendimento Automatico</option>
                              <option value="caixinha">Caixinha</option>
                              <option value="investimento_fixo">Investimento Fixo</option>
                            </select>
                            <select
                              value={novoSubcontaInstituicao}
                              onChange={(e) => setNovoSubcontaInstituicao(e.target.value)}
                            >
                              <option value="">Instituicao*</option>
                              {(instituicoes || []).map((i) => (
                                <option key={i._id} value={i._id}>{i.nome}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={novoSubcontaSaldo}
                              onChange={(e) => setNovoSubcontaSaldo(e.target.value)}
                              placeholder="Saldo inicial (opcional)"
                              step="0.01"
                            />
                            <div className="form-actions">
                              <Button variant="primary" size="sm" onClick={() => handleCriarSubconta(acc.id)} disabled={subcriando}>
                                {subcriando ? <><FaSpinner className="spin" /> Criando...</> : 'Criar e mapear'}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleMappingChange(acc.id, '')}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="account-map-count">
                  {Object.values(modalMappings).filter(v => v && v !== '__NEW__').length} conta(s) selecionada(s) para mapear
                </div>
              </>
            )}

            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowMappingModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSalvarTodos} disabled={salvandoMapping || Object.values(modalMappings).filter(v => v && v !== '__NEW__').length === 0}>
                {salvandoMapping ? <><FaSpinner className="spin" /> Salvando...</> : <><FaCheck /> Salvar mapeamentos</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluggyPage;
