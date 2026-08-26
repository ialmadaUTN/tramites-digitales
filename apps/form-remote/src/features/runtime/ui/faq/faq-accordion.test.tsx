// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { FaqBlock } from '@tramites/form-contracts';
import { FaqAccordion } from './faq-accordion';

afterEach(cleanup);

const block = (overrides: Partial<FaqBlock> = {}): FaqBlock => ({
  id: 'faq-1',
  question: '¿Qué documentación necesito?',
  answer: 'El DNI y el comprobante de domicilio.',
  initiallyOpen: false,
  ...overrides,
});

describe('FaqAccordion', () => {
  it('arranca cerrado por defecto y expone aria-expanded/aria-controls consistentes', () => {
    render(<FaqAccordion block={block()} />);
    const trigger = screen.getByRole('button', { name: block().question });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel?.hasAttribute('hidden')).toBe(true);
  });

  it('respeta initiallyOpen', () => {
    render(<FaqAccordion block={block({ initiallyOpen: true })} />);
    const trigger = screen.getByRole('button', { name: block().question });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!);
    expect(panel?.hasAttribute('hidden')).toBe(false);
    expect(panel?.textContent).toContain(block().answer);
  });

  it('se abre y cierra al hacer click', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion block={block()} />);
    const trigger = screen.getByRole('button', { name: block().question });

    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('se abre y cierra por teclado (Enter y Espacio, vía foco)', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion block={block()} />);
    const trigger = screen.getByRole('button', { name: block().question });

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard(' ');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('cada instancia tiene ids propios, sin colisionar entre bloques', () => {
    render(
      <>
        <FaqAccordion block={block({ id: 'faq-1', question: 'Uno' })} />
        <FaqAccordion block={block({ id: 'faq-2', question: 'Dos' })} />
      </>,
    );
    const [first, second] = screen.getAllByRole('button');
    expect(first!.getAttribute('aria-controls')).not.toBe(second!.getAttribute('aria-controls'));
  });
});
