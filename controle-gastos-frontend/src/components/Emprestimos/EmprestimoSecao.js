// src/components/Emprestimos/EmprestimoSecao.js
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { criarPessoa } from '../../api';
import { formatarMoedaBRL, labelTipoRetorno } from '../../utils/emprestimoFormat';
import './EmprestimoSecao.css';
import { formatDateBR } from '../../utils/dateUtils';

const EmprestimoSecao = ({ form, valorTotal }) => {
  const { state, setters, adicionarPessoa, avisoEmprestimoSemDesembolso } = form;
  const [showNovaPessoa, setShowNovaPessoa] = useState(false);
  const [novaPessoaNome, setNovaPessoaNome] = useState('');
  const [novaPessoaContato, setNovaPessoaContato] = useState('');
  const [salvandoPessoa, setSalvandoPessoa] = useState(false);

  const handleCriarPessoa = async (e) => {
    e?.preventDefault?.();
    if (!novaPessoaNome.trim()) {
      toast.error('Informe o nome da pessoa.');
      return;
    }
    setSalvandoPessoa(true);
    try {
      const pessoa = await criarPessoa({
        nome: novaPessoaNome.trim(),
        contato: novaPessoaContato.trim() || undefined
      });
      adicionarPessoa(pessoa);
      setNovaPessoaNome('');
      setNovaPessoaContato('');
      setShowNovaPessoa(false);
      toast.success('Pessoa criada.');
    } catch (err) {
      toast.error(err.message || 'Erro ao criar pessoa.');
    } finally {
      setSalvandoPessoa(false);
    }
  };

  return (
    <div className="form-section emprestimo-secao">
      <label className="emp-secao-toggle">
        <input
          type="checkbox"
          checked={state.ativo}
          onChange={(e) => setters.setAtivo(e.target.checked)}
          tabIndex={89}
        />
        {' '}Esta transação faz parte de um empréstimo
      </label>

      {state.ativo && (
        <div className="emp-secao-campos">
          <p className="emp-secao-hint">
            {state.direcao === 'concedido'
              ? 'Você está emprestando — este gasto não conta como despesa real nos relatórios.'
              : 'Você está recebendo — o valor será dividido entre principal (abatimento) e juros (receita).'}
          </p>

          {avisoEmprestimoSemDesembolso && (
            <div
              className="emp-aviso-soft"
              role="alert"
              style={{
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 12,
                fontSize: 12,
                lineHeight: 1.45
              }}
            >
              ⚠️ {avisoEmprestimoSemDesembolso}
            </div>
          )}

          <div className="form-section">
            <label>Pessoa:</label>
            <div className="emp-pessoa-row">
              <select
                value={state.pessoaId}
                onChange={(e) => setters.setPessoaId(e.target.value)}
                disabled={state.loadingPessoas}
                tabIndex={90}
              >
                <option value="">{state.loadingPessoas ? 'Carregando...' : 'Selecione...'}</option>
                {state.pessoas.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.nome}{p.contato ? ` (${p.contato})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="emp-btn-mini"
                onClick={() => setShowNovaPessoa(!showNovaPessoa)}
                tabIndex={91}
              >
                {showNovaPessoa ? '×' : '+ Nova'}
              </button>
            </div>
            {showNovaPessoa && (
              <div className="emp-nova-pessoa">
                <input
                  type="text"
                  placeholder="Nome"
                  value={novaPessoaNome}
                  onChange={(e) => setNovaPessoaNome(e.target.value)}
                  tabIndex={92}
                />
                <input
                  type="text"
                  placeholder="Contato (opcional)"
                  value={novaPessoaContato}
                  onChange={(e) => setNovaPessoaContato(e.target.value)}
                  tabIndex={93}
                />
                <button
                  type="button"
                  onClick={handleCriarPessoa}
                  disabled={salvandoPessoa}
                  className="emp-btn-mini emp-btn-confirmar"
                  tabIndex={94}
                >
                  {salvandoPessoa ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            )}
          </div>

          {state.pessoaId && (
            <>
              <div className="form-section">
                <label>Como deseja prosseguir?</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="empModo"
                      value="vincular"
                      checked={state.modo === 'vincular'}
                      onChange={() => setters.setModo('vincular')}
                      tabIndex={95}
                    />
                    {' '}Vincular a empréstimo existente
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="empModo"
                      value="criar"
                      checked={state.modo === 'criar'}
                      onChange={() => setters.setModo('criar')}
                      tabIndex={96}
                    />
                    {' '}Criar novo empréstimo com esta transação
                  </label>
                </div>
              </div>

              {state.modo === 'vincular' ? (
                <div className="form-section">
                  <label>Empréstimo:</label>
                  {state.loadingEmprestimos ? (
                    <p className="emp-secao-loading">Carregando empréstimos...</p>
                  ) : state.emprestimosPessoa.length === 0 ? (
                    <p className="emp-secao-vazio">
                      Esta pessoa não tem empréstimos ativos. Selecione "Criar novo empréstimo".
                    </p>
                  ) : (
                    <select
                      value={state.emprestimoId}
                      onChange={(e) => setters.setEmprestimoId(e.target.value)}
                      tabIndex={97}
                    >
                      <option value="">Selecione...</option>
                      {state.emprestimosPessoa.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {formatarMoedaBRL(emp.valorEsperadoRetorno)} — {labelTipoRetorno(emp.tipoRetorno)} (prazo {emp.prazoFinal ? formatDateBR(emp.prazoFinal) : '—'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="emp-campos-novo">
                  <div className="form-section">
                    <label>Valor esperado de retorno:</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={state.novoValorEsperado}
                      onChange={(e) => setters.setNovoValorEsperado(e.target.value)}
                      placeholder="0,00"
                      tabIndex={97}
                    />
                    <small>
                      Sugestão: mesmo valor desta transação ({formatarMoedaBRL(valorTotal || 0)}). Você pode ajustar.
                    </small>
                  </div>
                  <div className="form-section">
                    <label>Tipo de retorno:</label>
                    <select
                      value={state.novoTipoRetorno}
                      onChange={(e) => setters.setNovoTipoRetorno(e.target.value)}
                      tabIndex={98}
                    >
                      <option value="valor_fixo">Valor fixo (sem juros)</option>
                      <option value="sem_juros">Sem juros — devolver o que emprestou</option>
                    </select>
                    <small>Para empréstimos com juros, crie o empréstimo primeiro na tela de Empréstimos.</small>
                  </div>
                  <div className="form-section">
                    <label>Prazo final:</label>
                    <input
                      type="date"
                      value={state.novoPrazoFinal}
                      onChange={(e) => setters.setNovoPrazoFinal(e.target.value)}
                      tabIndex={99}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EmprestimoSecao;
