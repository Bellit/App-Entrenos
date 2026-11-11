import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { backupData, backupFileName, readImportFile } from '../../model/importFile';
import { requestPersistence, type StorageState, storageState } from '../../data/persistence';
import { download } from '../../files';
import { getItem, setItem } from '../../prefs';
import { SceneSvg } from '../../court/Scene';
import { usePalette } from '../../court/theme';
import { deleteExercise, listExercises, saveExercise } from '../../data/db';
import { type Exercise, type ExerciseCategory, categoryName, duplicateExercise, EXERCISE_CATEGORIES, matchesFilters, newExercise } from '../../model/exercise';
import * as P from '../../model/play';
import { navigate, routeHref } from '../../app/useRoute';
import { Brand } from '../../ui/Brand';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { IconDownload, IconDuplicate, IconMore, IconPlus, IconSearch, IconTrash, IconUpload } from '../../ui/Icons';
import { Menu } from '../../ui/Menu';
import './Library.css';

/** Hasta cuándo no se vuelve a mostrar el aviso de copia de seguridad (preferencia de este navegador). */
const BACKUP_LATER_KEY = 'entrenos.copia.masTarde';

/** Miniatura: el primer fotograma con sus líneas. Solo se redibuja si cambia el ejercicio. */
const Thumb = memo(
  function Thumb({ exercise }: { exercise: Exercise }) {
    const play = exercise.play;
    return <SceneSvg play={play} scene={P.frameScene(play, 0)} actions={P.drawables(play, 0)} />;
  },
  (a, b) => a.exercise.id === b.exercise.id && a.exercise.updatedAt === b.exercise.updatedAt,
);

