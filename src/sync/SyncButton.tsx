import { useState } from 'react';
import { IconCloud } from '../ui/Icons';
import { AccountDialog } from './AccountDialog';
import { useSync } from './sync';
import './Sync.css';

const LABEL = { off: 'Sincronizar', idle: 'Sincronizado', syncing: 'Sincronizando…', offline: 'Sin conexión', error: 'Error al sincronizar' } as const;

/** Botón de la cabecera: muestra el estado de la sincronización y abre la cuenta. */
export function SyncButton() {
  const sync = useSync();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`btn sync-btn ${sync.status}`} onClick={() => setOpen(true)} aria-label={`${LABEL[sync.status]}. Cuenta y sincronización`} title="Cuenta y sincronización">
        <IconCloud />
        <i className="sync-dot" aria-hidden="true" />
        <span className="sync-label">{LABEL[sync.status]}</span>
      </button>
      <AccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
