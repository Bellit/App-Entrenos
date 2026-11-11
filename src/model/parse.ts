/** Validación de jugadas leídas de fuera (navegador, carpeta o archivo importado). */
import { DEFAULT_DURATION, LABEL_MAX, LIMITS, uid } from './common';
import { sanitizeFrame } from './edit';
import type { Action, Frame, Play, Player, Pt } from './types';
import { isCategory, isMove, isTeam } from './types';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (v: unknown): v is Pt => isObj(v) && isNum(v.x) && isNum(v.y);
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback);

/** Límites para que un archivo malicioso o roto no bloquee la app ni llene el almacenamiento. */

/**
 * Un id válido: letras, números, guion o guion bajo, sin nombres especiales de JavaScript
 * (como `__proto__`), que se usan como claves de objetos.
 */
export const isSafeId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) && !(v in Object.prototype);

/** Margen para relojes un poco adelantados entre ordenadores. */
const CLOCK_SKEW = 60 * 60 * 1000;
/**
 * Fecha válida: una fecha futura (reloj mal puesto o archivo manipulado) ganaría siempre
 * al sincronizar, así que se trata como la más antigua posible (0).
 */
export const safeTime = (v: unknown, now = Date.now()): number => (isNum(v) && v > 0 && v <= now + CLOCK_SKEW ? v : 0);

/**
 * Valida una jugada leída de un archivo o del navegador y repara lo que se puede
 * (acciones rotas, balón de un jugador que no existe…). Si no se puede usar, lanza un error.
 * Devuelve siempre una copia nueva, nunca el objeto recibido.
 */
export function parsePlay(data: unknown): Play {
  const bad = (why: string) => new Error(`El fichero no es una jugada válida (${why}).`);
  if (!isObj(data) || data.version !== 1) throw bad('formato desconocido');
  if (data.court !== 'half' && data.court !== 'full') throw bad('tipo de pista desconocido');
  if (data.id !== undefined && !isSafeId(data.id)) throw bad('identificador no válido');
  if (!Array.isArray(data.players) || !Array.isArray(data.frames) || !data.frames.length) throw bad('faltan jugadores o fotogramas');
  if (data.frames.length > LIMITS.frames) throw bad(`tiene más de ${LIMITS.frames} fotogramas`);
  if (data.players.length > LIMITS.players) throw bad(`tiene más de ${LIMITS.players} jugadores`);

  const players: Player[] = [];
  const seen = new Set<string>();
  for (const raw of data.players) {
    if (!isObj(raw) || !isSafeId(raw.id) || seen.has(raw.id)) continue;
    seen.add(raw.id);
    players.push({ id: raw.id, team: isTeam(raw.team) ? raw.team : 'O', label: typeof raw.label === 'string' ? raw.label.slice(0, LABEL_MAX) : '' });
  }
  const ids = new Set(players.map((p) => p.id));

  const frames: Frame[] = data.frames.map((raw, k) => {
    if (!isObj(raw) || !isObj(raw.positions)) throw bad(`fotograma ${k + 1} sin posiciones`);
    const positions: Record<string, Pt> = {};
    for (const [id, pos] of Object.entries(raw.positions)) if (ids.has(id) && isPt(pos)) positions[id] = { x: pos.x, y: pos.y };

    const rb = isObj(raw.ball) ? raw.ball : {};
    const holder = typeof rb.holder === 'string' && positions[rb.holder] ? rb.holder : null;
    const pos = isPt(rb.pos) ? { x: rb.pos.x, y: rb.pos.y } : holder ? positions[holder] : null;
    if (!pos) throw bad(`fotograma ${k + 1} sin balón`);

    const actions: Action[] = [];
    for (const a of Array.isArray(raw.actions) ? raw.actions : []) {
      if (!isObj(a)) continue;
      const id = str(a.id, uid());
      if ((a.type === 'move' || a.type === 'dribble' || a.type === 'screen') && typeof a.playerId === 'string' && Array.isArray(a.points)) {
        if (a.points.length > LIMITS.points) throw bad(`fotograma ${k + 1} con una trayectoria demasiado larga`);
        const points = a.points.filter(isPt).map((p) => ({ x: p.x, y: p.y }));
        if (points.length >= 2) actions.push({ id, type: a.type, playerId: a.playerId, points });
      } else if (a.type === 'pass' && typeof a.from === 'string' && typeof a.to === 'string') {
        actions.push({ id, type: 'pass', from: a.from, to: a.to });
      } else if (a.type === 'shot' && typeof a.playerId === 'string') {
        actions.push({ id, type: 'shot', playerId: a.playerId });
      }
    }

    const f: Frame = {
      id: str(raw.id, uid()),
      positions,
      ball: { holder, pos },
      actions,
      duration: isNum(raw.duration) ? Math.min(4, Math.max(0.6, raw.duration)) : DEFAULT_DURATION,
      note: typeof raw.note === 'string' ? raw.note.slice(0, 120) : '',
    };
    sanitizeFrame(f);
    // como mucho un pase o un tiro, y un movimiento por jugador
    let ballAction = false;
    const moved = new Set<string>();
    f.actions = f.actions.filter((a) => {
      if (isMove(a)) return moved.has(a.playerId) ? false : (moved.add(a.playerId), true);
      return ballAction ? false : (ballAction = true);
    });
    return f;
  });

  const now = Date.now();
  const updatedAt = isNum(data.updatedAt) ? safeTime(data.updatedAt, now) : now;
  return {
    version: 1,
    id: isSafeId(data.id) ? data.id : uid(),
    name: str(data.name, 'Jugada importada').slice(0, 80),
    ...(isCategory(data.category) ? { category: data.category } : {}),
    court: data.court,
    players,
    frames,
    createdAt: Math.min(safeTime(data.createdAt, now) || updatedAt, updatedAt),
    updatedAt,
  };
}
