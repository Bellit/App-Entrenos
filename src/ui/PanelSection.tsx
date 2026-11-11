import { usePersistentState } from '../prefs';

/** Sección plegable del panel lateral. Recuerda en este navegador si la dejaste abierta o cerrada. */
export function PanelSection({ id, title, defaultOpen = true, children }: { id: string; title: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  // antes se guardaba '1' / '0'; ahora true / false
  const [open, setOpen] = usePersistentState(`entrenos.panel.${id}`, defaultOpen, (v) => v === true || v === 1);
  return (
    <details className="panel" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <h2>{title}</h2>
      </summary>
      <div className="panel-body">{children}</div>
    </details>
  );
}
