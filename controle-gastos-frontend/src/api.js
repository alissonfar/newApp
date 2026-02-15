// src/api.js

const API_BASE = process.env.REACT_APP_API_BASE;

// Utilitário para obter o token armazenado
function getToken() {
  return localStorage.getItem('token') || '';
}

// Monta os headers padrão para as requisições
function getHeaders(isJson = true) {
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/* ----- Categorias ----- */
export async function obterCategorias(incluirInativas = false) {
  const query = incluirInativas ? '?incluirInativas=true' : '';
  const resposta = await fetch(`${API_BASE}/categorias${query}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return dados.map(cat => ({
    ...cat,
    codigo: cat._id
  }));
}

export async function ativarCategoria(codigo) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}/ativar`, {
    method: 'PUT',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro ao ativar categoria.');
  }
  return { ...dados, codigo: dados._id };
}

export async function inativarCategoria(codigo) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}/inativar`, {
    method: 'PUT',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Erro ao inativar categoria.');
  }
  return { ...dados, codigo: dados._id };
}

export async function criarCategoria(categoria) {
  const resposta = await fetch(`${API_BASE}/categorias`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(categoria)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function atualizarCategoria(codigo, categoria) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      ...categoria,
      _id: codigo // Adiciona o _id no corpo da requisição
    })
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function excluirCategoria(codigo) {
  const resposta = await fetch(`${API_BASE}/categorias/${codigo}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

/* ----- Tags ----- */
export async function obterTags() {
  const resposta = await fetch(`${API_BASE}/tags`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return dados.map(tag => ({
    ...tag,
    codigo: tag._id
  }));
}

export async function criarTag(tag) {
  const resposta = await fetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(tag)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function atualizarTag(codigo, tag) {
  const resposta = await fetch(`${API_BASE}/tags/${codigo}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      ...tag,
      _id: codigo // Adiciona o _id no corpo da requisição
    })
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

export async function excluirTag(codigo) {
  const resposta = await fetch(`${API_BASE}/tags/${codigo}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  const dados = await resposta.json();
  // Mapeia _id para codigo para manter compatibilidade
  return {
    ...dados,
    codigo: dados._id
  };
}

/* ----- Autenticação ----- */
// Registrar usuário
export async function registrarUsuario({ nome, email, senha }) {
  const resposta = await fetch(`${API_BASE}/usuarios/registrar`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ nome, email, senha })
  });
  return await resposta.json();
}

// Fazer login
export async function loginUsuario({ email, senha }) {
  const resposta = await fetch(`${API_BASE}/usuarios/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ email, senha })
  });
  return await resposta.json();
}

/* ----- Transações ----- */
export async function obterTransacoes(params = {}) {
  // Adiciona o parâmetro proprietario na query string se estiver definido
  const query = new URLSearchParams(params).toString();
  const resposta = await fetch(`${API_BASE}/transacoes?${query}`, {
    headers: getHeaders(false)
  });
  const dados = await resposta.json();

  // Mapeia _id para id
  if (dados.transacoes) {
    dados.transacoes = dados.transacoes.map(t => ({
      ...t,
      id: t._id,
    }));
  }
  return dados;
}

export async function criarTransacao(transacao) {
  const resposta = await fetch(`${API_BASE}/transacoes`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(transacao)
  });
  return await resposta.json();
}

export async function atualizarTransacao(id, transacao) {
  const resposta = await fetch(`${API_BASE}/transacoes/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(transacao)
  });
  return await resposta.json();
}

export async function excluirTransacao(id) {
  const resposta = await fetch(`${API_BASE}/transacoes/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
  return await resposta.json();
}

// Função para registrar transações em massa
export const registrarTransacoesEmMassa = async (transacoes) => {
  try {
    const response = await fetch(`${API_BASE}/transacoes/bulk`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ transacoes })
    });
    return await response.json();
  } catch (error) {
    throw error.response?.data || error;
  }
};

/* ----- Relatório ----- */
export async function obterRelatorio() {
  const resposta = await fetch(`${API_BASE}/relatorio`, {
    headers: getHeaders(false)
  });
  return await resposta.json();
}

/* ----- Ferramentas Everest ----- */

// --- Notas Everest --- 
export async function obterNotasEverest(filters = {}) {
  // Construir query string a partir do objeto de filtros
  const params = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      params.append(key, filters[key]);
    }
  });
  const queryString = params.toString();

  const resposta = await fetch(`${API_BASE}/everest/notes${queryString ? `?${queryString}` : ''}`, {
    headers: getHeaders(false) // GET não precisa de Content-Type JSON
  });
  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao buscar notas.' }));
    throw new Error(erroData.erro || 'Erro ao buscar notas Everest');
  }
  return await resposta.json(); 
}

export async function criarNotaEverest(notaData) {
  // console.log('[API MOCK] criarNotaEverest:', notaData);
  // await mockApiDelay();
  const resposta = await fetch(`${API_BASE}/everest/notes`, {
    method: 'POST',
    headers: getHeaders(), // Usa Content-Type JSON
    body: JSON.stringify(notaData)
  });
  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao criar nota.' }));
    throw new Error(erroData.erro || 'Erro ao criar nota Everest');
  }
  return await resposta.json();
}

export async function atualizarNotaEverest(id, notaData) {
  // console.log('[API MOCK] atualizarNotaEverest, ID:', id, 'Data:', notaData);
  // await mockApiDelay();
  const resposta = await fetch(`${API_BASE}/everest/notes/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(notaData)
  });
  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao atualizar nota.' }));
    throw new Error(erroData.erro || 'Erro ao atualizar nota Everest');
  }
  return await resposta.json();
}

