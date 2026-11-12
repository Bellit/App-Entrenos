import { useEffect, useMemo, useState } from 'react';
import { navigate, routeHref } from '../../app/useRoute';
import { deleteSession, listExercises, listSessions, saveSession, onRemoteChange } from '../../data/db';
import { categoryName } from '../../model/exercise';
import * as S from '../../model/session';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { IconDuplicate, IconFile, IconMore, IconPlay, IconPlus, IconShare, IconTrash } from '../../ui/Icons';
import { Dialog } from '../../ui/Dialog';
import { sessionPayload } from '../../model/share';
import { ShareDialog } from '../../sync/ShareDialog';
import { Menu } from '../../ui/Menu';
import { PageHeader } from '../../ui/PageHeader';
import { useDataTools } from '../data/useDataTools';
import './SessionList.css';

/** Una sesión en la lista: la fecha bien visible a la izquierda, y título, horario y bloques. */
function SessionCard({ s, today, onDuplicate, onDelete, onShare, onTemplate, onUse }: { s: S.Session; today: string; onDuplicate: () => void; onDelete: () => void; onShare: () => void; onTemplate: () => void; onUse: () => void }) {
  const d = S.dateParts(s.date);
  const total = S.totalMinutes(s);
  const end = S.endTime(s);
  const isToday = s.date === today;
  return (
    <li className={`session-card${isToday && !s.template ? ' today' : ''}${s.template ? ' template' : ''}`}>
      <a className="session-link" href={routeHref.session(s.id)} aria-label={`Abrir ${s.title}${d ? `, ${d.long}` : ''}`}>
        <div className={`session-date${d ? '' : ' none'}`} aria-hidden="true">
          {s.template ? (
            <span className="wd">plantilla</span>
          ) : d ? (
            <>
              <span className="wd">{isToday ? 'hoy' : d.weekday}</span>
              <span className="dd">{d.day}</span>
              <span className="mm">{d.month}</span>
            </>
          ) : (
            <span className="wd">sin fecha</span>
          )}
        </div>
        <div className="session-body">
          <h3>{s.title || 'Sin título'}</h3>
          <p className="session-meta">
            {s.team && <span>{s.team}</span>}
            {s.startTime && <span>{end ? `${s.startTime}–${end}` : s.startTime}</span>}
            <span>{total ? S.formatDuration(total) : 'Sin bloques'}</span>
            {s.blocks.length > 0 && <span>{s.blocks.length === 1 ? '1 bloque' : `${s.blocks.length} bloques`}</span>}
            {s.review.done && (
              <span className="session-done">
                ✓ Hecha{s.review.rating > 0 && <span className="session-stars" aria-label={`${s.review.rating} de 5`}>{' ' + '★'.repeat(s.review.rating)}</span>}
              </span>
            )}
          </p>
          {s.goal && <p className="session-goal">{s.goal}</p>}
          {s.blocks.length > 0 && (
            <ol className="session-blocks" aria-label="Bloques">
              {s.blocks.slice(0, 5).map((b) => (
                <li key={b.id} className={b.kind}>
                  {b.kind === 'exercise' ? b.snapshot.title || categoryName(b.snapshot.category) : b.title}
                  <small>{b.minutes}'</small>
                </li>
              ))}
              {s.blocks.length > 5 && <li className="more">+{s.blocks.length - 5}</li>}
            </ol>
          )}
        </div>
      </a>
      <div className="session-menu">
        <Menu
          iconOnly
          label={`Más acciones de ${s.title}`}
          icon={<IconMore />}
          items={[
            ...(s.template ? [{ label: 'Usar plantilla', hint: 'Crear una sesión para hoy con ella', icon: <IconPlus />, onSelect: onUse }] : []),
            ...(s.blocks.length && !s.template ? [{ label: 'Entrenar', hint: 'Seguirla pantalla a pantalla', icon: <IconPlay />, onSelect: () => navigate(routeHref.training(s.id)) }] : []),
            { label: 'Compartir', hint: 'Por WhatsApp o con otro entrenador', icon: <IconShare />, onSelect: onShare },
            ...(!s.template ? [{ label: 'Guardar como plantilla', hint: 'Para crear sesiones parecidas', icon: <IconFile />, onSelect: onTemplate }] : []),
            { label: 'Duplicar', hint: 'Misma estructura, sin fecha', icon: <IconDuplicate />, onSelect: onDuplicate },
            { label: 'Eliminar', icon: <IconTrash />, onSelect: onDelete },
          ]}
        />
      </div>
    </li>
  );
}

