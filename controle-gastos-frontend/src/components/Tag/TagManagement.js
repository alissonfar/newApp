// src/components/Tag/TagManagement.js
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';     // Para mensagens de sucesso/erro
import Swal from 'sweetalert2';            // Para confirmações de exclusão
import {
  obterCategorias,
  obterTags,
  criarTag,
  atualizarTag,
  excluirTag,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria
} from '../../api.js';
import './TagManagement.css';

const TagManagement = () => {
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Estados para nova tag
  const [novoTagNome, setNovoTagNome] = useState('');
  const [novoTagDescricao, setNovoTagDescricao] = useState('');

  // Estados para edição de tag
  const [editTagId, setEditTagId] = useState(null);
  const [editTagNome, setEditTagNome] = useState('');
  const [editTagDescricao, setEditTagDescricao] = useState('');

  // Estados para nova categoria
  const [novoCatNome, setNovoCatNome] = useState('');
  const [novoCatDescricao, setNovoCatDescricao] = useState('');

  // Estados para edição de categoria
  const [editCatId, setEditCatId] = useState(null);
  const [editCatNome, setEditCatNome] = useState('');
  const [editCatDescricao, setEditCatDescricao] = useState('');

  const carregarCategorias = async () => {
    try {
      const cats = await obterCategorias();
      setCategorias(cats);
      if (!selectedCategory && cats.length > 0) {
        setSelectedCategory(cats[0]); // Seleciona a primeira categoria por padrão
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias.');
    }
  };

  const carregarTags = async () => {
    try {
      const tgs = await obterTags();
      setTags(tgs);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
      toast.error('Erro ao carregar tags.');
    }
  };

  useEffect(() => {
    carregarCategorias();
    carregarTags();
  }, []);

  const filteredTags = selectedCategory
    ? tags.filter(
        (tag) =>
          tag.categoria &&
          tag.categoria.toLowerCase() === selectedCategory.nome.toLowerCase()
      )
    : [];

  // Funções para gerenciamento de tags
  const nomeTagDuplicado = (nome, id = null) => {
    return tags.some(
      (tag) =>
        tag.nome.toLowerCase() === nome.toLowerCase() && tag.id !== id
    );
  };

  const handleAdicionarTag = async () => {
    if (!selectedCategory) {
      toast.warn('Selecione uma categoria primeiro.');
      return;
    }
    if (!novoTagNome.trim()) {
      toast.warn('O nome da tag é obrigatório.');
      return;
    }
    if (nomeTagDuplicado(novoTagNome)) {
      toast.warn('Essa tag já existe.');
      return;
    }
    try {
      await criarTag({
        nome: novoTagNome.trim(),
        descricao: novoTagDescricao.trim(),
        categoria: selectedCategory.nome
      });
      setNovoTagNome('');
      setNovoTagDescricao('');
      carregarTags();
      toast.success('Tag criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar tag:', error);
      toast.error('Erro ao criar tag.');
    }
  };

  const handleEditarTag = (tag) => {
    setEditTagId(tag.id);
    setEditTagNome(tag.nome);
    setEditTagDescricao(tag.descricao || '');
  };

  const handleSalvarEdicaoTag = async () => {
    if (!editTagNome.trim()) {
      toast.warn('O nome da tag é obrigatório.');
      return;
    }
    try {
      await atualizarTag(editTagId, {
        nome: editTagNome.trim(),
        descricao: editTagDescricao.trim(),
        categoria: selectedCategory ? selectedCategory.nome : ''
      });
      setEditTagId(null);
      setEditTagNome('');
      setEditTagDescricao('');
      carregarTags();
      toast.success('Tag atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar tag:', error);
      toast.error('Erro ao atualizar tag.');
    }
  };

  const handleExcluirTag = async (tagId) => {
    // Substituímos window.confirm por SweetAlert2
    Swal.fire({
      title: 'Tem certeza que deseja excluir esta tag?',
      text: 'Essa ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await excluirTag(tagId);
          carregarTags();
          toast.success('Tag excluída com sucesso!');
        } catch (error) {
          console.error('Erro ao excluir tag:', error);
          toast.error('Erro ao excluir tag.');
        }
      }
    });
  };

  // Funções para gerenciamento de categorias
  const nomeCategoriaDuplicado = (nome, id = null) => {
    return categorias.some(
      (cat) =>
        cat.nome.toLowerCase() === nome.toLowerCase() && cat.id !== id
    );
  };

  const handleAdicionarCategoria = async () => {
    if (!novoCatNome.trim()) {
      toast.warn('O nome da categoria é obrigatório.');
      return;
    }
    if (nomeCategoriaDuplicado(novoCatNome)) {
      toast.warn('Essa categoria já existe.');
      return;
    }
    try {
      await criarCategoria({
        nome: novoCatNome.trim(),
        descricao: novoCatDescricao.trim()
      });
      setNovoCatNome('');
      setNovoCatDescricao('');
      carregarCategorias();
      toast.success('Categoria criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      toast.error('Erro ao criar categoria.');
    }
  };

  const handleEditarCategoria = (cat) => {
    setEditCatId(cat.id);
    setEditCatNome(cat.nome);
    setEditCatDescricao(cat.descricao || '');
    setSelectedCategory(cat);
  };

  const handleSalvarEdicaoCategoria = async () => {
    if (!editCatNome.trim()) {
      toast.warn('O nome da categoria é obrigatório.');
      return;
    }
    try {
      await atualizarCategoria(editCatId, {
        nome: editCatNome.trim(),
        descricao: editCatDescricao.trim()
      });
      setEditCatId(null);
      setEditCatNome('');
      setEditCatDescricao('');
      carregarCategorias();
      toast.success('Categoria atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      toast.error('Erro ao atualizar categoria.');
    }
  };

  const handleExcluirCategoria = async (catId) => {
    // Substituímos window.confirm por SweetAlert2
    Swal.fire({
      title: 'Tem certeza que deseja excluir esta categoria?',
      text: 'Essa ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await excluirCategoria(catId);
          if (selectedCategory && selectedCategory.id === catId) {
            setSelectedCategory(null);
          }
          carregarCategorias();
          toast.success('Categoria excluída com sucesso!');
        } catch (error) {
          console.error('Erro ao excluir categoria:', error);
          toast.error('Erro ao excluir categoria.');
        }
      }
    });
  };

  return (
    <div className="tag-management-page-container">
      <h2>Gerenciar Categorias e Tags</h2>
      <div className="tag-management-container">
        {/* Seção de Categorias */}
        <div className="category-section">
          <h3>Categorias</h3>
          {categorias.length > 0 ? (
            <ul className="category-list">
              {categorias.map(cat => (
                <li
                  key={cat.id}
                  className={selectedCategory && cat.id === selectedCategory.id ? 'selected' : ''}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.nome}
                  <div className="acoes-categoria">
                    <button onClick={() => handleEditarCategoria(cat)}>Editar</button>
                    <button onClick={() => handleExcluirCategoria(cat.id)}>Excluir</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma categoria encontrada.</p>
          )}
          <div className="nova-categoria">
            <h4>Adicionar Nova Categoria</h4>
            <input
              type="text"
              value={novoCatNome}
              onChange={e => setNovoCatNome(e.target.value)}
              placeholder="Nome da categoria"
            />
            <input
              type="text"
              value={novoCatDescricao}
              onChange={e => setNovoCatDescricao(e.target.value)}
              placeholder="Descrição (opcional)"
            />
            <button onClick={handleAdicionarCategoria}>Adicionar</button>
          </div>
          {editCatId && (
            <div className="edit-categoria">
              <h4>Editar Categoria</h4>
              <input
                type="text"
                value={editCatNome}
                onChange={e => setEditCatNome(e.target.value)}
                placeholder="Nome da categoria"
              />
              <input
                type="text"
                value={editCatDescricao}
                onChange={e => setEditCatDescricao(e.target.value)}
                placeholder="Descrição (opcional)"
              />
              <button onClick={handleSalvarEdicaoCategoria}>Salvar</button>
              <button onClick={() => setEditCatId(null)}>Cancelar</button>
            </div>
          )}
        </div>

        {/* Seção de Tags */}
        <div className="tag-section">
          <h3>
            {selectedCategory
              ? `Tags em "${selectedCategory.nome}"`
              : 'Selecione uma categoria para visualizar tags'}
          </h3>
          {selectedCategory ? (
            <>
              {filteredTags.length > 0 ? (
                <ul className="tag-list">
                  {filteredTags.map(tag => (
                    <li key={tag.id}>
                      {editTagId === tag.id ? (
                        <div className="edit-tag">
                          <input
                            type="text"
                            value={editTagNome}
                            onChange={e => setEditTagNome(e.target.value)}
                            placeholder="Nome da tag"
                          />
                          <input
                            type="text"
                            value={editTagDescricao}
                            onChange={e => setEditTagDescricao(e.target.value)}
                            placeholder="Descrição (opcional)"
                          />
                          <button onClick={handleSalvarEdicaoTag}>Salvar</button>
                          <button onClick={() => setEditTagId(null)}>Cancelar</button>
                        </div>
                      ) : (
                        <div className="view-tag">
                          <span>
                            <strong>{tag.nome}</strong>
                            {tag.descricao && ` - ${tag.descricao}`}
                          </span>
                          <div className="acoes-tag">
                            <button onClick={() => handleEditarTag(tag)}>Editar</button>
                            <button onClick={() => handleExcluirTag(tag.id)}>Excluir</button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhuma tag cadastrada nesta categoria.</p>
              )}
              <div className="nova-tag">
                <h4>Adicionar Nova Tag</h4>
                <input
                  type="text"
                  value={novoTagNome}
                  onChange={e => setNovoTagNome(e.target.value)}
                  placeholder="Nome da tag"
                />
                <input
                  type="text"
                  value={novoTagDescricao}
                  onChange={e => setNovoTagDescricao(e.target.value)}
                  placeholder="Descrição (opcional)"
                />
                <button onClick={handleAdicionarTag}>Adicionar</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TagManagement;
