import React, { useEffect, useState } from 'react';
import { obterTransacoes, excluirTransacao } from '../../api';
import TransactionCardTransacoes from '../../components/Transaction/TransactionCardTransacoes';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import './Transacoes.css';

const Transacoes = () => {
  const [transacoes, setTransacoes] = useState([]);
  const [filteredTransacoes, setFilteredTransacoes] = useState([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');
  
  // Ordenação
  const [orderOption, setOrderOption] = useState('mais-recentes'); // Opções: mais-recentes, mais-antigos, valor-crescente, valor-decrescente
  
  // Edição/Criação
  const [editingTransacao, setEditingTransacao] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Carrega todas as transações do backend
  const carregarTransacoes = async () => {
    try {
      const dados = await obterTransacoes();
      // Ordena por data desc inicialmente (padrão)
      const lista = (dados.transacoes || []).sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      );
      setTransacoes(lista);
      setFilteredTransacoes(lista);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
    }
  };

  useEffect(() => {
    carregarTransacoes();
  }, []);

  // Filtro e Ordenação: busca por descrição, pessoa, tags e ordena conforme orderOption
  useEffect(() => {
    let resultado = [...transacoes];

    // 1) Filtro de busca
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      resultado = resultado.filter(tr => {
        // Verifica se a descrição bate
        const matchDescricao = tr.descricao.toLowerCase().includes(search);

        // Verifica se o searchTerm aparece em "pessoa" ou "tags" de algum pagamento
        const matchPagamentos = tr.pagamentos && tr.pagamentos.some(pg => {
          // Pessoa
          const matchPessoa = pg.pessoa && pg.pessoa.toLowerCase().includes(search);
          
          // Tags (array de strings) em cada categoria
          const matchTags = Object.keys(pg.paymentTags || {}).some(cat => 
            pg.paymentTags[cat].some(tag => tag.toLowerCase().includes(search))
          );

          return matchPessoa || matchTags;
        });

        return matchDescricao || matchPagamentos;
      });
    }

    // 2) Filtro de tipo
    if (filterType !== 'todos') {
      resultado = resultado.filter(tr => tr.tipo === filterType);
    }

    // 3) Ordenação
    let sortedResultado = [...resultado];
    switch(orderOption) {
      case 'mais-recentes':
        sortedResultado.sort((a, b) => new Date(b.data) - new Date(a.data));
        break;
      case 'mais-antigos':
        sortedResultado.sort((a, b) => new Date(a.data) - new Date(b.data));
        break;
      case 'valor-crescente':
        // Supondo que cada transação possua a propriedade "valor"
        sortedResultado.sort((a, b) => a.valor - b.valor);
        break;
      case 'valor-decrescente':
        sortedResultado.sort((a, b) => b.valor - a.valor);
        break;
      default:
        sortedResultado.sort((a, b) => new Date(b.data) - new Date(a.data));
        break;
    }

    setFilteredTransacoes(sortedResultado);
  }, [searchTerm, filterType, transacoes, orderOption]);

  // Editar transação
  const handleEdit = (transacao) => {
    setEditingTransacao(transacao);
    setModalOpen(true);
  };

  // Criar nova transação
  const handleCreate = () => {
    setEditingTransacao(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingTransacao(null);
    setModalOpen(false);
  };

  // Ao salvar/atualizar transação
  const handleSuccess = () => {
    handleCloseModal();
    carregarTransacoes();
  };

  // Excluir
  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      try {
        await excluirTransacao(id);
        alert('Transação excluída com sucesso!');
        carregarTransacoes();
      } catch (error) {
        console.error('Erro ao excluir transação:', error);
        alert('Erro ao excluir transação.');
      }
    }
  };

  return (
    <div className="transacoes-container">
      <h2>Transações</h2>
      {/* Barra de Filtros */}
      <div className="transacoes-filters">
        <input
          type="text"
          placeholder="Buscar por descrição, pessoa ou tags..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="gasto">Gasto</option>
          <option value="recebivel">Recebível</option>
        </select>
        <select
          value={orderOption}
          onChange={e => setOrderOption(e.target.value)}
        >
          <option value="mais-recentes">Lançamentos mais recentes</option>
          <option value="mais-antigos">Lançamentos mais antigos</option>
          <option value="valor-crescente">Valor total crescente</option>
          <option value="valor-decrescente">Valor total decrescente</option>
        </select>
        <button onClick={handleCreate}>+ Nova Transação</button>
      </div>

      {/* Lista de Transações */}
      <div className="transacoes-list">
        {filteredTransacoes.length > 0 ? (
          filteredTransacoes.map(tr => (
            <TransactionCardTransacoes
              key={tr.id}
              transacao={tr}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <p>Nenhuma transação encontrada.</p>
        )}
      </div>

      {modalOpen && (
        <ModalTransacao onClose={handleCloseModal}>
          <NovaTransacaoForm
            transacao={editingTransacao}
            onSuccess={handleSuccess}
            onClose={handleCloseModal}
          />
        </ModalTransacao>
      )}
    </div>
  );
};

export default Transacoes;
