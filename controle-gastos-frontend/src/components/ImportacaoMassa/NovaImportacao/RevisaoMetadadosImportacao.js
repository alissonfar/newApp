import React from 'react';

const formatarMoeda = (v) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(v || 0);

const formatarData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const Badge = ({ label, cor = '#3b82f6' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 999,
    background: cor + '22', color: cor,
    fontSize: 13, fontWeight: 500, border: `1px solid ${cor}44`
  }}>
    {label}
  </span>
);

const InfoItem = ({ label, value, editavel = false, onChange, type = 'text' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</label>
    {editavel ? (
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6,
          fontSize: 14
        }}
      />
    ) : (
      <span style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{value || '—'}</span>
    )}
  </div>
);

const RevisaoMetadadosImportacao = (props) => {
  const {
    preview,
    descricao,
    onDescricaoChange,
    tipoImportacaoComplementar,
    onTipoImportacaoChange,
    onConfirmar,
    onCancelar,
    loading
  } = props || {};

  if (!preview) return null;

  const meta = (preview && preview.metadadosSugeridos) || {};
  const parserInfo = (preview && preview.parser) || {};
  const complementar = (preview && preview.sugestaoComplementar) || null;
  const amostra = (preview && Array.isArray(preview.amostraTransacoes)) ? preview.amostraTransacoes : [];

  const dataInicialFmt = formatarData(meta.dataInicial);
  const dataFinalFmt = formatarData(meta.dataFinal);

  return (
    <div className="revisao-metadados">
      <div style={{
        background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 8,
        padding: 16, marginBottom: 16
      }}>
        <h3 style={{ margin: 0, marginBottom: 8, color: '#065f46' }}>
          Metadados inferidos
        </h3>
        <p style={{ margin: 0, color: '#047857', fontSize: 13 }}>
          Detectamos automaticamente as informações abaixo. Você pode editar antes de criar a importação.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Badge label={`Origem: ${parserInfo.nome || parserInfo.id || '—'}`} cor="#0ea5e9" />
          {dataInicialFmt !== '—' && dataFinalFmt !== '—' && (
            <Badge label={`Período: ${dataInicialFmt} a ${dataFinalFmt}`} cor="#8b5cf6" />
          )}
          {meta.periodoCompetencia && (
            <Badge label={`Competência: ${meta.periodoCompetencia}`} cor="#a855f7" />
          )}
          {meta.totalRegistros > 0 && (
            <Badge label={`${meta.totalRegistros} transações`} cor="#0ea5e9" />
          )}
          {meta.totalCreditos > 0 && (
            <Badge label={`Créditos: ${formatarMoeda(meta.totalCreditos)}`} cor="#16a34a" />
          )}
          {meta.totalDebitos > 0 && (
            <Badge label={`Débitos: ${formatarMoeda(meta.totalDebitos)}`} cor="#dc2626" />
          )}
        </div>
      </div>

      {complementar && complementar.sugestao && (
        <div style={{
          background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
          padding: 12, marginBottom: 16, fontSize: 14, color: '#92400e'
        }}>
          <strong>⚠️ Possível importação complementar</strong>
          <p style={{ margin: '4px 0 0 0' }}>{complementar.motivo}</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <InfoItem
          label="Descrição"
          value={descricao}
          editavel
          onChange={onDescricaoChange}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!tipoImportacaoComplementar}
            onChange={(e) => onTipoImportacaoChange && onTipoImportacaoChange(e.target.checked)}
          />
          <span style={{ fontSize: 14 }}>Marcar como importação complementar (evitar duplicatas)</span>
        </label>
        {complementar && complementar.sugestao && !tipoImportacaoComplementar && (
          <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>
            Recomendamos marcar esta importação como complementar.
          </p>
        )}
      </div>

      {amostra.length > 0 && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            Amostra ({amostra.length} primeiras transações)
          </summary>
          <div style={{ marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f1f5f9' }}>
                <tr>
                  <th style={{ padding: 8, textAlign: 'left' }}>Data</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Descrição</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>Valor</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {amostra.map((t, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 8 }}>{formatarData(t && t.data)}</td>
                    <td style={{ padding: 8 }}>{t && t.descricao}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{formatarMoeda(t && t.valor)}</td>
                    <td style={{ padding: 8 }}>{t && t.tipo === 'gasto' ? 'Gasto' : 'Recebível'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancelar}
          disabled={!!loading}
          style={{
            padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: 6,
            background: 'white', color: '#0f172a', cursor: 'pointer', fontSize: 14
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={!!loading || !descricao || !descricao.trim()}
          style={{
            padding: '10px 20px', border: 'none', borderRadius: 6,
            background: '#0ea5e9', color: 'white', cursor: 'pointer', fontSize: 14,
            fontWeight: 500, opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Criando...' : 'Criar Importação'}
        </button>
      </div>
    </div>
  );
};

export default RevisaoMetadadosImportacao;
