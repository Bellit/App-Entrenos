/**
 * Protección de los datos guardados en el navegador.
 *
 * Por defecto, el navegador puede borrar lo guardado en IndexedDB si le falta espacio, y Safari
 * (iPhone y Mac) lo borra si la web no se usa en 7 días y no está en la pantalla de inicio.
 * `navigator.storage.persist()` pide que no se borre. Chrome lo concede o no sin preguntar
 * (según lo que se use la web); Firefox pregunta a la persona, por eso solo se pide al pulsar un
 * botón (crear o importar), nunca al abrir la página.
 */

export type StorageState = 'persisted' | 'at-risk' | 'unknown';

/** ¿Están protegidos los datos? Solo consulta: no pregunta nada a la persona. */
export async function storageState(): Promise<StorageState> {
  try {
    if (!navigator.storage?.persisted) return 'unknown';
    return (await navigator.storage.persisted()) ? 'persisted' : 'at-risk';
  } catch {
    return 'unknown';
  }
}

/** Pide que no se borren los datos. Devuelve si quedan protegidos. Llamar desde un clic. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
