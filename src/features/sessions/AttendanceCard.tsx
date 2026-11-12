import { routeHref } from '../../app/useRoute';
import * as S from '../../model/session';
import { type Squad, sortPlayers } from '../../model/squad';
import './Attendance.css';

/**
 * Pasar lista: cada jugador del equipo de la sesión con cuatro botones (Viene, Tarde, Falta,
 * Justificada). Pulsar la marca que ya tiene la quita. «Todos vienen» marca a los que faltan por
 * marcar, para no tener que tocar uno a uno.
 */
export function AttendanceCard({ session, squad, update }: { session: S.Session; squad: Squad; update: (fn: (s: S.Session) => S.Session) => void }) {
  const players = sortPlayers(squad.players);
  const att = session.attendance;
  const marked = players.filter((p) => att[p.id]).length;
  const coming = players.filter((p) => att[p.id] === 'present' || att[p.id] === 'late').length;

  return (
    <section className="sess-card attendance" aria-label="Asistencia">
      <div className="attendance-head">
        <h2>Asistencia</h2>
        {players.length > 0 && (
          <span className="attendance-count">
            {coming} de {players.length} vienen{marked < players.length && ` · faltan ${players.length - marked} por marcar`}
          </span>
        )}
      </div>

      {players.length === 0 ? (
        <p className="muted">
          {squad.name} aún no tiene jugadores. <a href={routeHref.teams}>Añádelos en Equipos</a> para pasar lista.
        </p>
      ) : (
        <>
          {marked < players.length && (
            <button className="btn" onClick={() => update((s) => S.markAllPresent(s, players.map((p) => p.id)))}>
              ✓ Todos vienen
            </button>
          )}
          <ul className="attendance-list">
            {players.map((p) => (
              <li key={p.id} className={`attendance-row ${att[p.id] ?? 'none'}`}>
                <span className="attendance-name">
                  {p.number && <b>{p.number}</b>} {p.name}
                </span>
                <span className="attendance-marks" role="radiogroup" aria-label={`Asistencia de ${p.name}`}>
                  {S.ATTENDANCE_MARKS.map((m) => (
                    <button key={m.id} role="radio" aria-checked={att[p.id] === m.id} className={`mark ${m.id}${att[p.id] === m.id ? ' on' : ''}`} onClick={() => update((s) => S.setAttendance(s, p.id, s.attendance[p.id] === m.id ? null : m.id))}>
                      {m.label}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
