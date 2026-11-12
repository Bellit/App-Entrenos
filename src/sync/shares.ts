/**
 * Compartir a través de Supabase (tabla `shares`, ver `supabase/shares.sql`):
 *  - por enlace: se guarda una copia con un código al azar; el enlace lleva solo ese código;
 *  - con una cuenta: se guarda la copia con el correo de quien la recibe; solo esa cuenta la ve.
 * Para compartir hace falta haber entrado con una cuenta; para abrir un enlace, no.
 */
import { saveExercise, saveSession } from '../data/db';
import { adoptShared, newShareId, parseShared, type Shared, type ShareKind, type SharePayload } from '../model/share';
import { routeHref } from '../app/useRoute';
import { supabase } from './supabase';

/** Dirección completa del enlace (la de la app publicada, o la local en pruebas). */
export const shareUrl = (id: string) => `${location.origin}${location.pathname}${routeHref.shared(id)}`;

/** Crea un enlace y devuelve su código. */
export async function createLink(p: SharePayload): Promise<string> {
  const id = newShareId();
  const { error } = await supabase.from('shares').insert({ id, kind: p.kind, title: p.title, data: p.data });
  if (error) throw error;
  return id;
}

/** Comparte con la cuenta de ese correo. */
export async function shareWith(email: string, p: SharePayload): Promise<void> {
  const { error } = await supabase.from('shares').insert({ id: newShareId(), kind: p.kind, title: p.title, data: p.data, recipient_email: email.trim().toLowerCase() });
  if (error) throw error;
}

/** Abre un enlace (no hace falta cuenta). null si no existe o se ha borrado. */
export async function fetchLink(id: string): Promise<(Shared & { title: string }) | null> {
  const { data, error } = await supabase.rpc('get_share', { share_id: id });
  if (error) throw error;
  const row = (data as { kind: ShareKind; title: string; data: unknown }[] | null)?.[0];
  if (!row) return null;
  const shared = parseShared(row.kind, row.data);
  return shared ? { ...shared, title: row.title } : null;
}

export interface InboxItem {
  id: string;
  kind: ShareKind;
  title: string;
  from: string;
  createdAt: string;
  shared: Shared | null;
}

/** Lo que me han compartido y aún no he guardado ni descartado. */
export async function listInbox(email: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('shares')
    .select('id, kind, title, data, owner_email, created_at')
    .eq('recipient_email', email.toLowerCase())
    .eq('dismissed', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, kind: r.kind, title: r.title, from: r.owner_email, createdAt: r.created_at, shared: parseShared(r.kind, r.data) }));
}

/** Cuántas cosas nuevas me han compartido (para el aviso de la cabecera). */
export async function countInbox(email: string): Promise<number> {
  const { count, error } = await supabase.from('shares').select('id', { count: 'exact', head: true }).eq('recipient_email', email.toLowerCase()).eq('dismissed', false);
  if (error) throw error;
  return count ?? 0;
}

export interface SentItem {
  id: string;
  kind: ShareKind;
  title: string;
  to: string | null;
  createdAt: string;
  seen: boolean;
}

/** Lo que he compartido yo (enlaces y envíos a cuentas). */
export async function listSent(userId: string): Promise<SentItem[]> {
  const { data, error } = await supabase.from('shares').select('id, kind, title, recipient_email, created_at, dismissed').eq('owner', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, kind: r.kind, title: r.title, to: r.recipient_email, createdAt: r.created_at, seen: r.dismissed }));
}

/** Borra algo que he compartido: el enlace deja de funcionar / la otra persona deja de verlo. */
export async function deleteShare(id: string) {
  const { error } = await supabase.from('shares').delete().eq('id', id);
  if (error) throw error;
}

/** Marca como visto algo que me han compartido (al guardarlo o descartarlo). */
export async function dismissShare(id: string) {
  const { error } = await supabase.from('shares').update({ dismissed: true }).eq('id', id);
  if (error) throw error;
}

/** Guarda lo recibido como propio (copias nuevas). Devuelve la dirección para abrirlo. */
export async function saveShared(s: Shared): Promise<string> {
  const { exercises, session } = adoptShared(s);
  for (const e of exercises) await saveExercise(e);
  if (session) {
    await saveSession(session);
    return routeHref.session(session.id);
  }
  return routeHref.exercise(exercises[0].id);
}