/** Biblioteca de ejercicios: buscador, filtros y tarjetas con miniatura. */
export function Library() {
  const [list, setList] = useState<Exercise[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [tag, setTag] = useState('');
  const [toDelete, setToDelete] = useState<Exercise | null>(null);
  /** Aviso arriba de la lista: resultado de importar o un error al guardar o borrar. */
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [storage, setStorage] = useState<StorageState>('unknown');
  const [backupLater, setBackupLater] = useState(() => Number(getItem(BACKUP_LATER_KEY)) > Date.now());
  const fileInput = useRef<HTMLInputElement>(null);
  const palette = usePalette();

  const refresh = () =>
    listExercises()
      .then(setList)
      .catch(() => setError(true));
  useEffect(() => {
    refresh();
    storageState().then(setStorage);
  }, []);

  /** Ejecuta una acción de guardado; si falla, lo dice en vez de no hacer nada. */
  const guarded = (what: string, action: () => Promise<unknown>) => async () => {
    try {
      await action();
    } catch {
      setMessage({ ok: false, text: `No se ha podido ${what}. Puede que el navegador no deje guardar (modo privado o sin espacio).` });
    }
  };
  /** Al crear o importar (un clic), se pide al navegador que no borre los datos. */
  const protect = () => requestPersistence().then((ok) => ok && setStorage('persisted'));

  const downloadBackup = guarded('preparar la copia', async () => {
    const all = await listExercises();
    download(new Blob([JSON.stringify(backupData(all), null, 2)], { type: 'application/json' }), backupFileName());
    remindBackupLater();
  });
  /** «Más tarde»: el aviso de copia se oculta una semana. */
  const remindBackupLater = () => {
    setItem(BACKUP_LATER_KEY, String(Date.now() + 7 * 24 * 3600 * 1000));
    setBackupLater(true);
  };

  const allTags = useMemo(() => [...new Set((list ?? []).flatMap((e) => e.tags))].sort(), [list]);
  const shown = (list ?? []).filter((e) => matchesFilters(e, query, category, tag));
  const countOf = (c: ExerciseCategory) => (list ?? []).filter((e) => e.category === c).length;
  const filtering = !!(query || category || tag);

  const create = guarded('crear el ejercicio', async () => {
    protect();
    const e = newExercise();
    await saveExercise(e);
    navigate(routeHref.exercise(e.id));
  });
  const duplicate = (e: Exercise) =>
    guarded('duplicar el ejercicio', async () => {
      await saveExercise(duplicateExercise(e));
      refresh();
    })();
  /** Importa uno o varios archivos .json (jugadas de ATO, copias o ejercicios) como ejercicios nuevos. */
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    protect();
    let added = 0;
    let skipped = 0;
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const r = await readImportFile(file);
        for (const e of r.exercises) await saveExercise(e);
        added += r.exercises.length;
        skipped += r.skipped;
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : 'no se pudo leer.'}`);
      }
    }
    if (fileInput.current) fileInput.current.value = ''; // permite volver a elegir el mismo archivo
    const parts = [];
    if (added) parts.push(added === 1 ? 'Se ha importado 1 ejercicio.' : `Se han importado ${added} ejercicios.`);
    if (skipped) parts.push(skipped === 1 ? 'Se ha saltado 1 elemento dañado.' : `Se han saltado ${skipped} elementos dañados.`);
    setMessage({ ok: added > 0 && problems.length === 0, text: [...parts, ...problems].join(' ') });
    refresh();
  };
  const remove = (e: Exercise) =>
    guarded('eliminar el ejercicio', async () => {
      setToDelete(null);
      await deleteExercise(e.id);
      refresh();
    })();

  const showBackupNotice = storage === 'at-risk' && !backupLater && !!list && list.length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <Brand />
        <div className="head-actions">
          <Menu
            iconOnly
            label="Importar y copias de seguridad"
            title="Importar y copias de seguridad"
            icon={<IconMore />}
            items={[
              { label: 'Importar archivos…', hint: 'Jugadas de ATO, ejercicios o una copia', icon: <IconUpload />, onSelect: () => fileInput.current?.click() },
              { label: 'Descargar copia de seguridad', hint: 'Todos los ejercicios en un archivo', icon: <IconDownload />, onSelect: downloadBackup, disabled: !list?.length },
            ]}
          />
          <button className="btn primary big" onClick={create}>
            <IconPlus /> Nuevo ejercicio
          </button>
        </div>
        <input ref={fileInput} type="file" accept=".json,application/json" multiple hidden onChange={(e) => importFiles(e.target.files)} aria-label="Importar archivos" />
      </header>

      <main className="page-main">
        <div className="page-title">
          <h1>Ejercicios</h1>
          {list && list.length > 0 && <p className="muted">{list.length === 1 ? '1 ejercicio guardado' : `${list.length} ejercicios guardados`}</p>}
        </div>

        {message && (
          <p className={`notice${message.ok ? ' ok' : ' error'}`} role="status">
            {message.text}{' '}
            <button className="link" onClick={() => setMessage(null)}>
              Cerrar
            </button>
          </p>
        )}

        {showBackupNotice && (
          <div className="notice backup" role="note">
            <p>
              <strong>Tus ejercicios solo están en este navegador.</strong> Si se queda sin espacio, o en iPhone si pasas una semana sin abrir la app, podría borrarlos. Guarda una copia de vez en cuando
              (o añade la app a la pantalla de inicio).
            </p>
            <div className="notice-actions">
              <button className="btn" onClick={downloadBackup}>
                <IconDownload /> Descargar copia
              </button>
              <button className="link" onClick={remindBackupLater}>
                Más tarde
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="notice error" role="alert">
            No se han podido leer los ejercicios de este dispositivo. Prueba a recargar la página.
          </p>
        )}

        {list && list.length > 0 && (
          <div className="filters">
            <label className="search">
              <IconSearch />
              <input type="search" placeholder="Buscar por nombre, etiqueta o texto" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar ejercicios" />
            </label>
            {allTags.length > 0 && (
              <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por etiqueta">
                <option value="">Todas las etiquetas</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            <div className="chips" role="radiogroup" aria-label="Categoría">
              <button role="radio" aria-checked={category === ''} className={`filter-chip${category === '' ? ' on' : ''}`} onClick={() => setCategory('')}>
                Todos
              </button>
              {EXERCISE_CATEGORIES.filter((c) => countOf(c.id) > 0 || category === c.id).map((c) => (
                <button key={c.id} role="radio" aria-checked={category === c.id} className={`filter-chip${category === c.id ? ' on' : ''}`} onClick={() => setCategory(c.id)}>
                  {c.name} <span className="filter-chip-count">{countOf(c.id)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {list === null && !error && <p className="muted">Cargando…</p>}

        {list && list.length === 0 && (
          <section className="empty">
            <svg viewBox="0 0 200 130" aria-hidden="true">
              <rect x="6" y="6" width="188" height="118" rx="10" fill="none" stroke="currentColor" strokeWidth="2" opacity=".5" />
              <path d="M70 6v50a30 30 0 0 0 60 0V6" fill="none" stroke="currentColor" strokeWidth="2" opacity=".5" />
              <circle cx="100" cy="86" r="9" fill="var(--accent)" />
              <path d="M40 100c20-30 40-8 52-14" fill="none" stroke="var(--accent)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />
            </svg>
            <h2>Todavía no hay ejercicios</h2>
            <p className="muted">Dibuja el primero como lo harías en la ficha de papel: unos pocos fotogramas y una explicación corta.</p>
            <button className="btn primary big" onClick={create}>
              <IconPlus /> Crear el primer ejercicio
            </button>
            <button className="link" onClick={() => fileInput.current?.click()}>
              o importar jugadas de ATO
            </button>
          </section>
        )}

        {list && list.length > 0 && shown.length === 0 && (
          <p className="notice">
            Ningún ejercicio coincide con la búsqueda.{' '}
            {filtering && (
              <button className="link" onClick={() => { setQuery(''); setCategory(''); setTag(''); }}>
                Quitar filtros
              </button>
            )}
          </p>
        )}

        <ul className="grid">
          {shown.map((e) => (
            <li key={e.id} className="card">
              <a className="card-link" href={routeHref.exercise(e.id)} aria-label={`Abrir ${e.title}`}>
                <div className="thumb" style={{ ['--thumb-bg' as string]: palette.outside }}>
                  <Thumb exercise={e} />
                  <span className="badge minutes">{e.minutes}'</span>
                  {e.play.frames.length > 1 && <span className="badge frames">{e.play.frames.length} fotogramas</span>}
                </div>
                <div className="card-body">
                  <h2>{e.title || 'Sin título'}</h2>
                  <p className="meta">
                    <span className={`pill${e.category ? '' : ' none'}`}>{categoryName(e.category)}</span>
                    {e.tags.slice(0, 3).map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                    {e.tags.length > 3 && <span className="tag more">+{e.tags.length - 3}</span>}
                  </p>
                </div>
              </a>
              <div className="card-menu">
                <Menu
                  iconOnly
                  label={`Más acciones de ${e.title}`}
                  icon={<IconMore />}
                  items={[
                    { label: 'Duplicar', hint: 'Crear una variante', icon: <IconDuplicate />, onSelect: () => duplicate(e) },
                    { label: 'Eliminar', icon: <IconTrash />, onSelect: () => setToDelete(e) },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      </main>

      {toDelete && (
        <ConfirmDialog
          title="Eliminar ejercicio"
          message={
            <p>
              Se eliminará «{toDelete.title}» de este dispositivo y no se puede deshacer.
            </p>
          }
          confirmLabel="Eliminar"
          onConfirm={() => remove(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
