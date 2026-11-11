import { useEffect, useRef } from 'react';
import { Dialog } from './Dialog';
import './ConfirmDialog.css';

/**
 * Pregunta antes de una acción que no se puede deshacer, con el mismo estilo que el resto de la app.
 * El botón seguro (Cancelar) tiene el foco al abrir: un Intro por despiste no borra nada.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  // después de abrir el diálogo (su efecto va antes que este), el foco pasa a Cancelar
  useEffect(() => cancel.current?.focus(), []);
  return (
    <Dialog open onClose={onCancel} title={title}>
      <div className="confirm-message">{message}</div>
      <div className="row confirm-actions">
        <button ref={cancel} className="btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn confirm-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
