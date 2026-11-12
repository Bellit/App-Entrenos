/**
 * Crear un ejercicio con IA (BETA, fase 1: copiar y pegar). TypeScript puro, sin React.
 *
 * La app no habla con ninguna IA: prepara unas instrucciones (`buildPrompt`) que el usuario pega en la
 * IA que quiera (Copilot, ChatGPT, Gemini…), y luego lee la respuesta que pega de vuelta
 * (`exerciseFromAi`).
 *
 * Lo importante: a la IA no se le piden coordenadas, que coloca mal. Se le da un vocabulario de
 * baloncesto (posiciones con nombre como «codo-izq» y acciones como «pase de 1 a 2») y aquí se
 * traduce a la pizarra: posiciones en la pista, fotogramas encadenados y balones.
 */
import { nearestRim } from './court';
import { clone, DEFAULT_DURATION, LABEL_MAX, LIMITS, uid } from './common';
import { newFrame } from './create';
import { sanitizeFrame } from './edit';
import { EXERCISE_CATEGORIES, EXERCISE_LIMITS, type Exercise, fold, isExerciseCategory, newExercise, normalizeTag } from './exercise';
import { lerp, round1 } from './geometry';
import { endState, hasBall, moveOf } from './query';
import type { BallState, MoveType, Play, Player, Pt, Team } from './types';

/**
 * Posiciones con nombre, en unidades de media pista (10 cm; canasta arriba, fondo en y = 0,
 * banda izquierda en x = 0). «izq» y «der» son la izquierda y la derecha de quien mira el dibujo,
 * que es también la del atacante que mira a canasta.
 */
export const SPOTS: Record<string, { x: number; y: number; desc: string }> = {
  arriba: { x: 75, y: 92, desc: 'parte alta, por fuera del triple, en el centro' },
  'base-izq': { x: 50, y: 88, desc: 'parte alta, un poco a la izquierda' },
  'base-der': { x: 100, y: 88, desc: 'parte alta, un poco a la derecha' },
  'ala-izq': { x: 24, y: 66, desc: 'ala (45°), por fuera del triple' },
  'ala-der': { x: 126, y: 66, desc: 'ala (45°), por fuera del triple' },
  'esquina-izq': { x: 9, y: 8, desc: 'esquina, triple de esquina' },
  'esquina-der': { x: 141, y: 8, desc: 'esquina, triple de esquina' },
  'codo-izq': { x: 51, y: 58, desc: 'codo: esquina de la zona con la línea de tiros libres' },
  'codo-der': { x: 99, y: 58, desc: 'codo: esquina de la zona con la línea de tiros libres' },
  'tiro-libre': { x: 75, y: 58, desc: 'centro de la línea de tiros libres (poste alto)' },
  'poste-bajo-izq': { x: 46, y: 24, desc: 'poste bajo, junto a la zona' },
  'poste-bajo-der': { x: 104, y: 24, desc: 'poste bajo, junto a la zona' },
  'fondo-izq': { x: 30, y: 6, desc: 'línea de fondo, entre la zona y la esquina' },
  'fondo-der': { x: 120, y: 6, desc: 'línea de fondo, entre la zona y la esquina' },
  'media-izq': { x: 38, y: 42, desc: 'media distancia a 45°, dentro del triple' },
  'media-der': { x: 112, y: 42, desc: 'media distancia a 45°, dentro del triple' },
  canasta: { x: 75, y: 22, desc: 'debajo del aro (para entradas y rebotes)' },
  'medio-campo': { x: 75, y: 132, desc: 'centro del campo' },
  'medio-campo-izq': { x: 22, y: 130, desc: 'medio campo, cerca de la banda' },
  'medio-campo-der': { x: 128, y: 130, desc: 'medio campo, cerca de la banda' },
  'banda-izq': { x: 4, y: 100, desc: 'pegado a la banda, a la altura de la parte alta' },
  'banda-der': { x: 146, y: 100, desc: 'pegado a la banda, a la altura de la parte alta' },
  'fuera-fondo': { x: 52, y: -5, desc: 'fuera de la línea de fondo (sacador)' },
  'fuera-banda-izq': { x: -5, y: 100, desc: 'fuera de la banda (sacador)' },
  'fuera-banda-der': { x: 155, y: 100, desc: 'fuera de la banda (sacador)' },
};

/** Nombre de posición tal como lo escriba la IA → clave de `SPOTS` («Codo izquierdo» → «codo-izq»). */
function spotKey(raw: string): string {
  return fold(raw)
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/izquierd[ao]/g, 'izq')
    .replace(/derech[ao]/g, 'der')
    .replace(/^el-|^la-/, '');
}

