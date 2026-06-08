import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSync, FaCog, FaSpinner, FaCheck, FaPlus, FaTrash, FaPlug, FaLink, FaTimes } from 'react-icons/fa';
import { PluggyConnect } from 'react-pluggy-connect';
import pluggyApi from '../../services/pluggyApi';
import patrimonioApi from '../../services/patrimonioApi';
import { toast } from 'react-toastify';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import './PluggyPage.css';
import { formatDateBR } from '../../utils/dateUtils';

const PluggyPage = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [importacoes, setImportacoes] = useState([]);
  const [subcontas, setSubcontas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  const [showConfigForm, setShowConfigForm] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [ambiente, setAmbiente] = useState('sandbox');
  const [testando, setTestando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingItemId, setMappingItemId] = useState('');
  const [mappingConnectorName, setMappingConnectorName] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [carregandoAccounts, setCarregandoAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedSubconta, setSelectedSubconta] = useState('');
  const [salvandoMapping, setSalvandoMapping] = useState(false);

  const [novoItemId, setNovoItemId] = useState('');
  const [carregandoItemAccounts, setCarregandoItemAccounts] = useState(false);

  const [showWidget, setShowWidget] = useState(false);
  const [connectToken, setConnectToken] = useState(null);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetConnectorName, setWidgetConnectorName] = useState('');

  const carregar = async () => {
    try {
      setCarregando(true);
      const [cfg, itms, imps, subs, status] = await Promise.all([
        pluggyApi.obterConfig(),
        pluggyApi.listarItems(),
        pluggyApi.listarImportacoes(),
        patrimonioApi.listarSubcontas(),
        pluggyApi.obterStatusSync()
      ]);
      setConfig(cfg);
      setItems(itms.items || []);
      setImportacoes(imps);
      setSubcontas(subs);
      setSyncStatus(status);
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
      const accountsData = await pluggyApi.obterAccountsDoItem(item.id);
      const accs = accountsData && accountsData.accounts ? accountsData.accounts : [];
      setAccounts(accs);
      setMappingItemId(item.id);
      setMappingConnectorName(item.connector && item.connector.name ? item.connector.name : '');
      setShowMappingModal(true);
      toast.success('Banco conectado com sucesso! Selecione uma conta para mapear.');
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

  const handleCarregarAccounts = async (itemId) => {
    if (!itemId) {
      toast.warn('Informe o Item ID');
      return;
    }
    try {
      setCarregandoItemAccounts(true);
      const data = await pluggyApi.listarAccountsDoItem(itemId, true);
      setAccounts(data.accounts || []);
      setMappingItemId(itemId);
      setShowMappingModal(true);
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao carregar accounts');
    } finally {
      setCarregandoItemAccounts(false);
    }
  };

  const handleSelecionarAccount = (account) => {
    setSelectedAccount(account);
  };

  const handleSalvarMapping = async () => {
    if (!selectedAccount || !selectedSubconta) {
      toast.warn('Selecione uma account e uma subconta');
      return;
    }
    try {
      setSalvandoMapping(true);
      await pluggyApi.adicionarItem({
        itemId: mappingItemId,
        connectorName: mappingConnectorName,
        accountId: selectedAccount.id,
        accountType: selectedAccount.type,
        accountSubtype: selectedAccount.subtype,
        accountName: selectedAccount.name || selectedAccount.marketingName,
        accountNumber: selectedAccount.number,
        subcontaId: selectedSubconta
      });
      toast.success('Mapeamento salvo com sucesso');
      setShowMappingModal(false);
      setSelectedAccount(null);
      setSelectedSubconta('');
      setAccounts([]);
      setMappingItemId('');
      setMappingConnectorName('');
      setNovoItemId('');
      await carregar();
    } catch (err) {
      toast.error((err.response && err.response.data && err.response.data.erro) || 'Erro ao salvar mapeamento');
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
              <span>Client ID: <strong>{config.clientId}</strong></span>
              <span>Ambiente: <strong>{config.ambiente}</strong></span>
              {config.ultimaSync && config.ultimaSync.data && (
                <span>Ultimo sync: <strong>{formatarDataHora(config.ultimaSync.data)}</strong> ({config.ultimaSync.totalTransacoes} transacoes)</span>
              )}
              {config.ultimoTesteConexao && config.ultimoTesteConexao.data && (
                <span>Ultimo teste: <strong>{formatarDataHora(config.ultimoTesteConexao.data)}</strong> - {config.ultimoTesteConexao.sucesso ? 'Sucesso' : 'Falha'}</span>
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
        <p className="subtitulo" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Conecte seu banco diretamente pelo widget da Pluggy. O Item ID sera salvo automaticamente.
        </p>
      </Card>

      <Card className="pluggy-section">
        <div className="section-header">
          <h2>Mapeamentos (Item/Account - Subconta)</h2>
          <div className="header-actions">
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
                onClick={() => handleCarregarAccounts(novoItemId)}
                disabled={carregandoItemAccounts || !novoItemId}
              >
                {carregandoItemAccounts ? <FaSpinner className="spin" /> : <FaPlus />} Carregar accounts
              </Button>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="vazio">Nenhum mapeamento cadastrado. Use "Conectar banco" ou adicione um Item ID acima.</p>
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

        {importacoes.length === 0 ? (
          <p className="vazio">Nenhuma sincronizacao realizada ainda.</p>
        ) : (
          <ul className="lista-importacoes">
            {importacoes.map((imp) => (
              <li key={imp._id}>
                <div className="item-info">
                  <FaSync />
                  <div>
                    <strong>Sync {formatarData(imp.createdAt)}</strong>
                    <span>{imp.totalTransacoes} transacoes {imp.totalCreditos > 0 ? '- Creditos: ' + formatarMoeda(imp.totalCreditos) : ''} {imp.totalDebitos > 0 ? '- Debitos: ' + formatarMoeda(imp.totalDebitos) : ''}</span>
                  </div>
                </div>
                <div className="item-stats">
                  <span className={'status status-' + imp.status}>{statusLabel(imp.status)}</span>
                  {imp.totalJaImportadas > 0 && <span>{imp.totalJaImportadas} duplicadas</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
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
            <h3>Selecionar Account para mapear</h3>
            {accounts.length === 0 ? (
              <p>Nenhuma account encontrada neste item.</p>
            ) : (
              <div className="accounts-list">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={'account-item ' + (selectedAccount && selectedAccount.id === acc.id ? 'selected' : '')}
                    onClick={() => handleSelecionarAccount(acc)}
                  >
                    <div className="account-info">
                      <strong>{acc.name || acc.marketingName || acc.id}</strong>
                      <span>{acc.type} / {acc.subtype}</span>
                      {acc.number && <span>Numero: {acc.number}</span>}
                      <span>Saldo: {formatarMoeda(acc.balance)}</span>
                    </div>
                    {selectedAccount && selectedAccount.id === acc.id && <FaCheck className="check-icon" />}
                  </div>
                ))}
              </div>
            )}

            {selectedAccount && (
              <div className="mapping-subconta">
                <label>Mapear para subconta:</label>
                <div className="subconta-selector">
                  {subcontas.length === 0 ? (
                    <p className="vazio">Nenhuma subconta disponivel. Crie uma subconta primeiro.</p>
                  ) : (
                    subcontas.map((s) => (
                      <div
                        key={s._id}
                        className={'subconta-option ' + (selectedSubconta === s._id ? 'selected' : '')}
                        onClick={() => setSelectedSubconta(s._id)}
                      >
                        <div className="subconta-option-main">
                          <strong>{s.nome}</strong>
                          <span className="subconta-option-inst">{s.instituicao ? s.instituicao.nome : 'Sem instituicao'}</span>
                        </div>
                        <div className="subconta-option-meta">
                          <span className={'subconta-tipo subconta-tipo-' + s.tipo}>{s.tipo === 'corrente' ? 'Corrente' : s.tipo === 'rendimento_automatico' ? 'Rendimento' : s.tipo === 'caixinha' ? 'Caixinha' : s.tipo === 'cartao_credito' ? 'Cartão de Crédito' : s.tipo}</span>
                          <span className="subconta-saldo">Saldo: {formatarMoeda(s.saldoAtual)}</span>
                        </div>
                        {selectedSubconta === s._id && <FaCheck className="check-icon" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowMappingModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleSalvarMapping} disabled={salvandoMapping || !selectedAccount || !selectedSubconta}>
                {salvandoMapping ? <><FaSpinner className="spin" /> Salvando...</> : <><FaCheck /> Salvar mapeamento</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluggyPage;
