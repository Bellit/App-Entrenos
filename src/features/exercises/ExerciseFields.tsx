import { useState } from 'react';
import { addTag, EXERCISE_CATEGORIES, EXERCISE_LIMITS, type ExerciseCategory, NOTES_TEMPLATES } from '../../model/exercise';
import type { Meta } from './useExerciseDoc';
import './ExerciseFields.css';

/** Datos del ejercicio que no son dibujo: título, categoría, minutos, etiquetas y explicación. */
export function ExerciseFields({ meta, onChange }: { meta: Meta; onChange: (patch: Partial<Meta>) => void }) {
  const [tagDraft, setTagDraft] = useState('');

  const commitTag = () => {
    if (tagDraft.trim()) onChange({ tags: addTag(meta.tags, tagDraft) });
    setTagDraft('');
  };

  const applyTemplate = (text: string) => {
    // no se pisa lo que ya está escrito: la plantilla se añade al final
    onChange({ notes: meta.notes.trim() ? `${meta.notes.replace(/\s+$/, '')}\n\n${text}` : text });
  };

  return (
    <div className="ex-fields">
      <label className="field">
        <span>Título</span>
        <input type="text" value={meta.title} maxLength={EXERCISE_LIMITS.title} placeholder="Ej.: 3c3 con bloqueos indirectos" onChange={(e) => onChange({ title: e.target.value })} />
      </label>

      <div className="ex-row">
        <label className="field">
          <span>Categoría</span>
          <select value={meta.category} onChange={(e) => onChange({ category: e.target.value as ExerciseCategory | '' })}>
            <option value="">Sin categoría</option>
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field minutes">
          <span>Minutos</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={EXERCISE_LIMITS.minutes}
            value={meta.minutes}
            onChange={(e) => onChange({ minutes: Math.min(EXERCISE_LIMITS.minutes, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
          />
        </label>
      </div>

      <div className="field">
        <span id="tags-label">Etiquetas</span>
        <ul className="tag-list" aria-labelledby="tags-label">
          {meta.tags.map((t) => (
            <li key={t}>
              {t}
              <button type="button" aria-label={`Quitar la etiqueta ${t}`} onClick={() => onChange({ tags: meta.tags.filter((x) => x !== t) })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <input
          type="text"
          value={tagDraft}
          maxLength={EXERCISE_LIMITS.tag}
          placeholder={meta.tags.length >= EXERCISE_LIMITS.tags ? 'Máximo de etiquetas' : 'Escribe y pulsa Intro'}
          disabled={meta.tags.length >= EXERCISE_LIMITS.tags}
          aria-labelledby="tags-label"
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              commitTag();
            }
          }}
          onBlur={commitTag}
        />
      </div>

      <div className="field">
        <span>
          Explicación
          <span className="templates">
            {NOTES_TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="link-btn" onClick={() => applyTemplate(t.text)} title={`Añadir la plantilla ${t.name.toLowerCase()}`}>
                + {t.name}
              </button>
            ))}
          </span>
        </span>
        <textarea
          rows={9}
          maxLength={EXERCISE_LIMITS.notes}
          value={meta.notes}
          placeholder="Cómo se organiza, qué hay que hacer y en qué fijarse. Puedes usar «- » para hacer listas."
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