export async function excluirNotaEverest(id) {
  // console.log('[API MOCK] excluirNotaEverest, ID:', id);
  // await mockApiDelay(300);
  const resposta = await fetch(`${API_BASE}/everest/notes/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false) // DELETE não envia corpo, não precisa Content-Type
  });
  if (!resposta.ok) {
     const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao excluir nota.' }));
    throw new Error(erroData.erro || 'Erro ao excluir nota Everest');
  }
  // Retorna a resposta (que pode ter a mensagem) ou poderia retornar void/true
  return await resposta.json(); 
}

// --- Links Everest ---
export async function obterLinksEverest(searchTerm = '') {
  // console.log('[API MOCK] obterLinksEverest, search:', searchTerm);
  // await mockApiDelay();
  const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
  const resposta = await fetch(`${API_BASE}/everest/links${query}`, {
    headers: getHeaders(false)
  });
   if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao buscar links.' }));
    throw new Error(erroData.erro || 'Erro ao buscar links Everest');
  }
  return await resposta.json();
}

export async function criarLinkEverest(linkData) {
  // console.log('[API MOCK] criarLinkEverest:', linkData);
  // await mockApiDelay();
   const resposta = await fetch(`${API_BASE}/everest/links`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(linkData)
  });
  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao criar link.' }));
    throw new Error(erroData.erro || 'Erro ao criar link Everest');
  }
  return await resposta.json();
}

export async function atualizarLinkEverest(id, linkData) {
  // console.log('[API MOCK] atualizarLinkEverest, ID:', id, 'Data:', linkData);
  // await mockApiDelay();
   const resposta = await fetch(`${API_BASE}/everest/links/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(linkData)
  });
  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao atualizar link.' }));
    throw new Error(erroData.erro || 'Erro ao atualizar link Everest');
  }
  return await resposta.json();
}

export async function excluirLinkEverest(id) {
  // console.log('[API MOCK] excluirLinkEverest, ID:', id);
  // await mockApiDelay(300);
  const resposta = await fetch(`${API_BASE}/everest/links/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
   if (!resposta.ok) {
     const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao excluir link.' }));
    throw new Error(erroData.erro || 'Erro ao excluir link Everest');
  }
  return await resposta.json();
}

// --- Info Chamados Everest ---
export async function obterInfosChamados(searchTerm = '') {
  // console.log('[API MOCK] obterInfosChamados, search:', searchTerm);
  // await mockApiDelay();
  const query = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
  const resposta = await fetch(`${API_BASE}/everest/ticketinfo${query}`, {
    headers: getHeaders(false)
  });
   if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao buscar registros.' }));
    throw new Error(erroData.erro || 'Erro ao buscar registros de chamados');
  }
  return await resposta.json();
}

export async function criarInfoChamado(ticketData) {
  // console.log('[API MOCK] criarInfoChamado:', ticketData);
  // await mockApiDelay();
  const resposta = await fetch(`${API_BASE}/everest/ticketinfo`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(ticketData)
  });
  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao criar registro.' }));
    throw new Error(erroData.erro || 'Erro ao criar registro de chamado');
  }
  return await resposta.json();
}

export async function atualizarInfoChamado(id, ticketData) {
  // console.log('[API MOCK] atualizarInfoChamado, ID:', id, 'Data:', ticketData);
  // await mockApiDelay();
   const resposta = await fetch(`${API_BASE}/everest/ticketinfo/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(ticketData)
  });
  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao atualizar registro.' }));
    throw new Error(erroData.erro || 'Erro ao atualizar registro de chamado');
  }
  return await resposta.json();
}

