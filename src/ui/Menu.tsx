import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconChevronDown } from './Icons';
import './Menu.css';

export interface MenuItem {
  label: string;
  hint?: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * Botón con menú desplegable. Se maneja con ratón o teclado:
 * flechas para moverse, Intro para elegir, Esc o clic fuera para cerrar.
 */
export function Menu({
  label,
  icon,
  items,
  title,
  up = false,
  iconOnly = false,
  disabled = false,
}: {
  label: string;
  icon?: ReactNode;
  items: MenuItem[];
  title?: string;
  /** Abrir hacia arriba (para menús en la parte baja de la pantalla). */
  up?: boolean;
  /** Botón de solo icono: `label` pasa a ser su nombre accesible. */
  iconOnly?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  const focusItem = (i: number) => {
    const els = root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    if (!els?.length) return;
    els[(i + els.length) % els.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(0);
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      className="menu"
      ref={root}
      onKeyDown={(e) => {
        if (!open) return;
        const els = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
        const i = els.indexOf(document.activeElement as HTMLButtonElement);
        const move: Record<string, number> = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: els.length - 1 };
        if (e.key in move) {
          e.preventDefault();
          e.stopPropagation(); // que las flechas no cambien de fotograma
          focusItem(move[e.key]);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          close();
        } else if (e.key === 'Tab') setOpen(false);
      }}
    >
      <button
        ref={button}
        className={`btn ghost${iconOnly ? ' icon' : ''}`}
        aria-haspopup="menu"
        aria-label={iconOnly ? label : undefined}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={id}
        title={title}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
      >
        {iconOnly ? icon : <>{icon} {label} <IconChevronDown /></>}
      </button>
      {open && (
        <div className={`menu-list${up ? ' up' : ''}`} role="menu" id={id} aria-label={label}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              className="menu-item"
              onClick={() => {
                close();
                it.onSelect();
              }}
            >
              {it.icon}
              <span>
                {it.label}
                {it.hint && <small>{it.hint}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
