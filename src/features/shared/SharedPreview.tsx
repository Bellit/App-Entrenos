import { categoryName } from '../../model/exercise';
import * as S from '../../model/session';
import type { Shared } from '../../model/share';
import { NotesText } from '../training/NotesText';
import { PlayPlayer } from '../training/PlayPlayer';
import '../training/Training.css';
import './Shared.css';

/** Vista previa de algo compartido: el ejercicio (dibujo animado y explicación) o la sesión (sus bloques). */
export function SharedPreview({ shared }: { shared: Shared }) {
  if (shared.kind === 'exercise') {
    const e = shared.exercise;
    return (
      <div className="shared-exercise">
        <div className="shared-court">
          <PlayPlayer play={e.play} />
        </div>
        <div className="shared-info">
          <p className="train-kicker">
            <span className="pill">{categoryName(e.category)}</span> {e.minutes} min
          </p>
          <h2>{e.title || 'Ejercicio'}</h2>
          <NotesText text={e.notes} />
          {e.tags.length > 0 && (
            <p className="shared-tags">
              {e.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
    );
  }
  const s = shared.session;
  const total = S.totalMinutes(s);
  const names = new Map(shared.exercises.map((e) => [e.id, e.title]));
  return (
    <div className="shared-session">
      <h2>{s.title || 'Sesión'}</h2>
      <p className="muted">
        {s.blocks.length} bloques · {S.formatDuration(total)}
        {s.team ? ` · ${s.team}` : ''}
      </p>
      {s.goal && <p className="shared-goal">{s.goal}</p>}
      <ol className="shared-blocks">
        {s.blocks.map((b) => (
          <li key={b.id} className={b.kind}>
            <span>{b.kind === 'exercise' ? names.get(b.exerciseId) || b.snapshot.title : b.title}</span>
            <small>{b.minutes}'</small>
          </li>
        ))}
      </ol>
      {shared.exercises.length > 0 && <p className="muted small">Al guardarla se guardan también sus {shared.exercises.length === 1 ? 'un ejercicio' : `${shared.exercises.length} ejercicios`} en tu biblioteca.</p>}
    </div>
  );
}
