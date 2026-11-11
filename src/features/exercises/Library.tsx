import { useEffect, useMemo, useState } from 'react';
import { ExerciseThumb } from './ExerciseThumb';
import { usePalette } from '../../court/theme';
import { deleteExercise, listExercises, saveExercise } from '../../data/db';
import { type Exercise, type ExerciseCategory, categoryName, duplicateExercise, EXERCISE_CATEGORIES, matchesFilters, newExercise } from '../../model/exercise';
import { navigate, routeHref } from '../../app/useRoute';
import { PageHeader } from '../../ui/PageHeader';
import { useDataTools } from '../data/useDataTools';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { IconDuplicate, IconMore, IconPlus, IconSearch, IconTrash } from '../../ui/Icons';
import { Menu } from '../../ui/Menu';
import './Library.css';

/** Biblioteca de ejercicios: buscador, filtros y tarjetas con miniatura. */
export function Library() {
  const [list, setList] = useState<Exercise[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [tag, setTag] = useState('');
  const [toDelete, setToDelete] = useState<Exercise | null>(null);
  const palette = usePalette();

  const refresh = () =>
    listExercises()
      .then(setList)
      .catch(() => setError(true));
  useEffect(() => {
    refresh();
  }, []);
  const data = useDataTools({ hasData: !!list?.length, onChanged: refresh });
  const { guarded, protect } = data;

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
  const remove = (e: Exercise) =>
    guarded('eliminar el ejercicio', async () => {
      setToDelete(null);
      await deleteExercise(e.id);
      refresh();
    })();

  return (
    <div className="page">
      <PageHeader
        current="library"
        actions={
          <>
            {data.menu}
            <button className="btn primary big" onClick={create}>
              <IconPlus /> Nuevo ejercicio
            </button>
          </>
        }
      />
      {data.fileInputEl}

      <main className="page-main">
        <div className="page-title">
          <h1>Ejercicios</h1>
          {list && list.length > 0 && <p className="muted">{list.length === 1 ? '1 ejercicio guardado' : `${list.length} ejercicios guardados`}</p>}
        </div>

        {data.notices}

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
            <button className="link" onClick={data.openImport}>
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
                  <ExerciseThumb exercise={e} />
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
