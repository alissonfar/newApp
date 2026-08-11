// src/utils/descricaoUtils.js

/**
 * Retorna o texto de descrição a ser exibido: o apelido definido pelo
 * usuário, se existir, ou a descrição original (vinda do banco/import ou
 * digitada manualmente) caso contrário.
 */
export function getDescricaoExibicao(transacao) {
  if (!transacao) return '';
  return transacao.descricaoApelido || transacao.descricao || '';
}
