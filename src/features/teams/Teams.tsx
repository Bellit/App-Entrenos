import { useEffect, useState } from 'react';
import { routeHref } from '../../app/useRoute';
import { deleteSquad, listSessions, saveSquad } from '../../data/db';
import { addPlayers, attendanceStats, newSquad, removePlayer, sortPlayers, type Squad, SQUAD_COLORS, SQUAD_LIMITS, updatePlayer } from '../../model/squad';
import type { Session } from '../../model/session';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { IconPlus, IconTrash } from '../../ui/Icons';
import { PageHeader } from '../../ui/PageHeader';
import { PageFooter } from '../../ui/PageFooter';
import { useDataTools } from '../data/useDataTools';
import { useSquads } from './useSquads';
import './Teams.css';

/** Un equipo: nombre, club y color se editan aquí mismo (se guarda solo al escribir). */
function TeamCard({ squad, sessions, onDelete }: { squad: Squad; sessions: Session[]; onDelete: () => void }) {
  // se edita una copia local y se guarda al momento: así escribir no espera a la base de datos
  const [t, setT] = useState(squad);
  useEffect(() => setT(squad), [squad]);
  const change = (patch: Partial<Squad>) => save({ ...t, ...patch });
  const save = (next: Squad) => {
    const stamped = { ...next, updatedAt: Date.now() };
    setT(stamped);
    void saveSquad(stamped);
  };
  const [newPlayers, setNewPlayers] = useState('');
  const count = sessions.filter((x) => x.teamId === t.id && !x.template).length;
  const stats = attendanceStats(t, sessions);
  return (
    <li className="team-card" style={{ ['--team' as string]: t.color }}>
      <div className="team-main">
        <input className="team-name" value={t.name} maxLength={SQUAD_LIMITS.name} onChange={(e) => change({ name: e.target.value })} aria-label="Nombre del equipo" placeholder="Nombre del equipo" />
        <input className="team-club" value={t.club} maxLength={SQUAD_LIMITS.club} onChange={(e) => change({ club: e.target.value })} aria-label="Club" placeholder="Club (opcional)" />
        <div className="team-colors" role="radiogroup" aria-label="Color del equipo">
          {SQUAD_COLORS.map((c) => (
            <button key={c} role="radio" aria-checked={t.color === c} aria-label={`Color ${c}`} className={`swatch${t.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => change({ color: c })} />
          ))}
        </div>
      </div>
      <div className="team-side">
        <a className="btn" href={routeHref.sessions} onClick={() => rememberFilter(t.id)}>
          {count === 1 ? '1 sesión' : `${count} sesiones`}
        </a>
        <button className="btn ghost icon" onClick={onDelete} aria-label={`Eliminar ${t.name}`} title="Eliminar equipo">
          <IconTrash />
        </button>
      </div>
      <details className="team-players">
        <summary>
          Jugadores <span className="filter-chip-count">{t.players.length}</span>
        </summary>
        {t.players.length > 0 && (
          <ul className="player-list">
            {sortPlayers(t.players).map((p) => {
              const st = stats.get(p.id);
              return (
                <li key={p.id} className="player-row">
                  <input className="player-number" value={p.number} inputMode="numeric" maxLength={SQUAD_LIMITS.number} placeholder="#" aria-label={`Dorsal de ${p.name}`} onChange={(e) => save(updatePlayer(t, p.id, { number: e.target.value.replace(/\D/g, '') }))} />
                  <input className="player-name" value={p.name} maxLength={SQUAD_LIMITS.player} aria-label="Nombre del jugador" onChange={(e) => save(updatePlayer(t, p.id, { name: e.target.value }))} />
                  <span className={`player-stat${st?.pct == null ? ' none' : st.pct >= 80 ? ' good' : st.pct >= 60 ? ' mid' : ' low'}`} title={st?.total ? `${st.present} viene · ${st.late} tarde · ${st.absent} falta · ${st.excused} justificada` : 'Aún no se ha pasado lista'}>
                    {st?.pct == null ? '—' : `${st.pct} %`}
                    {st && st.absent > 0 && <small>{st.absent === 1 ? '1 falta' : `${st.absent} faltas`}</small>}
                  </span>
                  <button className="btn ghost icon" aria-label={`Quitar a ${p.name}`} title="Quitar del equipo" onClick={() => save(removePlayer(t, p.id))}>
                    <IconTrash />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form
          className="player-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newPlayers.trim()) return;
            save(addPlayers(t, newPlayers));
            setNewPlayers('');
          }}
        >
          <textarea rows={2} value={newPlayers} onChange={(e) => setNewPlayers(e.target.value)} placeholder={'Añadir jugadores: uno por línea, con el dorsal delante si quieres\n7 Marta\n12 Pau'} aria-label="Añadir jugadores" />
          <button className="btn" type="submit" disabled={!newPlayers.trim() || t.players.length >= SQUAD_LIMITS.players}>
            <IconPlus /> Añadir
          </button>
        </form>
      </details>
    </li>
  );
}

/** Para que la lista de sesiones se abra ya filtrada por el equipo elegido aquí. */
export const TEAM_FILTER_KEY = 'entrenos.filtroEquipo';
const rememberFilter = (id: string) => {
  try {
    localStorage.setItem(TEAM_FILTER_KEY, id);
  } catch {
    /* sin almacenamiento: la lista se abre con todos */
  }
};

/** Pantalla «Equipos»: los equipos que entrenas, para organizar las sesiones. */
export function Teams() {
  const { squads } = useSquads();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [toDelete, setToDelete] = useState<Squad | null>(null);
  const data = useDataTools({ hasData: true, onChanged: () => {} });

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => {});
  }, [squads]);

  const create = data.guarded('crear el equipo', async () => {
    await saveSquad(newSquad('Equipo nuevo', '', (squads ?? []).map((s) => s.color)));
  });

  return (
    <div className="page">
      <PageHeader
        current="teams"
        actions={
          <>
            {data.menu}
            <button className="btn primary big" onClick={create}>
              <IconPlus /> Nuevo equipo
            </button>
          </>
        }
      />
      {data.fileInputEl}
      <main className="page-main">
        <div className="page-title">
          <h1>Equipos</h1>
          {squads && squads.length > 0 && <p className="muted">{squads.length === 1 ? '1 equipo' : `${squads.length} equipos`}</p>}
        </div>
        {data.notices}

        {squads?.length === 0 && (
          <section className="empty">
            <h2>Organiza tus sesiones por equipo</h2>
            <p className="muted">Si entrenas a varios equipos o en varios clubs, crea uno por cada equipo. Luego, en cada sesión eliges su equipo y en la lista ves solo las de ese equipo.</p>
            <button className="btn primary big" onClick={create}>
              <IconPlus /> Crear el primer equipo
            </button>
          </section>
        )}

        <ul className="team-list">
          {squads?.map((t) => (
            <TeamCard key={t.id} squad={t} sessions={sessions} onDelete={() => setToDelete(t)} />
          ))}
        </ul>
        {squads && squads.length > 0 && <p className="muted small">Los cambios se guardan solos. La asistencia se pasa en cada sesión del equipo (o desde el modo entreno); aquí ves el porcentaje de cada jugador.</p>}
      </main>
      <PageFooter />

      {toDelete && (
        <ConfirmDialog
          title="Eliminar equipo"
          message={<p>Se eliminará «{toDelete.name}». Sus sesiones no se borran: se quedan sin equipo.</p>}
          confirmLabel="Eliminar"
          onConfirm={() => {
            void deleteSquad(toDelete.id);
            setToDelete(null);
          }}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
