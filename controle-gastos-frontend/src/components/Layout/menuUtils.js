// src/components/Layout/menuUtils.js
// Utilitários para a sidebar. Mantém a lógica de "pai ativo se filho bate"
// isolada do JSX, permitindo testes unitários e reuso.

/**
 * Verifica se algum path da lista corresponde ao pathname atual.
 * Considera match exato OU match de prefixo com `/` (ex: '/patrimonio/contas'
 * casa com '/patrimonio/contas' e com '/patrimonio/contas/123', mas não com '/patrimonio').
 *
 * @param {string[]} paths - lista de paths a comparar
 * @param {string} currentPath - pathname atual
 * @returns {boolean} true se algum path bate
 */
export function isPathActive(paths, currentPath) {
  if (!paths || !Array.isArray(paths) || !currentPath) return false;
  return paths.some((p) => {
    if (!p) return false;
    return currentPath === p || currentPath.startsWith(p + '/');
  });
}

/**
 * Extrai os paths de um nó de submenu (children).
 * @param {{ items?: Array<{path: string}> }} submenuNode
 * @returns {string[]}
 */
export function getSubmenuPaths(submenuNode) {
  if (!submenuNode || !Array.isArray(submenuNode.items)) return [];
  return submenuNode.items.map((child) => child.path).filter(Boolean);
}

/**
 * Verifica se um nó de submenu deve ser destacado (algum filho ativo).
 * @param {{ items?: Array<{path: string}> }} submenuNode
 * @param {string} currentPath
 * @returns {boolean}
 */
export function isSubmenuActive(submenuNode, currentPath) {
  return isPathActive(getSubmenuPaths(submenuNode), currentPath);
}
