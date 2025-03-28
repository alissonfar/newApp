// src/components/Tag/TagManagement.js
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';     
import Swal from 'sweetalert2';            
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
import IconSelector from './IconSelector';
import ColorPicker from './ColorPicker';
import './TagManagement.css';

const TagManagement = () => {
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Estados para nova tag
  const [novoTagNome, setNovoTagNome] = useState('');
  const [novoTagDescricao, setNovoTagDescricao] = useState('');
  const [novoTagCor, setNovoTagCor] = useState('#000000');
  const [novoTagIcone, setNovoTagIcone] = useState('tag');

  // Estados para edição de tag
  const [editTagCodigo, setEditTagCodigo] = useState(null);
  const [editTagNome, setEditTagNome] = useState('');
  const [editTagDescricao, setEditTagDescricao] = useState('');
  const [editTagCor, setEditTagCor] = useState('#000000');
  const [editTagIcone, setEditTagIcone] = useState('tag');

  // Estados para nova categoria
  const [novoCatNome, setNovoCatNome] = useState('');
  const [novoCatDescricao, setNovoCatDescricao] = useState('');
  const [novoCatCor, setNovoCatCor] = useState('#000000');
  const [novoCatIcone, setNovoCatIcone] = useState('folder');

  // Estados para edição de categoria
  const [editCatCodigo, setEditCatCodigo] = useState(null);
  const [editCatNome, setEditCatNome] = useState('');
  const [editCatDescricao, setEditCatDescricao] = useState('');
  const [editCatCor, setEditCatCor] = useState('#000000');
  const [editCatIcone, setEditCatIcone] = useState('folder');

  const carregarCategorias = async () => {
    try {
      const cats = await obterCategorias();
      console.log('carregarCategorias => cats:', cats); // [LOG]
      setCategorias(cats);
      if (!selectedCategory && cats.length > 0) {
        setSelectedCategory(cats[0]); // Seleciona a primeira categoria
      }
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias.');
    }
  };

  const carregarTags = async () => {
    try {
      const tgs = await obterTags();
      console.log('carregarTags => tgs:', tgs); // [LOG]
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

  // Filtra as tags com base na categoria selecionada
  const filteredTags = selectedCategory
    ? tags.filter(tag => {
        // Verifica se a tag.categoria é um ID ou nome
        if (typeof tag.categoria === 'string') {
          // Se for string, pode ser ID ou nome
          return tag.categoria === selectedCategory._id || tag.categoria === selectedCategory.nome;
        }
        // Se for objeto, compara o _id
        return tag.categoria._id === selectedCategory._id;
      })
    : [];

  // [LOGS] Adicionais para entender o que está acontecendo
  useEffect(() => {
    console.log('selectedCategory =>', selectedCategory);
    console.log('filteredTags =>', filteredTags);
  }, [selectedCategory, filteredTags]);

  // Função para verificar se o nome da tag já existe
  const nomeTagDuplicado = (nome, categoria, codigo = null) => {
    return tags.some(
      (tag) =>
        tag.nome.toLowerCase() === nome.toLowerCase() &&
        tag.categoria === categoria &&
        tag.codigo !== codigo
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
    if (nomeTagDuplicado(novoTagNome, selectedCategory.nome)) {
      toast.warn('Essa tag já existe nesta categoria.');
      return;
    }
    try {
      await criarTag({
        nome: novoTagNome.trim(),
        descricao: novoTagDescricao.trim(),
        categoria: selectedCategory._id,
        cor: novoTagCor,
        icone: novoTagIcone
      });
      setNovoTagNome('');
      setNovoTagDescricao('');
      setNovoTagCor('#000000');
      setNovoTagIcone('tag');
      carregarTags();
      toast.success('Tag criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar tag:', error);
      toast.error('Erro ao criar tag.');
    }
  };

  const handleEditarTag = (tag) => {
    setEditTagCodigo(tag.codigo);
    setEditTagNome(tag.nome);
    setEditTagDescricao(tag.descricao || '');
    setEditTagCor(tag.cor || '#000000');
    setEditTagIcone(tag.icone || 'tag');
  };

  const handleSalvarEdicaoTag = async () => {
    if (!editTagNome.trim()) {
      toast.warn('O nome da tag é obrigatório.');
      return;
    }
    try {
      await atualizarTag(editTagCodigo, {
        nome: editTagNome.trim(),
        descricao: editTagDescricao.trim(),
        categoria: selectedCategory._id,
        cor: editTagCor,
        icone: editTagIcone
      });
      setEditTagCodigo(null);
      setEditTagNome('');
      setEditTagDescricao('');
      setEditTagCor('#000000');
      setEditTagIcone('tag');
      carregarTags();
      toast.success('Tag atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar tag:', error);
      toast.error('Erro ao atualizar tag.');
    }
  };

  const handleExcluirTag = async (codigo) => {
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
          await excluirTag(codigo);
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
  const nomeCategoriaDuplicado = (nome, codigo = null) => {
    return categorias.some(
      (cat) =>
        cat.nome.toLowerCase() === nome.toLowerCase() && cat.codigo !== codigo
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
      const novaCategoria = await criarCategoria({
        nome: novoCatNome.trim(),
        descricao: novoCatDescricao.trim(),
        cor: novoCatCor,
        icone: novoCatIcone
      });
      setNovoCatNome('');
      setNovoCatDescricao('');
      setNovoCatCor('#000000');
      setNovoCatIcone('folder');
      carregarCategorias();
      toast.success('Categoria criada com sucesso!');
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      toast.error('Erro ao criar categoria.');
    }
  };

  const handleEditarCategoria = (categoria) => {
    setEditCatCodigo(categoria.codigo);
    setEditCatNome(categoria.nome);
    setEditCatDescricao(categoria.descricao || '');
    setEditCatCor(categoria.cor || '#000000');
    setEditCatIcone(categoria.icone || 'folder');
    setSelectedCategory(categoria);
  };

  const handleSalvarEdicaoCategoria = async () => {
    if (!editCatNome.trim()) {
      toast.warn('O nome da categoria é obrigatório.');
      return;
    }
    try {
      await atualizarCategoria(editCatCodigo, {
        nome: editCatNome.trim(),
        descricao: editCatDescricao.trim(),
        cor: editCatCor,
        icone: editCatIcone
      });
      setEditCatCodigo(null);
      setEditCatNome('');
      setEditCatDescricao('');
      setEditCatCor('#000000');
      setEditCatIcone('folder');
      carregarCategorias();
      toast.success('Categoria atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      toast.error('Erro ao atualizar categoria.');
    }
  };

  const handleExcluirCategoria = async (codigo) => {
    Swal.fire({
      title: 'Tem certeza que deseja excluir esta categoria?',
      text: 'Todas as tags associadas também serão excluídas. Essa ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await excluirCategoria(codigo);
          if (selectedCategory && selectedCategory.codigo === codigo) {
            setSelectedCategory(null);
          }
          carregarCategorias();
          carregarTags();
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
                  key={cat.codigo}
                  className={selectedCategory && cat.codigo === selectedCategory.codigo ? 'selected' : ''}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <div className="categoria-item">
                    <div className="icone-preview" style={{ color: cat.cor }}>
                      <i className={`fas fa-${cat.icone || 'folder'}`}></i>
                    </div>
                    <span>{cat.nome}</span>
                  </div>
                  <div className="acoes-categoria">
                    <button onClick={() => handleEditarCategoria(cat)}>Editar</button>
                    <button onClick={() => handleExcluirCategoria(cat.codigo)}>Excluir</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma categoria encontrada.</p>
          )}
          
          <div className="form-section">
            <h4>Adicionar Nova Categoria</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Nome</label>
                <input
                  type="text"
                  value={novoCatNome}
                  onChange={e => setNovoCatNome(e.target.value)}
                  placeholder="Nome da categoria"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Descrição</label>
                <input
                  type="text"
                  value={novoCatDescricao}
                  onChange={e => setNovoCatDescricao(e.target.value)}
                  placeholder="Descrição (opcional)"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Cor</label>
                <ColorPicker
                  value={novoCatCor}
                  onChange={setNovoCatCor}
                  className="color-select"
                />
              </div>
              <div className="form-group">
                <label>Ícone</label>
                <IconSelector
                  value={novoCatIcone}
                  onChange={setNovoCatIcone}
                  className="icon-select"
                  cor={novoCatCor}
                />
              </div>
            </div>
            <button onClick={handleAdicionarCategoria}>Adicionar</button>
          </div>
          
          {editCatCodigo && (
            <div className="form-section">
              <h4>Editar Categoria</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={editCatNome}
                    onChange={e => setEditCatNome(e.target.value)}
                    placeholder="Nome da categoria"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Descrição</label>
                  <input
                    type="text"
                    value={editCatDescricao}
                    onChange={e => setEditCatDescricao(e.target.value)}
                    placeholder="Descrição (opcional)"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Cor</label>
                  <ColorPicker
                    value={editCatCor}
                    onChange={setEditCatCor}
                    className="color-select"
                  />
                </div>
                <div className="form-group">
                  <label>Ícone</label>
                  <IconSelector
                    value={editCatIcone}
                    onChange={setEditCatIcone}
                    className="icon-select"
                    cor={editCatCor}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button onClick={handleSalvarEdicaoCategoria}>Salvar</button>
                <button onClick={() => setEditCatCodigo(null)} className="secondary">Cancelar</button>
              </div>
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
          {selectedCategory && (
            <>
              {filteredTags.length > 0 ? (
                <ul className="tag-list">
                  {filteredTags.map(tag => (
                    <li key={tag.codigo}>
                      {editTagCodigo === tag.codigo ? (
                        <div className="form-section">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Nome</label>
                              <input
                                type="text"
                                value={editTagNome}
                                onChange={e => setEditTagNome(e.target.value)}
                                placeholder="Nome da tag"
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Descrição</label>
                              <input
                                type="text"
                                value={editTagDescricao}
                                onChange={e => setEditTagDescricao(e.target.value)}
                                placeholder="Descrição (opcional)"
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Cor</label>
                              <ColorPicker
                                value={editTagCor}
                                onChange={setEditTagCor}
                                className="color-select"
                              />
                            </div>
                            <div className="form-group">
                              <label>Ícone</label>
                              <IconSelector
                                value={editTagIcone}
                                onChange={setEditTagIcone}
                                className="icon-select"
                                cor={editTagCor}
                              />
                            </div>
                          </div>
                          <div className="form-actions">
                            <button onClick={handleSalvarEdicaoTag}>Salvar</button>
                            <button onClick={() => setEditTagCodigo(null)} className="secondary">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="view-tag">
                          <div className="tag-item">
                            <div className="icone-preview" style={{ color: tag.cor }}>
                              <i className={`fas fa-${tag.icone || 'tag'}`}></i>
                            </div>
                            <span>
                              <strong>{tag.nome}</strong>
                              {tag.descricao && ` - ${tag.descricao}`}
                            </span>
                          </div>
                          <div className="acoes-tag">
                            <button onClick={() => handleEditarTag(tag)}>Editar</button>
                            <button onClick={() => handleExcluirTag(tag.codigo)}>Excluir</button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhuma tag cadastrada nesta categoria.</p>
              )}
              <div className="form-section">
                <h4>Adicionar Nova Tag</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nome</label>
                    <input
                      type="text"
                      value={novoTagNome}
                      onChange={e => setNovoTagNome(e.target.value)}
                      placeholder="Nome da tag"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Descrição</label>
                    <input
                      type="text"
                      value={novoTagDescricao}
                      onChange={e => setNovoTagDescricao(e.target.value)}
                      placeholder="Descrição (opcional)"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Cor</label>
                    <ColorPicker
                      value={novoTagCor}
                      onChange={setNovoTagCor}
                      className="color-select"
                    />
                  </div>
                  <div className="form-group">
                    <label>Ícone</label>
                    <IconSelector
                      value={novoTagIcone}
                      onChange={setNovoTagIcone}
                      className="icon-select"
                      cor={novoTagCor}
                    />
                  </div>
                </div>
                <button onClick={handleAdicionarTag}>Adicionar</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagManagement;
