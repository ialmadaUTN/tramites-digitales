import { useId, useState } from 'react';
import type { FaqBlock } from '@tramites/form-contracts';

/**
 * Bloque informativo tipo FAQ: no lleva `fieldName` ni participa del
 * `Controller` de react-hook-form, porque no aporta valor al payload. El
 * `<button>` nativo ya da Enter/Espacio y foco por teclado sin código extra.
 */
export function FaqAccordion({ block }: { block: FaqBlock }) {
  const [open, setOpen] = useState(block.initiallyOpen);
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="faq-item">
      <h3 className="faq-question">
        <button
          type="button"
          id={buttonId}
          className="faq-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{block.question}</span>
          <span className="faq-icon" aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} className="faq-panel" hidden={!open}>
        <p>{block.answer}</p>
      </div>
    </div>
  );
}
