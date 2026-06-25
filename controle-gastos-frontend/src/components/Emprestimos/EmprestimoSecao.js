// src/components/Emprestimos/EmprestimoSecao.js
// Seção legado de Empréstimo (1 pagamento, aba Avançado).
// Refatorada para delegar a suíte interna de campos ao componente
// compartilhado `EmprestimoFormFields`, que também é usado pela
// coluna "Empréstimo" do TabPagamentos (caminho novo, 2+ pagamentos).
import React from 'react';
import EmprestimoFormFields from './EmprestimoFormFields';
import './EmprestimoSecao.css';

const EmprestimoSecao = ({ form, valorTotal, tipoTransacao, qtdPagamentos = 1 }) => {
  const { state, setters, adicionarPessoa, avisoEmprestimoSemDesembolso } = form;

  // Caminho novo: 2+ pagamentos → vínculo é por pagamento na aba Pagamentos.
  // Esconde a seção legado e mostra um hint explicando.
  const esconderSecaoLegado = qtdPagamentos > 1;

  return (
    <div className="form-section emprestimo-secao">
      {esconderSecaoLegado ? (
        <p className="emp-secao-hint">
          Esta transação tem múltiplos pagamentos. Para marcar parte deles como empréstimo, vá na aba "Pagamentos" e marque individualmente.
        </p>
      ) : (
        <label className="emp-secao-toggle">
          <input
            type="checkbox"
            checked={state.ativo}
            onChange={(e) => setters.setAtivo(e.target.checked)}
            tabIndex={89}
          />
          {' '}Esta transação faz parte de um empréstimo
        </label>
      )}

      {state.ativo && (
        <div className="emp-secao-campos">
          <p className="emp-secao-hint">
            {tipoTransacao === 'gasto'
              ? 'Você está emprestando — este gasto não conta como despesa real nos relatórios.'
              : 'Você está recebendo — o valor recebido entra como receita do empréstimo (juros auto).'}
          </p>

          {avisoEmprestimoSemDesembolso && (
            <div className="emp-aviso-soft" role="alert">
              ⚠️ {avisoEmprestimoSemDesembolso}
            </div>
          )}

          <EmprestimoFormFields
            state={state}
            setters={setters}
            adicionarPessoa={adicionarPessoa}
            valorTotal={valorTotal}
            tipoTransacao={tipoTransacao}
            tabIndexBase={90}
            emprestimoIdName="empModo"
          />
        </div>
      )}
    </div>
  );
};

export default EmprestimoSecao;
