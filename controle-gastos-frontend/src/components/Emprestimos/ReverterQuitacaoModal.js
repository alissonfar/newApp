import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { reverterQuitacaoEmprestimo } from '../../api';

/**
 * Modal de confirmação para reverter a quitação de um Empréstimo.
 *
 * Comportamento:
 *  - Explica o que vai acontecer (3 itens)
 *  - Pede confirmação (botão vermelho destrutivo)
 *  - Chama POST /api/emprestimos/:id/reverter-quitacao
 *  - Toast de sucesso/erro
 *  - Chama onConfirmado() se callback foi passado (refetch na tela pai)
 *
 * @param {Object} params
 * @param {Object} params.emprestimo - objeto Emprestimo (precisa de _id, pessoaNomeSnapshot, status)
 * @param {Object} [params.transacaoJurosAuto] - TX de juros auto atual (pra mostrar valor que será removido)
 * @param {Function} [params.onConfirmado] - callback chamado após sucesso
 */
export async function abrirModalReverterQuitacao({ emprestimo, transacaoJurosAuto, onConfirmado }) {
  if (!emprestimo || emprestimo.status !== 'quitado') return;

  const valorErrado = transacaoJurosAuto?.valor;
  const valorErradoTexto = valorErrado != null
    ? `R$ ${Number(valorErrado).toFixed(2).replace('.', ',')}`
    : 'valor atual';
  const pessoaNome = emprestimo.pessoaNomeSnapshot || 'a pessoa';

  const resultado = await Swal.fire({
    title: 'Recalcular juros do empréstimo?',
    html: `
      <div style="text-align: left;">
        <p>O sistema vai:</p>
        <ul style="margin: 0.5em 0; padding-left: 1.5em;">
          <li>Remover a transação de juros automáticos atual (${valorErradoTexto})</li>
          <li>Recalcular com os lançamentos vigentes de <strong>${pessoaNome}</strong></li>
          <li>Recriar a transação de juros com o valor correto (se ainda houver lucro)</li>
        </ul>
        <p style="color: var(--cg-color-warning); margin-top: 1em;">
          Se o empréstimo não estiver mais quitado, a transação de juros não é recriada.
        </p>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Recalcular',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: 'var(--cg-color-error)',
    cancelButtonColor: 'var(--cg-color-text-secondary)',
    reverseButtons: true,
    showLoaderOnConfirm: true,
    preConfirm: async () => {
      try {
        const resultado = await reverterQuitacaoEmprestimo(emprestimo._id);
        return resultado;
      } catch (error) {
        Swal.showValidationMessage(
          error.message || 'Erro ao reverter quitação.'
        );
        return false;
      }
    },
    allowOutsideClick: () => !Swal.isLoading()
  });

  if (resultado.isConfirmed && resultado.value) {
    const novoLucro = resultado.value?.lucro ?? 0;
    toast.success(
      `Juros recalculados. Nova TX de juros com R$ ${novoLucro.toFixed(2).replace('.', ',')}.`
    );
    if (typeof onConfirmado === 'function') {
      onConfirmado(resultado.value);
    }
  }
}