const RIM = nearestRim('half', { x: 75, y: 0 });

/** Lee una posición: nombre de `SPOTS` o coordenadas en metros ([x, y] o {x, y}). */
function readPos(v: unknown): Pt | null {
  if (typeof v === 'string') {
    const s = SPOTS[spotKey(v)];
    return s ? { x: s.x, y: s.y } : null;
  }
  const xy = Array.isArray(v) ? { x: v[0], y: v[1] } : v && typeof v === 'object' ? (v as { x: unknown; y: unknown }) : null;
  if (!xy || typeof xy.x !== 'number' || typeof xy.y !== 'number' || !Number.isFinite(xy.x) || !Number.isFinite(xy.y)) return null;
  // metros → unidades de 10 cm, sin salirse mucho de la media pista
  return round1({ x: Math.min(160, Math.max(-10, xy.x * 10)), y: Math.min(145, Math.max(-10, xy.y * 10)) });
}

/** Sitio del defensor que marca a alguien: entre él y la canasta, como «Poner defensa». */
const guardSpot = (p: Pt) => round1(lerp(p, nearestRim('half', p), 0.22));

/** Si el sitio ya está ocupado (una fila), se coloca detrás, alejándose de la canasta. */
function freeSpot(p: Pt, taken: Pt[]): Pt {
  let q = p;
  const d = Math.hypot(p.x - RIM.x, p.y - RIM.y) || 1;
  const dir = { x: (p.x - RIM.x) / d, y: (p.y - RIM.y) / d };
  for (let i = 1; i < 10 && taken.some((t) => Math.hypot(t.x - q.x, t.y - q.y) < 7); i++) q = round1({ x: p.x + dir.x * 10 * i, y: p.y + dir.y * 10 * i });
  return q;
}

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const TEAM_WORDS: [RegExp, Team][] = [
  [/^(ataque|atacante|ofensiv|a$|o$)/, 'O'],
  [/^(defensa|defensor|defensiv|d$|x$)/, 'D'],
  [/^cono/, 'C'],
  [/^(entrenador|coach|e$|k$)/, 'K'],
];
const ACTION_WORDS: [RegExp, 'move' | 'dribble' | 'screen' | 'pass' | 'shot' | 'guard'][] = [
  [/^(correr|corte|cortar|mover|moverse|desplaza|move|run|cut)/, 'move'],
  [/^(botar|bote|conducir|conduccion|dribble)/, 'dribble'],
  [/^(bloqueo|bloquear|pantalla|screen)/, 'screen'],
  [/^(pase|pasar|pass)/, 'pass'],
  [/^(tiro|tirar|lanzamiento|lanzar|shot|shoot|entrada|bandeja)/, 'shot'],
  [/^(defender|defensa|marcar|guard)/, 'guard'],
];

export interface AiResult {
  exercise: Exercise;
  /** Lo que no se ha podido dibujar tal cual, explicado para el usuario. */
  warnings: string[];
}

