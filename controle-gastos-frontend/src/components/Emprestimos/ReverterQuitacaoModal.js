// ReverterQuitacaoModal.js
// DESCONTINUADO em 2026-10-03 (Task 6 do plano "Empréstimos: quitação manual").
// A reversão automática de quitação foi substituída pelo fluxo manual:
//   - POST /emprestimos/:id/quitar    (novo) → marca quitado e cria TX de lucro
//   - POST /emprestimos/:id/reabrir   (novo) → volta a ativo e remove a TX de lucro
// O modal antigo (que chamava /reverter-quitacao + recriava juros) saiu de cena.
// A confirmação agora é feita diretamente no EmprestimoDetalhePage com Swal.
// Este stub fica para preservar o histórico git; Alisson pode deletar quando quiser.
export {};