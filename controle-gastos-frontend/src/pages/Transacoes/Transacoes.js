// src/pages/Transacoes/Transacoes.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';                     // Import SweetAlert2 para confirmações
import { toast } from 'react-toastify';             // Import Toastify para mensagens
import { obterTransacoes, excluirTransacao } from '../../api';
import TransactionCard from '../../components/Transaction/TransactionCard';
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
  const [orderOption, setOrderOption] = useState('mais-recentes');

  // Edição/Criação
  const [editingTransacao, setEditingTransacao] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Carrega todas as transações do backend
  const carregarTransacoes = async () => {
    try {
      const dados = await obterTransacoes();
     

      // 1) Para cada transação, unificamos as tags de todos os pagamentos em transacao.tags
      let lista = (dados.transacoes || []).map((tr) => {
        const combinedTags = {};

        if (tr.pagamentos && Array.isArray(tr.pagamentos)) {
          tr.pagamentos.forEach((pg) => {
            // Aqui usamos "pg.tags" e não "pg.paymentTags"
            const payTags = pg.tags || {};
            /*
              Exemplo de payTags:
              {
                "Status da transação": ["Pago"],
                "Método de Pagamento": ["Pix"]
              }
            */
            Object.keys(payTags).forEach((cat) => {
              if (!combinedTags[cat]) {
                combinedTags[cat] = [];
              }
              combinedTags[cat] = [...combinedTags[cat], ...payTags[cat]];
            });
          });
        }

        // Retorna a transação com a nova propriedade "tags"
        return { ...tr, tags: combinedTags };
      });

      // 2) Ordena por data desc inicialmente (padrão)
      lista.sort((a, b) => new Date(b.data) - new Date(a.data));

      setTransacoes(lista);
      setFilteredTransacoes(lista);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast.error('Erro ao carregar transações.');
    }
  };

  useEffect(() => {
    carregarTransacoes();
  }, []);

  // Filtro e Ordenação: busca por descrição, pessoa e tags
  useEffect(() => {
    let resultado = [...transacoes];

    // 1) Filtro de busca
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      resultado = resultado.filter((tr) => {
        // Verifica se a descrição bate
        const matchDescricao = tr.descricao.toLowerCase().includes(search);

        // Verifica se o searchTerm aparece em "pessoa" (nos pagamentos)
        const matchPessoa =
          tr.pagamentos &&
          tr.pagamentos.some(
            (pg) => pg.pessoa && pg.pessoa.toLowerCase().includes(search)
          );

        // Verifica se o searchTerm aparece nas tags unificadas
        const matchTags = Object.keys(tr.tags || {}).some((cat) =>
          tr.tags[cat].some((tag) => tag.toLowerCase().includes(search))
        );

        return matchDescricao || matchPessoa || matchTags;
      });
    }

    // 2) Filtro de tipo
    if (filterType !== 'todos') {
      resultado = resultado.filter((tr) => tr.tipo === filterType);
    }

    // 3) Ordenação
    switch (orderOption) {
      case 'mais-recentes':
        resultado.sort((a, b) => new Date(b.data) - new Date(a.data));
        break;
      case 'mais-antigos':
        resultado.sort((a, b) => new Date(a.data) - new Date(b.data));
        break;
      case 'valor-crescente':
        resultado.sort((a, b) => a.valor - b.valor);
        break;
      case 'valor-decrescente':
        resultado.sort((a, b) => b.valor - a.valor);
        break;
      default:
        resultado.sort((a, b) => new Date(b.data) - new Date(a.data));
        break;
    }

    setFilteredTransacoes(resultado);
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

  // Excluir transação utilizando SweetAlert2 para confirmação e Toastify para feedback
  const handleDelete = async (id) => {
    Swal.fire({
      title: 'Tem certeza que deseja excluir esta transação?',
      text: 'Esta ação não poderá ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await excluirTransacao(id);
          toast.success('Transação excluída com sucesso!');
          carregarTransacoes();
        } catch (error) {
          console.error('Erro ao excluir transação:', error);
          toast.error('Erro ao excluir transação.');
        }
      }
    });
  };

  return (
    <div className="transacoes-container">
      <h1>Transações</h1>

      {/* Filtros e ações */}
      <div className="transacoes-actions">
        <input
          type="text"
          placeholder="Buscar transações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="todos">Todos os tipos</option>
          <option value="gasto">Gastos</option>
          <option value="recebivel">Recebíveis</option>
        </select>

        <select
          value={orderOption}
          onChange={(e) => setOrderOption(e.target.value)}
        >
          <option value="mais-recentes">Lançamentos mais recentes</option>
          <option value="mais-antigos">Lançamentos mais antigos</option>
          <option value="valor-crescente">Valor total crescente</option>
          <option value="valor-decrescente">Valor total decrescente</option>
        </select>
        
        <div className="button-group">
          <button onClick={handleCreate}>+ Nova Transação</button>
          <Link to="/importacao-em-massa" className="btn btn-importar">Importar em Massa</Link>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="transacoes-list">
        {filteredTransacoes.length > 0 ? (
          filteredTransacoes.map((tr) => (
            <TransactionCard
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