export async function excluirInfoChamado(id) {
  // console.log('[API MOCK] excluirInfoChamado, ID:', id);
  // await mockApiDelay(300);
  const resposta = await fetch(`${API_BASE}/everest/ticketinfo/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false)
  });
   if (!resposta.ok) {
     const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao excluir registro.' }));
    throw new Error(erroData.erro || 'Erro ao excluir registro de chamado');
  }
  return await resposta.json();
}

// --- Ferramenta CNPJ Everest ---

export async function uploadPlanilhaCnpj(formData) {
  // Nota: Não definir Content-Type manualmente para FormData,
  // o navegador define com o boundary correto.
  const headers = getHeaders(false); // Pega o header de Authorization, mas não Content-Type JSON

  try {
    const resposta = await fetch(`${API_BASE}/everest/cnpj/upload`, {
      method: 'POST',
      headers: headers,
      body: formData
    });

    const responseData = await resposta.json();

    if (!resposta.ok) {
      // Lança um erro com a mensagem do backend, se disponível
      throw new Error(responseData.erro || `Erro no servidor: ${resposta.status}`);
    }
    return responseData; // Retorna a resposta completa do backend (com sucesso, mensagem, detalhes)

  } catch (error) {
    console.error("Erro ao fazer upload da planilha CNPJ:", error);
    // Propaga o erro para ser tratado no componente
    throw error; 
  }
}

export async function consultarCnpj(cnpj) {
  if (!cnpj) {
    throw new Error("CNPJ não pode ser vazio.");
  }
  // Encode o CNPJ para caso ele contenha caracteres especiais (embora não deva)
  const encodedCnpj = encodeURIComponent(cnpj);

  try {
    const resposta = await fetch(`${API_BASE}/everest/cnpj/query/${encodedCnpj}`, {
      method: 'GET',
      headers: getHeaders(false) // GET não precisa de Content-Type JSON
    });

    const responseData = await resposta.json();

    if (!resposta.ok) {
      // Tratar especificamente 404 como "não encontrado" e não como erro crítico?
      // Por enquanto, lançamos erro genérico para outros status.
      if (resposta.status === 404) {
          // Poderíamos retornar algo específico como { sucesso: true, dados: [] } ?
          // Por enquanto, vamos seguir o backend e esperar que ele retorne sucesso:true com dados vazios.
      }
      throw new Error(responseData.erro || `Erro na consulta: ${resposta.status}`);
    }

    // Espera-se que a resposta seja { sucesso: true, dados: [...] }
    return responseData;

  } catch (error) {
    console.error("Erro ao consultar CNPJ:", error);
    throw error; // Propaga o erro
  }
}

// --- Processador XML Everest ---
export async function processarXml(formData) {
  // console.log('[API MOCK] processarXml: FormData recebido (simulado)');
  // await mockApiDelay(1800); 
  const headers = getHeaders(false); 
  delete headers['Content-Type']; 

  const resposta = await fetch(`${API_BASE}/everest/xml/process`, {
    method: 'POST',
    headers: headers,
    body: formData
  });

  if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao processar XML.' }));
    throw new Error(erroData.erro || erroData.details || 'Erro ao enviar arquivo XML');
  }
  return await resposta.json(); // Retorna o resumo salvo
}

// Obter resumos anteriores
export async function obterSumariosXml(filters = {}) {
  // Construir query string a partir do objeto de filtros
  const params = new URLSearchParams();
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      params.append(key, filters[key]);
    }
  });
  const queryString = params.toString();

  const resposta = await fetch(`${API_BASE}/everest/xml/summaries${queryString ? `?${queryString}` : ''}`, {
    headers: getHeaders(false)
  });
   if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao buscar resumos XML.' }));
    throw new Error(erroData.erro || 'Erro ao buscar resumos XML');
  }
  return await resposta.json();
}

// Obter detalhes de um resumo específico por ID
export async function obterSumarioXmlPorId(id) {
  // console.log('[API MOCK] obterSumarioXmlPorId, ID:', id);
  // await mockApiDelay(500); // Simula um pequeno delay
  const resposta = await fetch(`${API_BASE}/everest/xml/summaries/${id}`, {
    headers: getHeaders(false)
  });
   if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao buscar detalhes do resumo XML.' }));
    // Adiciona o status code ao erro para tratamento no frontend
    const error = new Error(erroData.erro || 'Erro ao buscar detalhes do resumo XML');
    error.status = resposta.status;
    throw error;
  }
  return await resposta.json();
}

// Excluir um resumo XML específico por ID
export async function excluirSumarioXml(id) {
  // console.log('[API] excluirSumarioXml, ID:', id);
  // await mockApiDelay(400);
  const resposta = await fetch(`${API_BASE}/everest/xml/summaries/${id}`, {
    method: 'DELETE',
    headers: getHeaders(false) // DELETE não envia corpo JSON
  });
   if (!resposta.ok) {
    const erroData = await resposta.json().catch(() => ({ erro: 'Erro ao excluir o resumo XML.' }));
    const error = new Error(erroData.erro || 'Erro ao excluir o resumo XML');
    error.status = resposta.status;
    throw error;
  }
  // Normalmente DELETE retorna 204 No Content ou uma mensagem de sucesso
  // Retornamos true ou a mensagem se houver
  if (resposta.status === 204) return true;
  return await resposta.json(); 
}

// Poderia adicionar getSummaryById se necessário
