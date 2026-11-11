import { useState } from 'react';

/**
 * Acceso a localStorage que nunca rompe la app: en modo privado, con el almacenamiento bloqueado
 * o lleno, leer devuelve el valor por defecto y escribir devuelve false (lo cambiado dura la sesión).
 */
export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Lee un valor guardado como JSON; si falta o está dañado, `fallback`. */
export function readJson<T>(key: string, fallback: T): T | unknown {
  const raw = getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

export const writeJson = (key: string, value: unknown) => setItem(key, JSON.stringify(value));

/** Como `useState`, pero recordado en este navegador. */
export function usePersistentState<T>(key: string, initial: T, parse: (v: unknown) => T = (v) => v as T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => parse(readJson(key, initial)));
  const update = (v: T) => {
    setValue(v);
    writeJson(key, v);
  };
  return [value, update];
}
