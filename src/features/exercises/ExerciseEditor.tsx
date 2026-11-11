import { useEffect, useRef, useState } from 'react';
import { routeHref } from '../../app/useRoute';
import { Board } from '../editor/Board';
import { SidePanel } from '../editor/SidePanel';
import { useShortcuts } from '../editor/shortcuts';
import { Timeline } from '../editor/Timeline';
import { Toolbar } from '../editor/Toolbar';
import { AppearanceSection } from '../appearance/Appearance';
import { useFullscreen } from '../../hooks/fullscreen';
import { useLayout } from '../../hooks/layout';
import { usePlayback } from '../../hooks/playback';
import { useActions, useStore } from '../../store';
import { IconPanel, IconPrev, IconRedo, IconUndo } from '../../ui/Icons';
import { PanelSection } from '../../ui/PanelSection';
import { PresentButton } from '../../ui/PresentButton';
import { Toast } from '../../ui/Toast';
import { ExerciseFields } from './ExerciseFields';
import { type SaveState, useExerciseDoc } from './useExerciseDoc';
import '../../app/App.css';
import './ExerciseEditor.css';
import './ExerciseEditorMobile.css';

const SAVE_TEXT: Record<SaveState, string> = { saved: 'Guardado', saving: 'Guardando…', error: 'No se pudo guardar' };

/**
 * Pantalla del editor de un ejercicio: la pizarra de ATO (herramientas, pista, fotogramas)
 * más el panel con los datos del ejercicio. En tablet y móvil el panel se pliega encima de la pista.
 */
export function ExerciseEditor({ id }: { id: string }) {
  const { status, meta, setMeta, saveState } = useExerciseDoc(id);
  usePlayback();
  useShortcuts();
  const presenting = useFullscreen();
  const { layout, landscape } = useLayout();
  const mobile = layout === 'mobile';
  const compact = layout !== 'desktop';
  const [sideOpen, setSideOpen] = useState(false);
  // si se cierra a mano, deja de abrirse sola hasta que se vuelva a abrir
  const autoOpen = useRef(true);
  const selection = useStore((s) => s.selection);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { undo, redo } = useActions();

  // en pantallas pequeñas, al seleccionar algo en la pista se abre el panel para poder editarlo;
  // en móvil, al soltar el dedo y no en mitad de un arrastre (la pista cambia de tamaño al abrirlo)
  useEffect(() => {
    if (!compact || !selection || !autoOpen.current) return;
    if (!mobile) return setSideOpen(true);
    const open = () => setSideOpen(true);
    window.addEventListener('pointerup', open, { once: true });
    return () => window.removeEventListener('pointerup', open);
  }, [compact, mobile, selection]);
  const toggleSide = () =>
    setSideOpen((o) => {
      autoOpen.current = !o;
      return !o;
    });
  const closeSide = () => {
    autoOpen.current = false;
    setSideOpen(false);
  };

  if (status === 'loading') return <p className="editor-state muted">Abriendo el ejercicio…</p>;
  if (status === 'missing' || !meta)
    return (
      <div className="editor-state" role="alert">
        <h1>No encuentro este ejercicio</h1>
        <p className="muted">Puede que se haya eliminado o que se guardara en otro dispositivo.</p>
        <a className="btn primary" href={routeHref.library}>
          Volver a la biblioteca
        </a>
      </div>
    );

  return (
    <div className={`app${mobile ? ' mobile' : ''}${mobile && landscape ? ' landscape' : ''}${presenting ? ' presenting' : ''}${compact && sideOpen ? ' side-open' : ''}`}>
      <header className="topbar">
        <a className="btn ghost back" href={routeHref.library} aria-label="Volver a la biblioteca" title="Volver a la biblioteca">
          <IconPrev /> <span className="back-text">Ejercicios</span>
        </a>
        <input className="title-input" type="text" value={meta.title} maxLength={80} onChange={(e) => setMeta({ title: e.target.value })} aria-label="Título del ejercicio" placeholder="Título del ejercicio" />
        <div className="topbar-group end">
          <span className={`save-state ${saveState}`} role="status" aria-live="polite">
            <i aria-hidden="true" /> {SAVE_TEXT[saveState]}
          </span>
          <button className="btn ghost icon" onClick={undo} disabled={!canUndo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)">
            <IconUndo />
          </button>
          <button className="btn ghost icon" onClick={redo} disabled={!canRedo} aria-label="Rehacer" title="Rehacer (Ctrl+Y)">
            <IconRedo />
          </button>
          {compact && (
            <button className={`btn ghost icon${sideOpen ? ' on' : ''}`} onClick={toggleSide} aria-expanded={sideOpen} aria-controls="panel-lateral" aria-label={sideOpen ? 'Cerrar el panel del ejercicio' : 'Abrir el panel del ejercicio'} title="Datos del ejercicio, fotograma y lo seleccionado">
              <IconPanel />
            </button>
          )}
        </div>
      </header>
      <Toolbar variant={mobile ? 'bar' : 'column'} />
      <main className="stage">
        <Board />
        <PresentButton on={presenting} />
      </main>
      <SidePanel
        head={
          <PanelSection id="ejercicio" title="Ejercicio">
            <ExerciseFields meta={meta} onChange={setMeta} />
          </PanelSection>
        }
        extra={<AppearanceSection />}
        onClose={compact ? closeSide : undefined}
      />
      <Timeline compact={mobile} />
      <Toast />
    </div>
  );
}
