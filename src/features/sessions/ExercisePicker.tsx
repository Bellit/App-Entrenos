import { useMemo, useState } from 'react';
import { routeHref } from '../../app/useRoute';
import { categoryName, EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory, matchesFilters } from '../../model/exercise';
import { IconPlus, IconSearch } from '../../ui/Icons';
import { ExerciseThumb } from '../exercises/ExerciseThumb';

/** Bloques de texto libre más habituales, con sus minutos por defecto. */
export const TEXT_PRESETS = [
  { title: 'Charla', minutes: 5 },
  { title: 'Agua', minutes: 3 },
  { title: 'Movilidad', minutes: 10 },
  { title: 'Estiramientos', minutes: 10 },
  { title: 'Partido', minutes: 20 },
];

/**
 * Para añadir bloques a la sesión: los ejercicios de la biblioteca (buscador y categorías) y los
 * bloques de texto libre. Se pueden añadir varios seguidos; cada ejercicio muestra cuántas veces
 * está ya en la sesión.
 */
export function ExercisePicker({
  exercises,
  inSession,
  onAddExercise,
  onAddText,
  onClose,
}: {
  exercises: Exercise[];
  /** Veces que cada ejercicio (por id) está ya en la sesión. */
  inSession: Map<string, number>;
  onAddExercise: (e: Exercise) => void;
  onAddText: (title: string, minutes: number) => void;
  /** Solo en móvil, donde el selector ocupa toda la pantalla. */
  onClose?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const used = useMemo(() => EXERCISE_CATEGORIES.filter((c) => exercises.some((e) => e.category === c.id)), [exercises]);
  const shown = exercises.filter((e) => matchesFilters(e, query, category, ''));

  return (
    <div className="picker">
      <div className="picker-head">
        <h2>Añadir a la sesión</h2>
        {onClose && (
          <button className="btn primary" onClick={onClose}>
            Listo
          </button>
        )}
      </div>

      <section className="picker-section" aria-label="Bloque libre">
        <h3>Bloque libre</h3>
        <div className="picker-presets">
          {TEXT_PRESETS.map((p) => (
            <button key={p.title} className="preset" onClick={() => onAddText(p.title, p.minutes)}>
              <IconPlus /> {p.title} <small>{p.minutes}'</small>
            </button>
          ))}
          <button className="preset blank" onClick={() => onAddText('Bloque', 10)}>
            <IconPlus /> En blanco
          </button>
        </div>
      </section>

      <section className="picker-section grow" aria-label="Ejercicios de la biblioteca">
        <h3>Ejercicios</h3>
        {exercises.length === 0 ? (
          <p className="muted">
            Aún no hay ejercicios en la biblioteca. <a href={routeHref.library}>Crea el primero</a> y vuelve aquí.
          </p>
        ) : (
          <>
            <label className="search">
              <IconSearch />
              <input type="search" placeholder="Buscar ejercicio" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar ejercicio" />
            </label>
            {used.length > 1 && (
              <div className="chips" role="radiogroup" aria-label="Categoría">
                <button role="radio" aria-checked={category === ''} className={`filter-chip${category === '' ? ' on' : ''}`} onClick={() => setCategory('')}>
                  Todos
                </button>
                {used.map((c) => (
                  <button key={c.id} role="radio" aria-checked={category === c.id} className={`filter-chip${category === c.id ? ' on' : ''}`} onClick={() => setCategory(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {shown.length === 0 && <p className="muted">Ningún ejercicio coincide.</p>}
            <ul className="picker-list">
              {shown.map((e) => {
                const n = inSession.get(e.id) ?? 0;
                return (
                  <li key={e.id}>
                    <button className="pick" onClick={() => onAddExercise(e)} aria-label={`Añadir ${e.title} (${e.minutes} minutos)`}>
                      <span className="pick-thumb">
                        <ExerciseThumb exercise={e} />
                      </span>
                      <span className="pick-text">
                        <strong>{e.title || 'Sin título'}</strong>
                        <small>
                          {categoryName(e.category)} · {e.minutes}'{n > 0 && <em> · ya está {n === 1 ? '1 vez' : `${n} veces`}</em>}
                        </small>
                      </span>
                      <span className="pick-add" aria-hidden="true">
                        <IconPlus />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
