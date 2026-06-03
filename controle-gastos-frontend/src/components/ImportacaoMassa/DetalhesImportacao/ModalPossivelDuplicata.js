import React from 'react';
import { FaExclamationTriangle, FaCalendarAlt, FaMoneyBillWave, FaTag, FaFileSignature } from 'react-icons/fa';

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

const LinhaComparacao = ({ icone, label, valorImportada, valorExistente, distancia }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
    <span style={{ color: '#0ea5e9', fontSize: 14 }}>{icone}</span>
    <span style={{ fontSize: 12, color: '#64748b', width: 80 }}>{label}</span>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{valorImportada}</span>
    <span style={{ color: '#94a3b8', fontSize: 14 }}>↔</span>
    <span style={{ fontSize: 14, color: '#475569' }}>{valorExistente}</span>
    {distancia != null && (
      <span style={{
        marginLeft: 'auto',
        fontSize: 11, padding: '2px 8px', borderRadius: 999,
        background: '#fef3c7', color: '#92400e', fontWeight: 600
      }}>
        Δ {distancia}
      </span>
    )}
  </div>
);

const ModalPossivelDuplicata = ({ transacao, onFechar }) => {
  if (!transacao) return null;
  const sem = transacao.transacaoSemelhante || {};
  const distanciaDias = transacao.transacaoSemelhanteDistanciaDias;
  const diasLabel = distanciaDias === 1 ? '1 dia' : `${distanciaDias} dias`;

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
          background: 'white', borderRadius: 12, padding: 24, maxWidth: 720,
          width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{
            background: '#fef3c7', color: '#92400e', padding: 8, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FaExclamationTriangle size={18} />
          </span>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a', flex: 1 }}>
            Possível duplicata detectada
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
          Esta transação pode já existir no sistema. Encontramos uma transação ativa com a
          mesma descrição e valor, mas com data diferente ({diasLabel} de distância).
          Revise as duas e escolha uma ação no rodapé.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
          {/* Card: Transação Importada */}
          <div style={{
            background: '#f0f9ff', border: '1px solid #bae6fd',
            borderRadius: 8, padding: 16
          }}>
            <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
              Importada agora
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              {transacao.descricao}
            </div>
            <LinhaComparacao
              icone={<FaCalendarAlt />}
              label="Data"
              valorImportada={formatarData(transacao.data)}
              valorExistente=""
            />
            <LinhaComparacao
              icone={<FaMoneyBillWave />}
              label="Valor"
              valorImportada={formatarValor(transacao.valor)}
              valorExistente=""
            />
            <LinhaComparacao
              icone={<FaTag />}
              label="Tipo"
              valorImportada={transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'}
              valorExistente=""
            />
            {transacao.categoria && (
              <LinhaComparacao
                icone={<FaFileSignature />}
                label="Categoria"
                valorImportada={transacao.categoria?.nome || '—'}
                valorExistente=""
              />
            )}
          </div>

          {/* Card: Transação Existente */}
          <div style={{
            background: '#fef3c7', border: '1px solid #fde68a',
            borderRadius: 8, padding: 16
          }}>
            <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
              Já existente no sistema
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 12 }}>
              {sem.descricao || transacao.transacaoSemelhanteDescricao || '—'}
            </div>
            <LinhaComparacao
              icone={<FaCalendarAlt />}
              label="Data"
              valorImportada=""
              valorExistente={formatarData(sem.data || transacao.transacaoSemelhanteData)}
            />
            <LinhaComparacao
              icone={<FaMoneyBillWave />}
              label="Valor"
              valorImportada=""
              valorExistente={formatarValor(sem.valor ?? transacao.transacaoSemelhanteValor)}
            />
            <LinhaComparacao
              icone={<FaTag />}
              label="Tipo"
              valorImportada=""
              valorExistente={sem.tipo === 'gasto' ? 'Gasto' : (sem.tipo === 'recebivel' ? 'Recebível' : '—')}
            />
            {sem.categoria && (
              <LinhaComparacao
                icone={<FaFileSignature />}
                label="Categoria"
                valorImportada=""
                valorExistente={sem.categoria?.nome || '—'}
              />
            )}
          </div>
        </div>

        <div style={{
          background: '#fef3c7', border: '1px solid #fde68a',
          borderRadius: 8, padding: 12, marginTop: 8, marginBottom: 16,
          fontSize: 13, color: '#78350f'
        }}>
          <strong>💡 Como resolver:</strong> Use os botões "Validar" ou "Ignorar" na linha
          desta transação (fora deste modal) para decidir. Se for uma duplicata real, ignore-a.
          Se for um lançamento legítimo em outra data, valide-a normalmente.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onFechar}
            style={{
              padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: 6,
              background: 'white', color: '#0f172a', cursor: 'pointer', fontSize: 14
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalPossivelDuplicata;
