import { createClient } from '@supabase/supabase-js';

/**
 * Conexión con Supabase (la nube donde se sincronizan ejercicios y sesiones).
 *
 * La clave «publishable» es pública por diseño: va dentro de la app, como en cualquier web que use
 * Supabase. Lo que protege los datos no es ocultarla, sino las reglas de seguridad de la base de
 * datos (Row Level Security, ver `supabase/schema.sql`): cada persona solo puede leer y escribir sus
 * propias filas. La clave secreta («service_role»/«secret») nunca debe estar aquí.
 */
export const SUPABASE_URL = 'https://ttvsdivqymgwvptfjjmy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xPdqBKEKHaeAncY6TVPfww_90nnVxbN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // PKCE: el enlace del correo vuelve con «?code=…» y no ocupa el «#», que es nuestro enrutado
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'entrenos.sesion-supabase',
  },
});
