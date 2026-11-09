import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previously = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose) onClose();
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => !item.hasAttribute('disabled'));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previously?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop no-print">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
