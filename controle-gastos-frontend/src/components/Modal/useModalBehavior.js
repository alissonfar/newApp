// src/components/Modal/useModalBehavior.js
import { useEffect } from 'react';

/**
 * Trava o scroll do body e confina o foco de Tab/Shift+Tab dentro do modal enquanto ele estiver
 * aberto. Extraído de ModalTransacao.js para reaproveitamento por qualquer modal do design system
 * (ver ADR-025).
 *
 * Requer que o elemento referenciado por `modalRef` tenha `tabIndex={-1}` (focável via script, fora
 * da ordem de Tab) — sem isso o foco nunca entra no modal ao abrir, e o focus-trap abaixo só
 * intercepta o Tab quando o elemento já focado é o primeiro/último elemento interno; como o clique
 * que abre o modal deixa o foco no botão de fora, o Tab acaba escapando (bug encontrado em revisão
 * manual, corrigido aqui).
 */
export default function useModalBehavior(modalRef) {
  useEffect(() => {
    // Trava scroll do body enquanto modal estiver aberto
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move o foco pro container do modal ao abrir, pra o focus-trap valer desde o primeiro Tab
    modalRef.current?.focus();

    const handleKeyDown = (e) => {
      // Confina Tab dentro do modal (focus trap)
      if (e.key === 'Tab') {
        if (!modalRef.current) return;

        // Encontra todos os elementos focáveis dentro do modal
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab no primeiro elemento → volta para o último
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
        // Tab no último elemento → volta para o primeiro
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [modalRef]);
}
