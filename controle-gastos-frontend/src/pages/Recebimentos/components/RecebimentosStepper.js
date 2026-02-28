import React from 'react';
import { FaCheck } from 'react-icons/fa';
import './RecebimentosStepper.css';

const STEPS = [
  { id: 0, label: 'Configuração' },
  { id: 1, label: 'Filtro' },
  { id: 2, label: 'Seleção de Transações' },
  { id: 3, label: 'Resumo e Confirmação' },
];

const RecebimentosStepper = ({ activeStep, onStepClick }) => (
  <nav className="recebimentos-stepper" role="tablist" aria-label="Etapas da conciliação">
    {STEPS.map((step, index) => {
      const isActive = activeStep === step.id;
      const isCompleted = activeStep > step.id;

      return (
        <React.Fragment key={step.id}>
          <button
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? 'step' : undefined}
            className={`recebimentos-stepper__step ${isActive ? 'recebimentos-stepper__step--active' : ''} ${isCompleted ? 'recebimentos-stepper__step--completed' : ''}`}
            onClick={() => onStepClick(step.id)}
          >
            <span className="recebimentos-stepper__indicator">
              {isCompleted ? <FaCheck size={12} /> : step.id + 1}
            </span>
            <span className="recebimentos-stepper__label">{step.label}</span>
          </button>
          {index < STEPS.length - 1 && (
            <div
              className={`recebimentos-stepper__separator ${isCompleted ? 'recebimentos-stepper__separator--completed' : ''}`}
              aria-hidden
            />
          )}
        </React.Fragment>
      );
    })}
  </nav>
);

export default RecebimentosStepper;
