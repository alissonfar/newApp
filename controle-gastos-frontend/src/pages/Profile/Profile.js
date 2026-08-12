// src/pages/Profile/Profile.js
import React, { useState, useContext, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FaUser, FaEnvelope, FaPhone, FaBriefcase, FaBuilding, FaCalendar, 
         FaLinkedin, FaTwitter, FaInstagram, FaMoon, FaSun, FaBell, FaDollarSign,
         FaCamera, FaSpinner, FaUserTie } from 'react-icons/fa';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { listarDivisaoPresets, criarDivisaoPreset, atualizarDivisaoPreset, excluirDivisaoPreset } from '../../api';
import PageHeader from '../../components/shared/PageHeader';
import PersonIcon from '@mui/icons-material/Person';
import './Profile.css';

function Profile() {
  const { usuario, setUsuario, atualizarAutenticacao } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('perfil');
  const [formData, setFormData] = useState({
    nome: usuario?.nome || '',
    email: usuario?.email || '',
    telefone: usuario?.telefone || '',
    dataNascimento: usuario?.dataNascimento ? new Date(usuario.dataNascimento).toISOString().split('T')[0] : '',
    genero: usuario?.genero || '',
    biografia: usuario?.biografia || '',
    cargo: usuario?.cargo || '',
    empresa: usuario?.empresa || '',
    redesSociais: {
      linkedin: usuario?.redesSociais?.linkedin || '',
      twitter: usuario?.redesSociais?.twitter || '',
      instagram: usuario?.redesSociais?.instagram || ''
    }
  });

  const [senhas, setSenhas] = useState({
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: ''
  });

  const [preferencias, setPreferencias] = useState({
    tema: usuario?.preferencias?.tema || 'claro',
    notificacoes: {
      email: usuario?.preferencias?.notificacoes?.email ?? true,
      push: usuario?.preferencias?.notificacoes?.push ?? true
    },
    moedaPadrao: usuario?.preferencias?.moedaPadrao || 'BRL',
    proprietario: usuario?.preferencias?.proprietario || ''
  });

  const [divisaoPresets, setDivisaoPresets] = useState([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [editandoPresetId, setEditandoPresetId] = useState(null);
  const [presetForm, setPresetForm] = useState({ nome: '', partes: [{ pessoa: '', percentual: '' }, { pessoa: '', percentual: '' }] });

  const carregarPresets = useCallback(async () => {
    setLoadingPresets(true);
    try {
      const lista = await listarDivisaoPresets();
      setDivisaoPresets(lista);
    } catch (error) {
      toast.error('Erro ao carregar presets de divisão');
    } finally {
      setLoadingPresets(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'divisoes') carregarPresets();
  }, [activeTab, carregarPresets]);

  const resetPresetForm = () => {
    setEditandoPresetId(null);
    setPresetForm({ nome: '', partes: [{ pessoa: '', percentual: '' }, { pessoa: '', percentual: '' }] });
  };

  const iniciarEdicaoPreset = (preset) => {
    setEditandoPresetId(preset._id);
    setPresetForm({
      nome: preset.nome,
      partes: preset.partes.map(p => ({ pessoa: p.pessoa, percentual: String(p.percentual) }))
    });
  };

  const handlePresetParteChange = (index, field, value) => {
    setPresetForm(prev => {
      const partes = [...prev.partes];
      partes[index] = { ...partes[index], [field]: value };
      return { ...prev, partes };
    });
  };

  const addPresetParte = () => {
    setPresetForm(prev => ({ ...prev, partes: [...prev.partes, { pessoa: '', percentual: '' }] }));
  };

  const removePresetParte = (index) => {
    setPresetForm(prev => {
      if (prev.partes.length <= 2) return prev;
      return { ...prev, partes: prev.partes.filter((_, i) => i !== index) };
    });
  };

  const somaPresetForm = presetForm.partes.reduce((acc, p) => acc + (parseFloat(p.percentual) || 0), 0);

  const handlePresetSubmit = async (e) => {
    e.preventDefault();
    if (!presetForm.nome.trim()) {
      toast.error('Informe um nome para o preset.');
      return;
    }
    if (Math.abs(somaPresetForm - 100) > 0.1) {
      toast.error(`A soma dos percentuais precisa ser 100% (está em ${somaPresetForm.toFixed(2)}%).`);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        nome: presetForm.nome.trim(),
        partes: presetForm.partes.map(p => ({ pessoa: p.pessoa.trim(), percentual: parseFloat(p.percentual) }))
      };
      if (editandoPresetId) {
        await atualizarDivisaoPreset(editandoPresetId, payload);
        toast.success('Preset atualizado com sucesso');
      } else {
        await criarDivisaoPreset(payload);
        toast.success('Preset criado com sucesso');
      }
      resetPresetForm();
      carregarPresets();
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar preset');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirPreset = async (preset) => {
    if (!window.confirm(`Excluir o preset "${preset.nome}"?`)) return;
    try {
      await excluirDivisaoPreset(preset._id);
      toast.success('Preset excluído');
      if (editandoPresetId === preset._id) resetPresetForm();
      carregarPresets();
    } catch (error) {
      toast.error(error.message || 'Erro ao excluir preset');
    }
  };

  const carregarPerfil = useCallback(async () => {
    try {
      const response = await api.get('/usuarios/perfil');
      setFormData(prev => ({
        ...prev,
        ...response.data,
        dataNascimento: response.data.dataNascimento ?
          new Date(response.data.dataNascimento).toISOString().split('T')[0] : ''
      }));
      setPreferencias(prev => response.data.preferencias || prev);
      setUsuario(response.data);
    } catch (error) {
      toast.error('Erro ao carregar perfil');
    }
  }, [setUsuario]);

  useEffect(() => {
    carregarPerfil();
  }, [carregarPerfil]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSenhaChange = (e) => {
    const { name, value } = e.target;
    setSenhas(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePreferenciasChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setPreferencias(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setPreferencias(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('foto', file);

    setLoading(true);
    try {
      const response = await api.post('/usuarios/perfil/foto', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setUsuario(prev => ({
        ...prev,
        fotoPerfil: response.data.fotoPerfil
      }));
      toast.success('Foto de perfil atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar foto de perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.put('/usuarios/perfil', formData);
      setUsuario(response.data.usuario);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSenhaSubmit = async (e) => {
    e.preventDefault();

    // Validações da nova senha
    if (!senhas.senhaAtual) {
      toast.error('A senha atual é obrigatória');
      return;
    }

    if (!senhas.novaSenha) {
      toast.error('A nova senha é obrigatória');
      return;
    }

    if (senhas.novaSenha.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (senhas.novaSenha !== senhas.confirmarSenha) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (senhas.senhaAtual === senhas.novaSenha) {
      toast.error('A nova senha deve ser diferente da senha atual');
      return;
    }

    setLoading(true);
    try {
      const response = await api.put('/usuarios/perfil/senha', {
        senhaAtual: senhas.senhaAtual,
        novaSenha: senhas.novaSenha
      });

      // Atualiza o token e usuário no contexto
      if (response.data.token) {
        atualizarAutenticacao(response.data.token, response.data.usuario);
      }

      toast.success('Senha atualizada com sucesso!');
      setSenhas({ senhaAtual: '', novaSenha: '', confirmarSenha: '' });
    } catch (error) {
      toast.error(error.response?.data?.erro || 'Erro ao atualizar senha');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenciasSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.put('/usuarios/perfil/preferencias', { preferencias });
      
      // Atualiza o usuário no contexto com as novas preferências
      const usuarioAtualizado = {
        ...usuario,
        preferencias: response.data.preferencias
      };
      
      // Atualiza o estado local e o contexto global
      setUsuario(usuarioAtualizado);
      
      // Recarrega o perfil para garantir que temos os dados mais recentes
      await carregarPerfil();
      
      toast.success('Preferências atualizadas com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar preferências');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <PageHeader icon={<PersonIcon />} title="Meu Perfil" />
        <div className="profile-tabs">
          <button
            className={`tab-button ${activeTab === 'perfil' ? 'active' : ''}`}
            onClick={() => setActiveTab('perfil')}
          >
            Perfil
          </button>
          <button
            className={`tab-button ${activeTab === 'senha' ? 'active' : ''}`}
            onClick={() => setActiveTab('senha')}
          >
            Alterar Senha
          </button>
          <button
            className={`tab-button ${activeTab === 'preferencias' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferencias')}
          >
            Preferências
          </button>
          <button
            className={`tab-button ${activeTab === 'divisoes' ? 'active' : ''}`}
            onClick={() => setActiveTab('divisoes')}
          >
            Divisões
          </button>
        </div>
      </div>

      <div className="profile-content">
        {activeTab === 'perfil' && (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="foto-perfil-container">
              <div className="foto-perfil">
                {usuario?.fotoPerfil ? (
                  <img src={usuario.fotoPerfil} alt="Foto de perfil" />
                ) : (
                  <FaUser className="foto-placeholder" />
                )}
                <label className="foto-upload-label">
                  <FaCamera />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFotoChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            <div className="form-group">
              <label><FaUser /> Nome</label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label><FaEnvelope /> Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                disabled
              />
            </div>

            <div className="form-group">
              <label><FaPhone /> Telefone</label>
              <input
                type="tel"
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label><FaCalendar /> Data de Nascimento</label>
              <input
                type="date"
                name="dataNascimento"
                value={formData.dataNascimento}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Gênero</label>
              <select name="genero" value={formData.genero} onChange={handleInputChange}>
                <option value="">Selecione...</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
                <option value="prefiro_nao_informar">Prefiro não informar</option>
              </select>
            </div>

            <div className="form-group">
              <label>Biografia</label>
              <textarea
                name="biografia"
                value={formData.biografia}
                onChange={handleInputChange}
                rows="4"
              />
            </div>

            <div className="form-group">
              <label><FaBriefcase /> Cargo</label>
              <input
                type="text"
                name="cargo"
                value={formData.cargo}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label><FaBuilding /> Empresa</label>
              <input
                type="text"
                name="empresa"
                value={formData.empresa}
                onChange={handleInputChange}
              />
            </div>

            <div className="redes-sociais">
              <h3>Redes Sociais</h3>
              <div className="form-group">
                <label><FaLinkedin /> LinkedIn</label>
                <input
                  type="url"
                  name="redesSociais.linkedin"
                  value={formData.redesSociais.linkedin}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label><FaTwitter /> Twitter</label>
                <input
                  type="url"
                  name="redesSociais.twitter"
                  value={formData.redesSociais.twitter}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label><FaInstagram /> Instagram</label>
                <input
                  type="url"
                  name="redesSociais.instagram"
                  value={formData.redesSociais.instagram}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <FaSpinner className="spinner" /> Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </form>
        )}

        {activeTab === 'senha' && (
          <form onSubmit={handleSenhaSubmit} className="senha-form">
            <div className="form-group">
              <label>Senha Atual</label>
              <input
                type="password"
                name="senhaAtual"
                value={senhas.senhaAtual}
                onChange={handleSenhaChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Nova Senha</label>
              <input
                type="password"
                name="novaSenha"
                value={senhas.novaSenha}
                onChange={handleSenhaChange}
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label>Confirmar Nova Senha</label>
              <input
                type="password"
                name="confirmarSenha"
                value={senhas.confirmarSenha}
                onChange={handleSenhaChange}
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <FaSpinner className="spinner" /> Alterando...
                </>
              ) : (
                'Alterar Senha'
              )}
            </button>
          </form>
        )}

        {activeTab === 'preferencias' && (
          <form onSubmit={handlePreferenciasSubmit} className="preferencias-form">
            <div className="form-group">
              <label><FaSun /> / <FaMoon /> Tema</label>
              <select
                name="tema"
                value={preferencias.tema}
                onChange={handlePreferenciasChange}
              >
                <option value="claro">Claro</option>
                <option value="escuro">Escuro</option>
              </select>
            </div>

            <div className="form-group">
              <label><FaUserTie /> Proprietário do Sistema</label>
              <input
                type="text"
                name="proprietario"
                value={preferencias.proprietario}
                onChange={handlePreferenciasChange}
                placeholder="Nome do proprietário"
              />
              <small>Este nome será exibido como proprietário nas informações do sistema</small>
            </div>

            <div className="form-group">
              <label><FaBell /> Notificações</label>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="notificacoes.email"
                    checked={preferencias.notificacoes.email}
                    onChange={handlePreferenciasChange}
                  />
                  Receber notificações por email
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="notificacoes.push"
                    checked={preferencias.notificacoes.push}
                    onChange={handlePreferenciasChange}
                  />
                  Receber notificações push
                </label>
              </div>
            </div>

            <div className="form-group">
              <label><FaDollarSign /> Moeda Padrão</label>
              <select
                name="moedaPadrao"
                value={preferencias.moedaPadrao}
                onChange={handlePreferenciasChange}
              >
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <FaSpinner className="spinner" /> Salvando...
                </>
              ) : (
                'Salvar Preferências'
              )}
            </button>
          </form>
        )}

        {activeTab === 'divisoes' && (
          <div className="divisoes-preset-container">
            <form onSubmit={handlePresetSubmit} className="preset-form">
              <h3>{editandoPresetId ? 'Editar preset' : 'Novo preset de divisão'}</h3>
              <div className="form-group">
                <label>Nome do preset</label>
                <input
                  type="text"
                  value={presetForm.nome}
                  onChange={(e) => setPresetForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Aluguel com Marina"
                  required
                />
              </div>

              {presetForm.partes.map((parte, index) => (
                <div key={index} className="preset-parte-row">
                  <div className="form-group">
                    <label>Pessoa</label>
                    <input
                      type="text"
                      value={parte.pessoa}
                      onChange={(e) => handlePresetParteChange(index, 'pessoa', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Percentual (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={parte.percentual}
                      onChange={(e) => handlePresetParteChange(index, 'percentual', e.target.value)}
                      required
                    />
                  </div>
                  {presetForm.partes.length > 2 && (
                    <button type="button" className="btn-remove-parte" onClick={() => removePresetParte(index)}>
                      Remover
                    </button>
                  )}
                </div>
              ))}

              <div className="preset-form-actions">
                <button type="button" className="btn-add-parte" onClick={addPresetParte}>
                  + Adicionar parte
                </button>
                <span className={`preset-soma ${Math.abs(somaPresetForm - 100) > 0.1 ? 'soma-diff' : 'soma-ok'}`}>
                  Soma: {somaPresetForm.toFixed(2)}%
                </span>
              </div>

              <div className="preset-form-actions">
                <button type="submit" className="btn-submit" disabled={loading}>
                  {editandoPresetId ? 'Salvar alterações' : 'Criar preset'}
                </button>
                {editandoPresetId && (
                  <button type="button" className="btn-cancelar-edicao" onClick={resetPresetForm}>
                    Cancelar edição
                  </button>
                )}
              </div>
            </form>

            <div className="presets-lista">
              <h3>Presets salvos</h3>
              {loadingPresets && <p>Carregando...</p>}
              {!loadingPresets && divisaoPresets.length === 0 && <p>Nenhum preset salvo ainda.</p>}
              {divisaoPresets.map(preset => (
                <div key={preset._id} className="preset-item">
                  <div className="preset-item-info">
                    <strong>{preset.nome}</strong>
                    <span>{preset.partes.map(p => `${p.pessoa} (${p.percentual}%)`).join(' + ')}</span>
                  </div>
                  <div className="preset-item-actions">
                    <button type="button" onClick={() => iniciarEdicaoPreset(preset)}>Editar</button>
                    <button type="button" onClick={() => handleExcluirPreset(preset)}>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