/** Portada: lista de sesiones agrupadas en próximas, sin fecha y pasadas. */
export function SessionList() {
  const [list, setList] = useState<S.Session[] | null>(null);
  const [exerciseCount, setExerciseCount] = useState(0);
  const [error, setError] = useState(false);
  const [toDelete, setToDelete] = useState<S.Session | null>(null);
  const [toShare, setToShare] = useState<S.Session | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [notice, setNotice] = useState('');
  const today = S.todayISO();

  const refresh = () => {
    listSessions()
      .then(setList)
      .catch(() => setError(true));
    listExercises()
      .then((l) => setExerciseCount(l.length))
      .catch(() => {});
  };
  useEffect(() => {
    refresh();
    // cuando llegan cambios de la nube (otro dispositivo), se vuelve a leer la lista
    return onRemoteChange(refresh);
  }, []);
  const data = useDataTools({ hasData: !!list?.length || exerciseCount > 0, onChanged: refresh });
  const { guarded, protect } = data;

  const groups = useMemo(() => S.groupSessions(list ?? [], today), [list, today]);

  /** Nueva sesión: en blanco o, si se elige, a partir de una plantilla. */
  const createFrom = (template: S.Session | null) =>
    guarded('crear la sesión', async () => {
      protect();
      setChoosing(false);
      const s = template ? S.fromTemplate(template, today) : S.newSession('Sesión nueva', today);
      await saveSession(s);
      navigate(routeHref.session(s.id));
    })();
  // con plantillas, primero se elige cómo empezar; sin ellas, directamente en blanco
  const create = () => (groups.templates.length ? setChoosing(true) : createFrom(null));
  const saveTemplate = (s: S.Session) =>
    guarded('guardar la plantilla', async () => {
      await saveSession(S.toTemplate(s));
      setNotice(`«${s.title}» guardada como plantilla. La tienes abajo, en «Plantillas».`);
      refresh();
    })();
  const duplicate = (s: S.Session) =>
    guarded('duplicar la sesión', async () => {
      await saveSession(S.duplicateSession(s));
      refresh();
    })();
  const remove = (s: S.Session) =>
    guarded('eliminar la sesión', async () => {
      setToDelete(null);
      await deleteSession(s.id);
      refresh();
    })();

  const section = (title: string, items: S.Session[]) =>
    items.length > 0 && (
      <section className="session-group" aria-label={title}>
        <h2>
          {title} <span className="count">{items.length}</span>
        </h2>
        <ul className="session-cards">
          {items.map((s) => (
            <SessionCard key={s.id} s={s} today={today} onDuplicate={() => duplicate(s)} onDelete={() => setToDelete(s)} onShare={() => setToShare(s)} onTemplate={() => saveTemplate(s)} onUse={() => createFrom(s)} />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="page">
      <PageHeader
        current="sessions"
        actions={
          <>
            {data.menu}
            <button className="btn primary big" onClick={create}>
              <IconPlus /> Nueva sesión
            </button>
          </>
        }
      />
      {data.fileInputEl}

      <main className="page-main">
        <div className="page-title">
          <h1>Sesiones</h1>
          {list && list.length > 0 && (
            <p className="muted">
              {(() => {
                const n = list.length - groups.templates.length;
                return n === 1 ? '1 sesión' : `${n} sesiones`;
              })()}
              {groups.templates.length > 0 && ` · ${groups.templates.length === 1 ? '1 plantilla' : `${groups.templates.length} plantillas`}`}
            </p>
          )}
        </div>

        {data.notices}
        {notice && (
          <p className="notice ok" role="status">
            {notice}{' '}
            <button className="link" onClick={() => setNotice('')}>
              Cerrar
            </button>
          </p>
        )}

        {error && (
          <p className="notice error" role="alert">
            No se han podido leer las sesiones de este dispositivo. Prueba a recargar la página.
          </p>
        )}
        {list === null && !error && <p className="muted">Cargando…</p>}

        {list && list.length === 0 && (
          <section className="empty">
            <svg viewBox="0 0 200 130" aria-hidden="true">
              <rect x="30" y="14" width="140" height="104" rx="10" fill="none" stroke="currentColor" strokeWidth="2" opacity=".5" />
              <path d="M30 40h140" stroke="currentColor" strokeWidth="2" opacity=".5" />
              <path d="M62 8v14M138 8v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".5" />
              <path d="M48 60h60M48 78h82M48 96h44" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity=".35" />
              <circle cx="146" cy="94" r="10" fill="var(--accent)" />
            </svg>
            <h2>Todavía no hay sesiones</h2>
            <p className="muted">
              Una sesión es el plan de un entreno: los ejercicios en orden y los minutos de cada uno. Luego la sigues en el móvil, pantalla a pantalla.
            </p>
            <button className="btn primary big" onClick={create}>
              <IconPlus /> Crear la primera sesión
            </button>
            {exerciseCount === 0 && (
              <p className="muted small">
                Aún no tienes ejercicios. <a href={routeHref.library}>Empieza por crear algunos</a> o impórtalos de ATO.
              </p>
            )}
          </section>
        )}

        {section('Próximas', groups.upcoming)}
        {section('Sin fecha', groups.undated)}
        {section('Pasadas', groups.past)}
        {section('Plantillas', groups.templates)}
      </main>

      <ShareDialog
        open={!!toShare}
        onClose={() => setToShare(null)}
        what="Sesión"
        build={async () => sessionPayload(toShare!, new Map((await listExercises()).map((e) => [e.id, e])))}
      />

      <Dialog open={choosing} onClose={() => setChoosing(false)} title="Nueva sesión">
        <div className="new-session">
          <button className="btn big primary" onClick={() => createFrom(null)}>
            <IconPlus /> En blanco
          </button>
          <p className="muted">O a partir de una plantilla:</p>
          <ul>
            {groups.templates.map((t) => (
              <li key={t.id}>
                <button className="template-pick" onClick={() => createFrom(t)}>
                  <strong>{t.title || 'Plantilla'}</strong>
                  <small>
                    {t.blocks.length} bloques · {S.formatDuration(S.totalMinutes(t))}
                    {t.team ? ` · ${t.team}` : ''}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Dialog>

      {toDelete && (
        <ConfirmDialog
          title="Eliminar sesión"
          message={<p>Se eliminará «{toDelete.title}» de este dispositivo y no se puede deshacer. Los ejercicios que usa no se borran.</p>}
          confirmLabel="Eliminar"
          onConfirm={() => remove(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
