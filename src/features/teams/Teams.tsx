import { useEffect, useState } from 'react';
import { routeHref } from '../../app/useRoute';
import { deleteSquad, listSessions, saveSquad } from '../../data/db';
import { newSquad, type Squad, SQUAD_COLORS, SQUAD_LIMITS } from '../../model/squad';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { IconPlus, IconTrash } from '../../ui/Icons';
import { PageHeader } from '../../ui/PageHeader';
import { useDataTools } from '../data/useDataTools';
import { useSquads } from './useSquads';
import './Teams.css';

/** Un equipo: nombre, club y color se editan aquí mismo (se guarda solo al escribir). */
function TeamCard({ squad, sessions, onDelete }: { squad: Squad; sessions: number; onDelete: () => void }) {
  // se edita una copia local y se guarda al momento: así escribir no espera a la base de datos
  const [t, setT] = useState(squad);
  useEffect(() => setT(squad), [squad]);
  const change = (patch: Partial<Squad>) => {
    const next = { ...t, ...patch, updatedAt: Date.now() };
    setT(next);
    void saveSquad(next);
  };
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
          {sessions === 1 ? '1 sesión' : `${sessions} sesiones`}
        </a>
        <button className="btn ghost icon" onClick={onDelete} aria-label={`Eliminar ${t.name}`} title="Eliminar equipo">
          <IconTrash />
        </button>
      </div>
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
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [toDelete, setToDelete] = useState<Squad | null>(null);
  const data = useDataTools({ hasData: true, onChanged: () => {} });

  useEffect(() => {
    listSessions()
      .then((l) => {
        const m = new Map<string, number>();
        for (const s of l) if (s.teamId && !s.template) m.set(s.teamId, (m.get(s.teamId) ?? 0) + 1);
        setCounts(m);
      })
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
            <TeamCard key={t.id} squad={t} sessions={counts.get(t.id) ?? 0} onDelete={() => setToDelete(t)} />
          ))}
        </ul>
        {squads && squads.length > 0 && <p className="muted small">Los cambios se guardan solos. Pronto: jugadores de cada equipo y control de asistencia.</p>}
      </main>

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
