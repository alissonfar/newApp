import { toast } from 'react-toastify';
import { FaExclamationTriangle } from 'react-icons/fa';
import '../components/shared/ConfirmacaoToast.css';

/**
 * Hook que retorna função de confirmação via toast (reutiliza padrão de GerenciamentoImportacoesPage/DetalhesImportacaoPage)
 * @returns {function} mostrarConfirmacao(mensagem, tipo) - mensagem: JSX ou string, tipo: 'excluir' | 'finalizar' | 'estornar' | 'cancelar'
 */
export function useConfirmacao() {
  const mostrarConfirmacao = (mensagem, tipo = 'excluir') => {
    return new Promise((resolve) => {
      const toastId = toast.warn(
        <div className="confirmacao-toast-content">
          <div className="titulo">
            <FaExclamationTriangle />
            <span>Confirmação Necessária</span>
          </div>
          <div className="mensagem">{mensagem}</div>
          <div className="acoes">
            <button
              type="button"
              onClick={() => {
                toast.dismiss(toastId);
                resolve(false);
              }}
              className="btn-cancelar"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(toastId);
                resolve(true);
              }}
              className={`btn-confirmar ${tipo}`}
            >
              Confirmar
            </button>
          </div>
        </div>,
        {
          position: 'top-center',
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          closeButton: false,
          className: 'confirmacao-toast',
        }
      );
    });
  };

  return { mostrarConfirmacao };
}
