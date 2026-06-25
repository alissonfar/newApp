// src/components/Emprestimos/EmprestimoFormFields.js
// Suíte interna de campos de Empréstimo (depois do checkbox "ativo").
// Reutilizada por:
//  - EmprestimoSecao.js (caminho legado, aba Avançado, 1 pagamento)
//  - TabPagamentos.js (caminho novo, aba Pagamentos, 1 suíte por linha)
//
// O CSS (.emp-campo, .emp-secao-campos, etc) é importado pelo pai
// (EmprestimoSecao.css), porque já existia antes deste refactor.
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { criarPessoa } from '../../api';
import { formatarMoedaBRL, labelTipoRetorno } from '../../utils/emprestimoFormat';
import { formatDateBR } from '../../utils/dateUtils';

const EmprestimoFormFields = ({
  state,
  setters,
  adicionarPessoa,
  valorTotal,
  tipoTransacao,
  tabIndexBase,
  emprestimoIdName
}) => {
  const [showNovaPessoa, setShowNovaPessoa] = useState(false);
  const [novaPessoaNome, setNovaPessoaNome] = useState('');
  const [novaPessoaContato, setNovaPessoaContato] = useState('');
  const [salvandoPessoa, setSalvandoPessoa] = useState(false);

  // tabIndex derivado do base, replicando o padrão do EmprestimoSecao legado:
  // 90 pessoa-select, 91 botão +Nova, 92-94 inputs nova pessoa,
  // 95 radio vincular, 96 radio criar, 97 select empréstimo (vincular)
  // OU input valor esperado (criar), 98 select tipo retorno / valor esperado
  // (vincular), 99 input prazo final.
  // Quando `tabIndexBase` é fornecido (caso pagamento), soma-se a base.
  const ti = (n) => tabIndexBase != null ? tabIndexBase + (n - 90) : n;

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
    <>
      <div className="emp-campo">
        <label>Pessoa:</label>
        <div className="emp-pessoa-row">
          <select
            value={state.pessoaId}
            onChange={(e) => setters.setPessoaId(e.target.value)}
            disabled={state.loadingPessoas}
            tabIndex={ti(90)}
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
            tabIndex={ti(91)}
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
              tabIndex={ti(92)}
            />
            <input
              type="text"
              placeholder="Contato (opcional)"
              value={novaPessoaContato}
              onChange={(e) => setNovaPessoaContato(e.target.value)}
              tabIndex={ti(93)}
            />
            <button
              type="button"
              onClick={handleCriarPessoa}
              disabled={salvandoPessoa}
              className="emp-btn-mini emp-btn-confirmar"
              tabIndex={ti(94)}
            >
              {salvandoPessoa ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        )}
      </div>

      {state.pessoaId && (
        <>
          <div className="emp-campo">
            <label>Como deseja prosseguir?</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name={emprestimoIdName}
                  value="vincular"
                  checked={state.modo === 'vincular'}
                  onChange={() => setters.setModo('vincular')}
                  tabIndex={ti(95)}
                />
                {' '}Vincular a empréstimo existente
              </label>
              <label>
                <input
                  type="radio"
                  name={emprestimoIdName}
                  value="criar"
                  checked={state.modo === 'criar'}
                  onChange={() => setters.setModo('criar')}
                  tabIndex={ti(96)}
                />
                {' '}Criar novo empréstimo com esta transação
              </label>
            </div>
          </div>

          {state.modo === 'vincular' ? (
            <div className="emp-campo">
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
                  tabIndex={ti(97)}
                >
                  <option value="">Selecione...</option>
                  {state.emprestimosPessoa.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {formatarMoedaBRL(emp.totalEsperado || 0)} — {labelTipoRetorno(emp.tipoRetorno)} (prazo {emp.prazoFinal ? formatDateBR(emp.prazoFinal) : '—'})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="emp-campos-novo">
              <div className="emp-campo">
                <label>Tipo de retorno:</label>
                <select
                  value={state.novoTipoRetorno}
                  onChange={(e) => setters.setNovoTipoRetorno(e.target.value)}
                  tabIndex={ti(98)}
                >
                  <option value="valor_fixo">Valor fixo (sem juros)</option>
                  <option value="sem_juros">Sem juros — devolver o que emprestou</option>
                </select>
                <small>Para empréstimos com juros, crie o empréstimo primeiro na tela de Empréstimos.</small>
              </div>
              <div className="emp-campo">
                <label>Prazo final:</label>
                <input
                  type="date"
                  value={state.novoPrazoFinal}
                  onChange={(e) => setters.setNovoPrazoFinal(e.target.value)}
                  tabIndex={ti(99)}
                />
              </div>
            </div>
          )}

          {/* Valor esperado de retorno — a partir do design 2026-06-24,
              cada TX de gasto tem seu próprio valorEsperadoRetorno
              (saiu do schema Empréstimo). Por isso o campo aparece em
              AMBOS os modos (vincular e criar), mas só para gastos
              (em recebimentos, valor esperado não faz sentido). */}
          {tipoTransacao === 'gasto' && (
            <div className="emp-campo">
              <label>Valor esperado de retorno:</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={state.novoValorEsperado}
                onChange={(e) => setters.setNovoValorEsperado(e.target.value)}
                placeholder="0,00"
                tabIndex={state.modo === 'vincular' ? ti(98) : ti(97)}
              />
              <small>
                Sugestão: mesmo valor desta transação ({formatarMoedaBRL(valorTotal || 0)}). Você pode ajustar.
              </small>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default EmprestimoFormFields;
