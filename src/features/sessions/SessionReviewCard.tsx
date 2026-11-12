import { useEffect, useRef } from 'react';
import * as S from '../../model/session';

/** Clave para saber, al volver del modo entreno, que hay que llevar a la persona a esta tarjeta. */
export const REVIEW_FOCUS_KEY = 'entrenos.valorar';

/**
 * Después del entreno: marcarla como hecha, valorarla (1-5) y apuntar qué ha funcionado y qué
 * cambiar. Valorar o escribir ya la marca como hecha (lo hace `updateReview` en el modelo).
 */
export function SessionReviewCard({ session, update }: { session: S.Session; update: (fn: (s: S.Session) => S.Session) => void }) {
  const r = session.review;
  const notes = useRef<HTMLTextAreaElement>(null);
  const card = useRef<HTMLElement>(null);
  const set = (patch: Partial<S.SessionReview>) => update((s) => S.updateReview(s, patch));

  // viniendo de «Terminar» en el modo entreno: se baja hasta aquí y se deja listo para escribir
  useEffect(() => {
    try {
      if (sessionStorage.getItem(REVIEW_FOCUS_KEY) !== session.id) return;
      sessionStorage.removeItem(REVIEW_FOCUS_KEY);
    } catch {
      return;
    }
    card.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    notes.current?.focus({ preventScroll: true });
  }, [session.id]);

  return (
    <section ref={card} className={`sess-card review${r.done ? ' done' : ''}`} aria-label="Después del entreno">
      <div className="review-head">
        <h2>Después del entreno</h2>
        <label className="check review-done">
          <input type="checkbox" checked={r.done} onChange={(e) => set({ done: e.target.checked })} /> Hecha
        </label>
      </div>
      <div className="stars" role="radiogroup" aria-label="¿Cómo ha ido?">
        <span className="stars-label">¿Cómo ha ido?</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={r.rating === n} aria-label={`${n} de 5`} className={`star${n <= r.rating ? ' on' : ''}`} onClick={() => set({ rating: r.rating === n ? 0 : n })}>
            ★
          </button>
        ))}
      </div>
      <textarea
        ref={notes}
        rows={4}
        value={r.notes}
        maxLength={S.SESSION_LIMITS.notes}
        onChange={(e) => set({ notes: e.target.value })}
        placeholder="Qué ha funcionado, qué cambiar la próxima vez, quién ha faltado, incidencias…"
        aria-label="Notas después del entreno"
      />
    </section>
  );
}
