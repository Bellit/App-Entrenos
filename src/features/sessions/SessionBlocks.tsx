import { routeHref } from '../../app/useRoute';
import { categoryName, type Exercise } from '../../model/exercise';
import * as S from '../../model/session';
import { IconChevronDown, IconMore, IconTrash } from '../../ui/Icons';
import { Menu } from '../../ui/Menu';
import { ExerciseThumb } from '../exercises/ExerciseThumb';

/** Minutos de un bloque: − [ 15 ] + min. Los botones van de 5 en 5 (de 1 en 1 por debajo de 5). */
function Minutes({ value, onChange, label }: { value: number; onChange: (m: number) => void; label: string }) {
  const step = (dir: 1 | -1) => {
    if (dir < 0) return onChange(value <= 5 ? value - 1 : Math.ceil(value / 5) * 5 - 5);
    return onChange(value < 5 ? value + 1 : Math.floor(value / 5) * 5 + 5);
  };
  return (
    <div className="minutes" role="group" aria-label={`Minutos de ${label}`}>
      <button className="btn ghost icon" onClick={() => step(-1)} disabled={value <= 1} aria-label="Menos minutos">
        −
      </button>
      <input type="number" inputMode="numeric" min={1} max={S.SESSION_LIMITS.minutes} value={value} onChange={(e) => e.target.value && onChange(Number(e.target.value))} aria-label={`Minutos de ${label}`} />
      <button className="btn ghost icon" onClick={() => step(1)} disabled={value >= S.SESSION_LIMITS.minutes} aria-label="Más minutos">
        +
      </button>
      <span className="unit" aria-hidden="true">
        min
      </span>
    </div>
  );
}

/**
 * Los bloques de la sesión, en orden. A la izquierda, la hora a la que empieza cada uno (o el
 * minuto, si la sesión no tiene hora de inicio); se recalcula sola al cambiar minutos u orden.
 */
export function SessionBlocks({ session, library, update, onRemove }: { session: S.Session; library: ReadonlyMap<string, Exercise>; update: (fn: (s: S.Session) => S.Session) => void; onRemove: (block: S.SessionBlock, index: number) => void }) {
  const schedule = new Map(S.blockSchedule(session).map((x) => [x.id, x]));
  const resolved = S.resolveBlocks(session, library);
  const n = resolved.length;
  const set = (id: string, patch: Parameters<typeof S.updateBlock>[2]) => update((s) => S.updateBlock(s, id, patch));

  return (
    <ol className="blocks">
      {resolved.map(({ block: b, exercise: e, source }, i) => {
        const t = schedule.get(b.id)!;
        const name = b.kind === 'exercise' ? e?.title || 'Ejercicio' : b.title || 'Bloque';
        return (
          <li key={b.id} className={`block ${b.kind}`}>
            <div className="block-time">
              <span className="block-n">{i + 1}</span>
              <span className="block-clock">{t.clockFrom || `${t.from}'`}</span>
            </div>

            <div className="block-main">
              {b.kind === 'exercise' && e ? (
                <div className="block-exercise">
                  <a className="block-thumb" href={routeHref.exercise(b.exerciseId)} title="Abrir el ejercicio" aria-label={`Abrir el ejercicio ${name}`} tabIndex={source === 'live' ? 0 : -1} onClick={(ev) => source !== 'live' && ev.preventDefault()}>
                    <ExerciseThumb exercise={e} />
                  </a>
                  <div className="block-text">
                    <h3>{name}</h3>
                    <p className="block-meta">
                      <span className={`pill${e.category ? '' : ' none'}`}>{categoryName(e.category)}</span>
                      {source === 'snapshot' && <span className="warn">Ya no está en la biblioteca: se usa la copia guardada</span>}
                    </p>
                    <input className="block-note" value={b.note} maxLength={S.SESSION_LIMITS.blockText} onChange={(ev) => set(b.id, { note: ev.target.value })} placeholder="Nota para esta sesión (opcional)" aria-label={`Nota de ${name} para esta sesión`} />
                  </div>
                </div>
              ) : b.kind === 'text' ? (
                <div className="block-text">
                  <input className="block-title" value={b.title} maxLength={S.SESSION_LIMITS.blockTitle} onChange={(ev) => set(b.id, { title: ev.target.value })} placeholder="Título del bloque" aria-label="Título del bloque" />
                  <textarea className="block-body" rows={1} value={b.text} maxLength={S.SESSION_LIMITS.blockText} onChange={(ev) => set(b.id, { text: ev.target.value })} placeholder="Qué se hace (opcional)" aria-label={`Texto de ${name}`} />
                </div>
              ) : null}
            </div>

            <div className="block-side">
              <Minutes value={b.minutes} label={name} onChange={(m) => set(b.id, { minutes: m })} />
              <div className="block-actions">
                <button className="btn ghost icon up" onClick={() => update((s) => S.moveBlock(s, i, i - 1))} disabled={i === 0} aria-label={`Subir ${name}`} title="Subir">
                  <IconChevronDown />
                </button>
                <button className="btn ghost icon" onClick={() => update((s) => S.moveBlock(s, i, i + 1))} disabled={i === n - 1} aria-label={`Bajar ${name}`} title="Bajar">
                  <IconChevronDown />
                </button>
                <Menu
                  iconOnly
                  label={`Más acciones de ${name}`}
                  icon={<IconMore />}
                  items={[
                    { label: 'Al principio', onSelect: () => update((s) => S.moveBlock(s, i, 0)), disabled: i === 0 },
                    { label: 'Al final', onSelect: () => update((s) => S.moveBlock(s, i, n - 1)), disabled: i === n - 1 },
                    { label: 'Quitar de la sesión', icon: <IconTrash />, onSelect: () => onRemove(b, i) },
                  ]}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
