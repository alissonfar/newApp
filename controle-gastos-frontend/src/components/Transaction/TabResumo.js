import React from 'react';
import { formatDateBR } from '../../utils/dateUtils';

export const TAB_RESUMO = 'resumo';

const Badge = ({ ok, warn, error, label, children }) => {
  const color = error ? '#d32f2f' : warn ? '#ff9800' : '#2ecc71';
  const bg = error ? '#d32f2f12' : warn ? '#ff980012' : '#2ecc7112';
  return (
    <span className="resumo-badge" style={{ color, backgroundColor: bg, borderColor: color + '30' }}>
      {children || label}
    </span>
  );
};

const TabResumo = ({ formState, pagamentos, parcelamento, contaConjunta, allTags, categorias, duplicate }) => {
  const somaPagamentos = pagamentos.pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor || 0) || 0), 0);
  const valorTotal = parseFloat(formState.valorTotal || 0);
  const sumDiff = Math.abs(valorTotal - somaPagamentos);
  const isSumOk = sumDiff < 0.01;

  const pessoasVazias = pagamentos.pagamentos.filter(p => !p.pessoa.trim());
  const valoresZerados = pagamentos.pagamentos.filter(p => parseFloat(p.valor || 0) === 0);
  const pessoas = pagamentos.pagamentos.map(p => p.pessoa.trim()).filter(Boolean);
  const hasDuplicatePeople = new Set(pessoas).size !== pessoas.length;

  const allAppliedTags = [];
  pagamentos.pagamentos.forEach((p, pi) => {
    if (p.paymentTags) {
      Object.entries(p.paymentTags).forEach(([catId, tagIds]) => {
        if (!Array.isArray(tagIds) || tagIds.length === 0) return;
        const cat = categorias.find(c => c._id === catId);
        tagIds.forEach(tid => {
          const tag = allTags.find(t => t._id === tid);
          if (tag) allAppliedTags.push({ catNome: cat?.nome || catId, tagNome: tag.nome, catCor: cat?.cor, tagCor: tag.cor });
        });
      });
    }
  });

  const hasAnyTag = allAppliedTags.length > 0;
  const anyTagMissing = pagamentos.pagamentos.length > 0 && pagamentos.pagamentos.every(p => !p.paymentTags || Object.keys(p.paymentTags).every(k => !(p.paymentTags[k] || []).length));

  const issues = [];
  if (!isSumOk) issues.push({ type: 'error', msg: `Diferenca de R$ ${sumDiff.toFixed(2)} entre valor total e soma dos pagamentos` });
  if (pessoasVazias.length > 0) issues.push({ type: 'error', msg: `${pessoasVazias.length} pagamento(s) sem pessoa` });
  if (valoresZerados.length > 0) issues.push({ type: 'error', msg: `${valoresZerados.length} pagamento(s) com valor zerado` });
  if (contaConjunta.state.isContaConjunta && !contaConjunta.state.vinculoId) issues.push({ type: 'error', msg: 'Conta conjunta sem vinculo selecionado' });
  if (hasDuplicatePeople) issues.push({ type: 'warn', msg: 'Pessoas duplicadas nos pagamentos' });
  if (anyTagMissing && !contaConjunta.state.isContaConjunta) issues.push({ type: 'warn', msg: 'Nenhuma tag aplicada nos pagamentos' });

  return (
    <div data-tab="resumo" className="tab-panel tab-resumo">
      <div className="resumo-sections">

        <div className="resumo-block">
          <h4 className="resumo-block-title">Dados Basicos</h4>
          <div className="resumo-grid">
            <div className="resumo-field"><span className="resumo-label">Tipo</span><span className="resumo-value">{formState.tipo === 'gasto' ? 'Gasto' : 'Recebivel'}</span></div>
            <div className="resumo-field"><span className="resumo-label">Descricao</span><span className="resumo-value">{formState.descricao || '—'}</span></div>
            <div className="resumo-field"><span className="resumo-label">Data</span><span className="resumo-value">{formState.data ? formatDateBR(formState.data) : '—'}</span></div>
            <div className="resumo-field"><span className="resumo-label">Valor Total</span><span className="resumo-value resumo-valor">R$ {valorTotal.toFixed(2).replace('.', ',')}</span></div>
            {formState.observacao && <div className="resumo-field resumo-field-full"><span className="resumo-label">Observacao</span><span className="resumo-value">{formState.observacao}</span></div>}
          </div>
        </div>

        <div className="resumo-block">
          <h4 className="resumo-block-title">Financeiro <Badge ok={isSumOk} error={!isSumOk} label={isSumOk ? 'OK' : 'Divergente'} /></h4>
          <div className="resumo-grid">
            <div className="resumo-field"><span className="resumo-label">Valor total</span><span className="resumo-value resumo-valor">R$ {valorTotal.toFixed(2).replace('.', ',')}</span></div>
            <div className="resumo-field"><span className="resumo-label">Soma pagamentos</span><span className="resumo-value resumo-valor" style={!isSumOk ? { color: '#ff9800' } : {}}>R$ {somaPagamentos.toFixed(2).replace('.', ',')}</span></div>
            <div className="resumo-field"><span className="resumo-label">Qtd. pagamentos</span><span className="resumo-value">{pagamentos.pagamentos.length}</span></div>
            <div className="resumo-field"><span className="resumo-label">Pessoas distintas</span><span className="resumo-value">{new Set(pessoas).size}</span></div>
          </div>
          {parcelamento.state.isParcelado && (
            <div className="resumo-row">
              <Badge label={`${parcelamento.state.totalParcelas} parcelas a cada ${parcelamento.state.intervaloDias} dias`} />
            </div>
          )}
          {contaConjunta.state.isContaConjunta && contaConjunta.state.vinculoId && (
            <div className="resumo-row">
              <Badge label={contaConjunta.state.pagoPor === 'usuario' ? 'Eu paguei' : 'Outro pagou'} />
              <span style={{ fontSize: '0.75rem', color: 'var(--cor-texto)', opacity: 0.7 }}>
                Minha parte: R$ {parseFloat(contaConjunta.state.parteUsuario || 0).toFixed(2).replace('.', ',')}
                {' | '}Outro: R$ {contaConjunta.parteOutro.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}
          {formState.subconta && (
            <div className="resumo-row">
              <Badge label="Vinculado a subconta" />
            </div>
          )}
        </div>

        <div className="resumo-block">
          <h4 className="resumo-block-title">Pagamentos</h4>
          {pagamentos.pagamentos.map((p, i) => {
            const tagCount = p.paymentTags ? Object.values(p.paymentTags).reduce((sum, ids) => sum + (Array.isArray(ids) ? ids.length : 0), 0) : 0;
            return (
              <div key={i} className="resumo-pagamento-row">
                <span className="resumo-pag-pessoa">{p.pessoa || '(vazio)'}</span>
                <span className="resumo-pag-valor">R$ {parseFloat(p.valor || 0).toFixed(2).replace('.', ',')}</span>
                <span className="resumo-pag-tags" style={{ opacity: tagCount > 0 ? 1 : 0.4 }}>{tagCount} tag{tagCount !== 1 ? 's' : ''}</span>
                {!p.pessoa.trim() && <Badge error label="Sem pessoa" />}
                {parseFloat(p.valor || 0) === 0 && <Badge error label="R$ 0" />}
              </div>
            );
          })}
          {hasDuplicatePeople && <div className="resumo-row"><Badge warn label="Pessoas duplicadas" /></div>}
        </div>

        {hasAnyTag && (
          <div className="resumo-block">
            <h4 className="resumo-block-title">Tags</h4>
            <div className="resumo-tags-list">
              {allAppliedTags.map((t, i) => (
                <span key={i} className="resumo-tag-chip" style={{ backgroundColor: (t.tagCor || '#666') + '18', color: t.tagCor || '#666', borderColor: (t.tagCor || '#666') + '30' }}>
                  {t.catNome}: {t.tagNome}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="resumo-block">
          <h4 className="resumo-block-title">Consistencia</h4>
          {issues.length === 0 && !duplicate.isDuplicate ? (
            <div className="resumo-row">
              <Badge ok label="Nenhum problema detectado" />
            </div>
          ) : (
            <div className="resumo-issues">
              {issues.map((issue, i) => (
                <div key={i} className={`resumo-issue resumo-issue-${issue.type}`}>
                  <span className="resumo-issue-dot" />
                  <span>{issue.msg}</span>
                </div>
              ))}
            </div>
          )}
          {duplicate.isChecking && (
            <div className="resumo-row" style={{ marginTop: 6 }}>
              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Verificando transacoes similares...</span>
            </div>
          )}
          {duplicate.isDuplicate && (
            <div className="resumo-issue resumo-issue-warn" style={{ marginTop: 6 }}>
              <span className="resumo-issue-dot" />
              <span>Possivel duplicidade: ja existe{duplicate.isDuplicate.count > 1 ? 'm' : ''} {duplicate.isDuplicate.count} transac{duplicate.isDuplicate.count > 1 ? 'oes' : 'ao'} nesta data com descricao similar</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TabResumo;
