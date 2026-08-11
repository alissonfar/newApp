/**
 * Filtra categorias para telas de lançamento: mantém as com
 * mostrarNoLancamento !== false, mais qualquer categoria cujo id esteja
 * em `categoriasJaSelecionadas` (edição não perde a categoria já em uso,
 * mesmo que tenha sido ocultada depois).
 */
export function filtrarCategoriasParaLancamento(categorias, categoriasJaSelecionadas = []) {
  const selecionadasSet = new Set(categoriasJaSelecionadas.map(String));
  return (categorias || []).filter(
    cat => cat.mostrarNoLancamento !== false || selecionadasSet.has(String(cat._id))
  );
}

/**
 * Filtra tags para telas de lançamento: mantém as com
 * mostrarNoLancamento !== false E cuja categoria também está visível
 * (via `categoriasVisiveis`, já filtradas), mais qualquer tag cujo id
 * esteja em `tagsJaSelecionadas`.
 */
export function filtrarTagsParaLancamento(tags, categoriasVisiveis, tagsJaSelecionadas = []) {
  const categoriasVisiveisSet = new Set((categoriasVisiveis || []).map(c => String(c._id)));
  const selecionadasSet = new Set(tagsJaSelecionadas.map(String));
  return (tags || []).filter(tag => {
    if (selecionadasSet.has(String(tag._id))) return true;
    if (tag.mostrarNoLancamento === false) return false;
    return categoriasVisiveisSet.has(String(tag.categoria));
  });
}