/**
 * Saca el bloque JSON del texto pegado: las IA suelen envolverlo en ```json … ``` y añadir frases.
 * Si no es JSON válido, prueba a corregir lo más habitual (comillas tipográficas, comas finales).
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No encuentro el ejercicio en lo que has pegado. Tiene que incluir el bloque que empieza por «{» y acaba por «}».');
  const body = text.slice(start, end + 1);
  try {
    return JSON.parse(body);
  } catch {
    try {
      return JSON.parse(body.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new Error('Lo que has pegado no está completo o tiene errores. Pide a la IA que lo repita respondiendo solo con el bloque JSON.');
    }
  }
}

/** Convierte la respuesta de la IA (texto pegado) en un ejercicio. Lanza un Error con un mensaje claro si no se puede. */
export function exerciseFromAi(text: string): AiResult {
  const raw = extractJson(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Lo que has pegado no tiene la forma de un ejercicio.');
  const r = raw as Record<string, unknown>;
  const warnings: string[] = [];

  // ---------- jugadores y posiciones iniciales ----------
  const list = Array.isArray(r.jugadores) ? r.jugadores : [];
  if (!list.length) throw new Error('La respuesta no trae jugadores («jugadores»).');
  const players: Player[] = [];
  const byName = new Map<string, string>(); // nombre que usa la IA (sin mayúsculas) → id interno
  const positions: Record<string, Pt> = {};
  const marks: { id: string; target: string; name: string }[] = [];
  for (const j of list.slice(0, LIMITS.players)) {
    if (!j || typeof j !== 'object') continue;
    const o = j as Record<string, unknown>;
    const name = str(o.id) || str(o.nombre);
    const key = fold(name);
    if (!name || byName.has(key)) {
      if (name) warnings.push(`El jugador «${name}» estaba repetido; se ha dejado uno.`);
      continue;
    }
    const tipo = fold(str(o.tipo) || str(o.equipo));
    const team: Team = TEAM_WORDS.find(([re]) => re.test(tipo))?.[1] ?? (/^x/i.test(name) ? 'D' : 'O');
    const p: Player = { id: uid(), team, label: team === 'C' ? '' : name.slice(0, LABEL_MAX) };
    players.push(p);
    byName.set(key, p.id);
    const pos = readPos(o.en ?? o.posicion ?? o.donde);
    if (pos) positions[p.id] = freeSpot(pos, Object.values(positions));
    else if (o.marca != null) marks.push({ id: p.id, target: fold(str(o.marca)), name });
    else {
      if (o.en != null) warnings.push(`No conozco la posición «${str(o.en)}» de ${name}; lo he dejado en el medio campo.`);
      positions[p.id] = freeSpot(SPOTS['medio-campo'], Object.values(positions));
    }
  }
  // los defensores con «marca» se colocan después, cuando ya está su atacante
  for (const m of marks) {
    const target = byName.get(m.target);
    const at = target && positions[target];
    if (!at) warnings.push(`${m.name} marca a «${m.target}», que no está en la pista; lo he dejado en el medio campo.`);
    positions[m.id] = at ? guardSpot(at) : freeSpot(SPOTS['medio-campo'], Object.values(positions));
  }
  const pid = (v: unknown) => byName.get(fold(str(v)));
  const label = (id: string) => players.find((p) => p.id === id)?.label || 'el cono';

  // ---------- balones ----------
  const ballNames = Array.isArray(r.balones) ? r.balones : r.balon != null ? [r.balon] : [];
  const balls: BallState[] = [];
  for (const b of ballNames) {
    const id = pid(b);
    const p = id && players.find((x) => x.id === id);
    if (!p || (p.team !== 'O' && p.team !== 'D')) warnings.push(`El balón de «${str(b)}» no se ha podido poner: no es un jugador.`);
    else if (!balls.some((x) => x.holder === id)) balls.push({ id: uid(), holder: id, pos: positions[id] });
  }

  // ---------- pasos → fotogramas ----------
  const now = Date.now();
  const play: Play = { version: 1, id: uid(), name: '', court: 'half', players, frames: [newFrame(positions, balls)], createdAt: now, updatedAt: now };
  let frame = play.frames[0];
  /** Cierra el fotograma actual y abre otro que empieza donde acaba este. */
  const nextFrame = (): boolean => {
    if (play.frames.length >= LIMITS.frames) return false;
    const end = endState(play, play.frames.length - 1);
    frame = newFrame(end.positions, end.balls);
    frame.duration = play.frames[play.frames.length - 1].duration;
    play.frames.push(frame);
    return true;
  };
  /** Dónde acaba un jugador en el fotograma actual con lo que ya tiene planeado. */
  const endOf = (id: string) => moveOf(frame, id)?.points.at(-1) ?? frame.positions[id];
  const receives = (id: string) => frame.actions.some((a) => a.type === 'pass' && a.to === id);
  const releases = (id: string) => frame.actions.some((a) => (a.type === 'pass' && a.from === id) || (a.type === 'shot' && a.playerId === id));

  /** Intenta añadir una acción al fotograma actual: 'ok', 'later' (va en el siguiente) o un aviso. */
  const tryAdd = (a: Record<string, unknown>): 'ok' | 'later' | string => {
    const kind = ACTION_WORDS.find(([re]) => re.test(fold(str(a.tipo))))?.[1];
    if (!kind) return `No sé dibujar la acción «${str(a.tipo)}».`;
    if (kind === 'pass') {
      const from = pid(a.de ?? a.jugador);
      const to = pid(a.a ?? a.para);
      if (!from || !to || from === to) return `Un pase sin pasador o receptor válido («${str(a.de ?? a.jugador)}» → «${str(a.a ?? a.para)}»).`;
      if (!hasBall(frame, from)) return receives(from) ? 'later' : `${label(from)} pasa sin tener el balón.`;
      if (releases(from) || receives(to)) return 'later';
      if (hasBall(frame, to)) return `${label(to)} recibe un pase pero ya tiene balón.`;
      frame.actions.push({ id: uid(), type: 'pass', from, to });
      return 'ok';
    }
    const id = pid(a.jugador ?? a.de);
    if (!id) return `Una acción «${str(a.tipo)}» de un jugador que no existe («${str(a.jugador ?? a.de)}»).`;
    if (kind === 'shot') {
      if (!hasBall(frame, id)) return receives(id) ? 'later' : `${label(id)} tira sin tener el balón.`;
      if (releases(id)) return 'later';
      frame.actions.push({ id: uid(), type: 'shot', playerId: id });
      return 'ok';
    }
    // desplazamientos: correr, botar, bloquear o ir a defender a alguien
    if (moveOf(frame, id)) return 'later';
    let type: MoveType = kind === 'guard' ? 'move' : kind;
    if (type === 'dribble' && !hasBall(frame, id)) {
      if (receives(id)) return 'later';
      type = 'move';
    }
    const start = frame.positions[id];
    let dest: Pt | null = null;
    const target = pid(a.sobre ?? (kind === 'guard' ? a.a : undefined));
    if (kind === 'guard' && target) dest = guardSpot(endOf(target));
    else if (kind === 'screen' && target) {
      // el bloqueo se pone pegado al jugador bloqueado, del lado de quien bloquea
      const t = endOf(target);
      const d = Math.hypot(start.x - t.x, start.y - t.y) || 1;
      dest = round1({ x: t.x + ((start.x - t.x) / d) * 7, y: t.y + ((start.y - t.y) / d) * 7 });
    } else dest = readPos(a.a ?? a.hasta ?? a.en);
    if (!dest) return `No conozco el destino «${str(a.a ?? a.hasta ?? a.sobre)}» de ${label(id)}.`;
    const via = (Array.isArray(a.por) ? a.por : a.por != null ? [a.por] : []).map(readPos).filter((p): p is Pt => !!p);
    if (Math.hypot(dest.x - start.x, dest.y - start.y) < 1) return 'ok'; // ya está ahí
    frame.actions.push({ id: uid(), type, playerId: id, points: [start, ...via, dest].map(round1) });
    return 'ok';
  };

  const steps = (Array.isArray(r.pasos) ? r.pasos : []).filter((p) => p && typeof p === 'object') as Record<string, unknown>[];
  steps.forEach((step, i) => {
    if (i > 0 && !nextFrame()) return;
    frame.note = str(step.nota).slice(0, 300);
    const secs = Number(step.duracion);
    if (Number.isFinite(secs) && secs > 0) frame.duration = Math.min(6, Math.max(0.6, secs));
    const actions = (Array.isArray(step.acciones) ? step.acciones : []).filter((a) => a && typeof a === 'object') as Record<string, unknown>[];
    for (const a of actions) {
      let res = tryAdd(a);
      // lo que debe ir después (2 recibe y luego tira) pasa a un fotograma nuevo dentro del mismo paso
      if (res === 'later') res = frame.actions.length && nextFrame() ? tryAdd(a) : 'Demasiados fotogramas.';
      if (res !== 'ok') warnings.push(res === 'later' ? `Paso ${i + 1}: una acción no cabía y se ha quitado.` : `Paso ${i + 1}: ${res}`);
    }
  });
  if (!steps.length) warnings.push('La respuesta no trae pasos («pasos»): solo se ha colocado a los jugadores.');
  // por si acaso: que cada fotograma cumpla las reglas de la pizarra
  for (const f of play.frames) sanitizeFrame(f);
  play.frames.forEach((f) => (f.duration ||= DEFAULT_DURATION));

  // ---------- la ficha del ejercicio ----------
  const title = (str(r.titulo) || 'Ejercicio con IA').slice(0, EXERCISE_LIMITS.title);
  const cat = fold(str(r.categoria));
  const category = isExerciseCategory(cat) ? cat : (EXERCISE_CATEGORIES.find((c) => fold(c.name) === cat)?.id ?? '');
  const tags = (Array.isArray(r.etiquetas) ? r.etiquetas : []).map((t) => normalizeTag(str(t))).filter(Boolean);
  const minutes = Number(r.minutos);
  const exercise: Exercise = {
    ...newExercise(title),
    category,
    tags: [...new Set(['ia', ...tags])].slice(0, EXERCISE_LIMITS.tags),
    notes: str(r.explicacion).slice(0, EXERCISE_LIMITS.notes),
    minutes: Number.isFinite(minutes) ? Math.min(EXERCISE_LIMITS.minutes, Math.max(1, Math.round(minutes))) : 10,
    play: { ...clone(play), name: title },
  };
  return { exercise, warnings };
}

const EXAMPLE = {
  titulo: 'Pasar y cortar con tiro',
  categoria: 'tiro',
  minutos: 10,
  etiquetas: ['pase y corte'],
  explicacion: 'Objetivo: cortar a canasta después de pasar.\nOrganización: fila en la parte alta y un pasador en el ala.\nDesarrollo: 1 pasa a 2, corta y recibe para tirar.\nPuntos clave:\n- Cortar fuerte después del pase\n- Pase al pecho y con ventaja',
  jugadores: [
    { id: '1', tipo: 'ataque', en: 'arriba' },
    { id: '2', tipo: 'ataque', en: 'ala-der' },
    { id: '3', tipo: 'ataque', en: 'arriba' },
    { id: 'X1', tipo: 'defensa', marca: '1' },
  ],
  balones: ['1'],
  pasos: [
    {
      nota: '1 pasa a 2 y corta a canasta por delante de su defensor',
      acciones: [
        { tipo: 'pase', de: '1', a: '2' },
        { tipo: 'correr', jugador: '1', a: 'canasta', por: ['codo-der'] },
        { tipo: 'defender', jugador: 'X1', a: '1' },
      ],
    },
    { nota: '2 devuelve el pase a 1', acciones: [{ tipo: 'pase', de: '2', a: '1' }] },
    { nota: '1 tira; luego repite el siguiente de la fila (3)', acciones: [{ tipo: 'tiro', jugador: '1' }] },
  ],
};

/** Las instrucciones que el usuario pega en la IA. `description` puede ir vacía (la escribe o dicta allí). */
export function buildPrompt(description: string): string {
  const spots = Object.entries(SPOTS)
    .map(([k, v]) => `- ${k}: ${v.desc}`)
    .join('\n');
  const cats = EXERCISE_CATEGORIES.map((c) => c.id).join(', ');
  const ask = description.trim()
    ? `EL EJERCICIO QUE QUIERO:\n${description.trim()}`
    : 'Te describo el ejercicio en el siguiente mensaje. Espera a que lo haga y entonces responde con el JSON.';
  return `Eres entrenador de baloncesto. Voy a dibujar un ejercicio de entrenamiento en mi app «Run it» y necesito que me lo describas en un formato concreto (JSON). La app lo convierte en un dibujo animado en MEDIA PISTA, con la canasta arriba.

FORMATO (responde SOLO con el bloque JSON, sin texto antes ni después):
- titulo: corto.
- categoria: una de ${cats}.
- minutos: duración en minutos.
- etiquetas: 1-4 palabras clave.
- explicacion: texto con «Objetivo:», «Organización:», «Desarrollo:», «Variantes:» y «Puntos clave:» (con guiones). Usa \\n para los saltos de línea.
- jugadores: lista. Cada uno con id (atacantes "1", "2"…; defensores "X1", "X2"…; conos "C1"…; entrenador "E"), tipo ("ataque", "defensa", "cono" o "entrenador") y "en" (su posición inicial). Un defensor puede llevar "marca": "<id del atacante>" en lugar de "en".
- balones: ids de los jugadores que tienen balón al empezar (puede haber varios).
- pasos: lista en orden. Cada paso tiene "nota" (qué pasa, en una frase) y "acciones".

ACCIONES:
- {"tipo": "correr", "jugador": "2", "a": "esquina-der", "por": ["codo-der"]} → "por" es opcional: puntos por los que pasa (para cortes curvos).
- {"tipo": "botar", "jugador": "1", "a": "ala-izq"} → solo quien tiene balón.
- {"tipo": "pase", "de": "1", "a": "2"} → solo quien tiene balón.
- {"tipo": "tiro", "jugador": "2"} → solo quien tiene balón.
- {"tipo": "bloqueo", "jugador": "5", "sobre": "X1"} → se coloca pegado a ese jugador. También vale "a": "<posición>".
- {"tipo": "defender", "jugador": "X1", "a": "1"} → el defensor se coloca para marcar a ese atacante.

POSICIONES (usa estos nombres; izq y der según se mira el dibujo, con la canasta arriba):
${spots}
Si ninguna sirve, usa coordenadas en metros [x, y]: x de 0 (banda izquierda) a 15 (banda derecha), y de 0 (línea de fondo) a 14 (medio campo). La canasta está en [7.5, 1.6].

REGLAS:
- Cada jugador hace como mucho un desplazamiento por paso.
- Un jugador que recibe un pase no puede pasarlo ni tirar en el mismo paso: hazlo en el paso siguiente.
- Para una fila de jugadores esperando turno, pon a varios en la misma posición: la app los coloca uno detrás de otro.
- Si el ejercicio es de pista entera, adáptalo a media pista.
- Entre 2 y 10 pasos.

EJEMPLO:
\`\`\`json
${JSON.stringify(EXAMPLE, null, 2)}
\`\`\`

${ask}`;
}
