import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { readImportFile } from '../../model/importFile';
import { SceneSvg } from '../../court/Scene';
import { usePalette } from '../../court/theme';
import { deleteExercise, listExercises, saveExercise } from '../../data/db';
import { type Exercise, type ExerciseCategory, categoryName, duplicateExercise, EXERCISE_CATEGORIES, matchesFilters, newExercise } from '../../model/exercise';
import * as P from '../../model/play';
import { navigate, routeHref } from '../../app/useRoute';
import { Brand } from '../../ui/Brand';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { IconDuplicate, IconMore, IconPlus, IconSearch, IconTrash, IconUpload } from '../../ui/Icons';
import { Menu } from '../../ui/Menu';
import './Library.css';

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
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const palette = usePalette();

  const refresh = () =>
    listExercises()
      .then(setList)
      .catch(() => setError(true));
  useEffect(() => {
    refresh();
  }, []);

  const allTags = useMemo(() => [...new Set((list ?? []).flatMap((e) => e.tags))].sort(), [list]);
  const shown = (list ?? []).filter((e) => matchesFilters(e, query, category, tag));
  const countOf = (c: ExerciseCategory) => (list ?? []).filter((e) => e.category === c).length;
  const filtering = !!(query || category || tag);

  const create = async () => {
    const e = newExercise();
    await saveExercise(e);
    navigate(routeHref.exercise(e.id));
  };
  const duplicate = async (e: Exercise) => {
    await saveExercise(duplicateExercise(e));
    refresh();
  };
  /** Importa uno o varios archivos .json (jugadas de ATO, copias de ATO o ejercicios) como ejercicios nuevos. */
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
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
    if (skipped) parts.push(skipped === 1 ? 'Se ha saltado 1 jugada dañada.' : `Se han saltado ${skipped} jugadas dañadas.`);
    setImportMsg({ ok: added > 0 && problems.length === 0, text: [...parts, ...problems].join(' ') });
    refresh();
  };
  const remove = async (e: Exercise) => {
    await deleteExercise(e.id);
    setToDelete(null);
    refresh();
  };

  return (
    <div className="page">
      <header className="page-head">
        <Brand />
        <div className="head-actions">
          <button className="btn big" onClick={() => fileInput.current?.click()} title="Importar jugadas de ATO (.jugada.json) o ejercicios" aria-label="Importar jugadas o ejercicios">
            <IconUpload /> <span className="btn-text">Importar</span>
          </button>
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

        {importMsg && (
          <p className={`notice${importMsg.ok ? ' ok' : ' error'}`} role="status">
            {importMsg.text}{' '}
            <button className="link" onClick={() => setImportMsg(null)}>
              Cerrar
            </button>
          </p>
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
              Se eliminará «{toDelete.title}» de este dispositivo y no se puede deshacer. Las sesiones que lo usen perderán ese bloque.
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
