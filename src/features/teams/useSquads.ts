import { useCallback, useEffect, useState } from 'react';
import { listSquads, onLocalChange, onRemoteChange } from '../../data/db';
import { type Squad, sortSquads } from '../../model/squad';

/**
 * Los equipos guardados, ordenados por club y nombre. Se vuelven a leer solos cuando cambia algo
 * aquí o llega algo de la nube (otro dispositivo). `null` mientras se cargan.
 */
export function useSquads() {
  const [squads, setSquads] = useState<Squad[] | null>(null);
  const reload = useCallback(() => {
    listSquads()
      .then((l) => setSquads(sortSquads(l)))
      .catch(() => setSquads([]));
  }, []);
  useEffect(() => {
    reload();
    const a = onRemoteChange(reload);
    const b = onLocalChange(reload);
    return () => {
      a();
      b();
    };
  }, [reload]);
  return { squads, reload };
}
