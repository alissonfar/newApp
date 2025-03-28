// src/components/Transaction/TransactionCardTransacoes.js
import React, { useEffect, useState } from 'react';
import { FaArrowUp, FaArrowDown, FaEdit, FaTrash } from 'react-icons/fa';
import './TransactionCardTransacoes.css';
import { obterCategorias, obterTags } from '../../api';

const TransactionCard = ({ transacao, onEdit, onDelete }) => {
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);

  // Carrega categorias e tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriasData, tagsData] = await Promise.all([
          obterCategorias(),
          obterTags()
        ]);
        setCategorias(categoriasData);
        setTags(tagsData);
      } catch (error) {
        console.error('Erro ao carregar categorias e tags:', error);
      }
    };
    fetchData();
  }, []);

  // Função para converter IDs em nomes
  const getTagInfo = (tagId) => {
    console.log('Buscando info para tagId:', tagId); // [DEBUG]
    const tag = tags.find(t => t._id === tagId);
    if (!tag) {
      console.log('Tag não encontrada:', tagId); // [DEBUG]
      return null;
    }
    
    // Tenta encontrar a categoria primeiro pelo ID, depois pelo nome
    let categoria = categorias.find(c => c._id === tag.categoria);
    if (!categoria && typeof tag.categoria === 'object') {
      categoria = categorias.find(c => c._id === tag.categoria._id);
    }
    if (!categoria) {
      categoria = categorias.find(c => c.nome === tag.categoria);
    }

    console.log('Tag encontrada:', tag.nome, 'Categoria:', categoria?.nome); // [DEBUG]

    return {
      tagNome: tag.nome,
      categoriaNome: categoria ? categoria.nome : 'Categoria não encontrada',
      cor: tag.cor || categoria?.cor || '#000000'
    };
  };

  // Define o ícone de acordo com o tipo
  const tipoIcon =
    transacao.tipo === 'gasto' ? (
      <FaArrowDown className="tipo-icon gasto" />
    ) : (
      <FaArrowUp className="tipo-icon recebivel" />
    );

  return (
    <div className="transaction-card-transacoes">
      <div className="card-header">
        <h3 className="card-title">{transacao.descricao}</h3>
        <div className="card-header-icon">{tipoIcon}</div>
      </div>
      <hr className="divider" />
      <div className="card-info">
        <div className="info-date">
          {new Date(transacao.data).toLocaleDateString('pt-BR')}
        </div>
        <div className="info-value">
          R${parseFloat(transacao.valor).toFixed(2)}
          <span className="badge">
            {transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'}
          </span>
        </div>
      </div>

      {/* Exibe cada pagamento, incluindo as tags associadas */}
      {transacao.pagamentos && transacao.pagamentos.length > 0 && (
        <div className="card-payments">
          {transacao.pagamentos.map((pg, idx) => (
            <div key={idx} className="payment-line">
              <div className="payment-info">
                <strong>{pg.pessoa}:</strong> R${parseFloat(pg.valor).toFixed(2)}
              </div>
              <div className="payment-tags">
                {pg.tags && Object.entries(pg.tags).length > 0 ? (
                  Object.entries(pg.tags).map(([categoriaId, tagIds]) => {
                    console.log('Tags para categoria:', categoriaId, tagIds); // [DEBUG]
                    return tagIds.map((tagId) => {
                      const tagInfo = getTagInfo(tagId);
                      if (!tagInfo) return null;
                      
                      return (
                        <span
                          key={`${categoriaId}-${tagId}`}
                          className="tag-chip"
                          style={{
                            backgroundColor: `${tagInfo.cor}20`,
                            color: tagInfo.cor
                          }}
                        >
                          {tagInfo.categoriaNome}: {tagInfo.tagNome}
                        </span>
                      );
                    });
                  })
                ) : (
                  <span className="no-tags">Sem tags</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-actions">
        <button className="action-btn edit-btn" onClick={() => onEdit(transacao)}>
          <FaEdit /> Editar
        </button>
        <button className="action-btn delete-btn" onClick={() => onDelete(transacao.id)}>
          <FaTrash /> Excluir
        </button>
      </div>
    </div>
  );
};

export default TransactionCard;
