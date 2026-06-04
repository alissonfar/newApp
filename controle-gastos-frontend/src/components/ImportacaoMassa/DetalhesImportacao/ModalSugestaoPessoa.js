import React, { useState } from 'react';
import { FaUser, FaCalendarAlt, FaMoneyBillWave, FaFileSignature, FaCheck, FaPencilAlt, FaTimes, FaLightbulb } from 'react-icons/fa';
import { toast } from 'react-toastify';
import importacaoService from '../../../services/importacaoService';

const formatarData = (data) => {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatarValor = (valor) => {
  if (valor == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const Campo = ({ icone, label, valor, cor = '#475569' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
    <span style={{ color: '#0ea5e9', fontSize: 14, flexShrink: 0 }}>{icone}</span>
    <span style={{ fontSize: 12, color: '#64748b', width: 80 }}>{label}</span>
    <span style={{ fontSize: 14, color: cor, fontWeight: 500, wordBreak: 'break-word' }}>{valor}</span>
  </div>
);

const EvidenciaLinha = ({ descricao, data, valor, pessoa }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px',
    background: 'white',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    fontSize: 12
  }}>
    <FaUser style={{ color: '#16a34a', flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {descricao}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
        {formatarData(data)} · {formatarValor(valor)} · <strong style={{ color: '#16a34a' }}>{pessoa}</strong>
      </div>
    </div>
  </div>
);

const ModalSugestaoPessoa = ({ transacao, importacaoId, onFechar, onAtualizar }) => {
  const [editando, setEditando] = useState(false);
  const [pessoaEditada, setPessoaEditada] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!transacao || !transacao.pessoaSugerida) return null;

  const pessoaAtual = transacao.pagamentos?.[0]?.pessoa || '—';
  const pessoaSugerida = transacao.pessoaSugerida;
  const count = transacao.pessoaSugeridaCount || 0;
  const sample = transacao.pessoaSugeridaSample || {};
  // Evidência: como só persistimos 1 sample + count + ids, mostramos o sample principal.
  // Se houver mais (não temos descrição adicional), indicamos o total.
  const transacoesExemplo = [sample].filter(Boolean);

  const handleAceitar = async () => {
    if (salvando) return;
    await persistirPessoa(pessoaSugerida);
  };

  const handleSalvarEdicao = async () => {
    if (!pessoaEditada.trim()) {
      toast.warn('Informe o nome da pessoa.');
      return;
    }
    if (salvando) return;
    await persistirPessoa(pessoaEditada.trim());
  };

  const persistirPessoa = async (novaPessoa) => {
    try {
      setSalvando(true);
      const pagamentos = (transacao.pagamentos && transacao.pagamentos.length > 0)
        ? transacao.pagamentos.map(p => ({ ...p, pessoa: novaPessoa }))
        : [{ pessoa: novaPessoa, valor: transacao.valor, tags: {} }];
      await importacaoService.atualizarTransacao(importacaoId, transacao.id, { pagamentos });
      toast.success(`Pessoa definida como "${novaPessoa}".`);
      if (onAtualizar) onAtualizar();
      onFechar();
    } catch (err) {
      console.error('Erro ao atualizar pessoa:', err);
      toast.error(err.message || 'Erro ao atualizar pessoa.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      onClick={onFechar}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 12, padding: 24, maxWidth: 760,
          width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{
            background: '#dcfce7', color: '#166534', padding: 8, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FaLightbulb size={18} />
          </span>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a', flex: 1 }}>
            Sugestão de pessoa responsável
          </h2>
          <button
            type="button"
            onClick={onFechar}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 24, color: '#64748b', lineHeight: 1
            }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <p style={{ color: '#64748b', fontSize: 14, marginTop: 0, marginBottom: 16 }}>
          Encontramos <strong>{count}</strong> transação(ões) anterior(es) com a mesma descrição
          atribuídas a <strong style={{ color: '#0f172a' }}>{pessoaSugerida}</strong>.
          Deseja aplicar essa sugestão a esta nova transação?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Card: Como está agora */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0',
            borderRadius: 8, padding: 16
          }}>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
              Como está agora
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              {transacao.descricao}
            </div>
            <Campo icone={<FaUser />} label="Pessoa" valor={pessoaAtual} />
            <Campo icone={<FaCalendarAlt />} label="Data" valor={formatarData(transacao.data)} />
            <Campo icone={<FaMoneyBillWave />} label="Valor" valor={formatarValor(transacao.valor)} />
            <Campo icone={<FaFileSignature />} label="Tipo" valor={transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'} />
          </div>

          {/* Card: Sugestão */}
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 8, padding: 16
          }}>
            <div style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
              Sugestão
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#166534', marginBottom: 12 }}>
              {pessoaSugerida}
            </div>
            <Campo icone={<FaUser />} label="Pessoa" valor={pessoaSugerida} cor="#166534" />
            <Campo icone={<FaCalendarAlt />} label="Data" valor={formatarData(transacao.data)} />
            <Campo icone={<FaMoneyBillWave />} label="Valor" valor={formatarValor(transacao.valor)} />
            <Campo icone={<FaFileSignature />} label="Tipo" valor={transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'} />
          </div>
        </div>

        {/* Evidência */}
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 8, padding: 12, marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <FaLightbulb style={{ color: '#16a34a' }} />
            <strong style={{ fontSize: 13, color: '#166534' }}>Evidência ({count} ocorrência{count !== 1 ? 's' : ''})</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transacoesExemplo.length > 0 ? (
              transacoesExemplo.map((t, idx) => (
                <EvidenciaLinha
                  key={idx}
                  descricao={t.descricao}
                  data={t.data}
                  valor={t.valor}
                  pessoa={t.pessoa}
                />
              ))
            ) : (
              <div style={{ fontSize: 12, color: '#64748b' }}>Sem amostra disponível.</div>
            )}
            {count > transacoesExemplo.length && (
              <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                + {count - transacoesExemplo.length} transação(ões) adicional(is) com a mesma descrição
              </div>
            )}
          </div>
        </div>

        {editando ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f1f5f9', border: '1px solid #cbd5e1',
            borderRadius: 8, padding: 12, marginBottom: 16
          }}>
            <FaUser style={{ color: '#0ea5e9' }} />
            <input
              type="text"
              autoFocus
              value={pessoaEditada}
              onChange={(e) => setPessoaEditada(e.target.value)}
              placeholder="Nome da pessoa"
              style={{
                flex: 1, padding: '8px 10px', fontSize: 14,
                border: '1px solid #cbd5e1', borderRadius: 6,
                background: 'white'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSalvarEdicao();
                if (e.key === 'Escape') setEditando(false);
              }}
            />
            <button
              type="button"
              onClick={handleSalvarEdicao}
              disabled={salvando}
              style={{
                padding: '8px 14px', border: 'none', borderRadius: 6,
                background: '#16a34a', color: 'white',
                cursor: salvando ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}
            >
              <FaCheck /> {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              style={{
                padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6,
                background: 'white', color: '#475569',
                cursor: 'pointer', fontSize: 13
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onFechar}
              style={{
                padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: 6,
                background: 'white', color: '#475569',
                cursor: 'pointer', fontSize: 14,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}
            >
              <FaTimes /> Manter como está
            </button>
            <button
              type="button"
              onClick={() => { setEditando(true); setPessoaEditada(pessoaSugerida); }}
              style={{
                padding: '10px 16px', border: '1px solid #0ea5e9', borderRadius: 6,
                background: 'white', color: '#0c4a6e',
                cursor: 'pointer', fontSize: 14,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}
            >
              <FaPencilAlt /> Editar pessoa
            </button>
            <button
              type="button"
              onClick={handleAceitar}
              disabled={salvando}
              style={{
                padding: '10px 16px', border: 'none', borderRadius: 6,
                background: '#16a34a', color: 'white',
                cursor: salvando ? 'wait' : 'pointer',
                fontSize: 14, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}
            >
              <FaCheck /> {salvando ? 'Aplicando...' : 'Aceitar sugestão'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalSugestaoPessoa;
