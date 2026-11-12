import { useEffect, useRef, useState } from 'react';
import { listExercises, listSessions, saveExercise, saveSession } from '../../data/db';
import { requestPersistence, type StorageState, storageState } from '../../data/persistence';
import { download } from '../../files';
import { backupData, backupFileName, readImportFile } from '../../model/importFile';
import { getItem, setItem } from '../../prefs';
import { IconDownload, IconMore, IconPlus, IconShare, IconUpload } from '../../ui/Icons';
import { navigate, routeHref } from '../../app/useRoute';
import { installApp, usePwa } from '../../pwa/pwa';
import { Menu } from '../../ui/Menu';
import { useSync } from '../../sync/sync';

/** Hasta cuándo no se vuelve a mostrar el aviso de copia de seguridad (preferencia de este navegador). */
const BACKUP_LATER_KEY = 'entrenos.copia.masTarde';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('#', String(n)));

/**
 * Herramientas de datos que comparten las páginas de Sesiones y Ejercicios:
 * - el menú «⋯» con «Importar archivos…» y «Descargar copia de seguridad»,
 * - el aviso de que los datos pueden borrarse si el navegador no los protege,
 * - los mensajes (resultado de importar, errores al guardar),
 * - `guarded`: envuelve una acción de guardado para que, si falla, se diga,
 * - `protect`: pide al navegador que no borre los datos (llamar desde un clic).
 *
 * `hasData`: si ya hay algo guardado (para el aviso y para poder descargar la copia).
 * `onChanged`: se llama tras importar, para que la página vuelva a leer su lista.
 */
export function useDataTools({ hasData, onChanged }: { hasData: boolean; onChanged: () => void }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [storage, setStorage] = useState<StorageState>('unknown');
  const [backupLater, setBackupLater] = useState(() => Number(getItem(BACKUP_LATER_KEY)) > Date.now());
  const signedIn = !!useSync().email;
  const fileInput = useRef<HTMLInputElement>(null);
  const pwa = usePwa();

  useEffect(() => {
    storageState().then(setStorage);
  }, []);

  const report = (text: string, ok = false) => setMessage({ ok, text });

  const guarded = (what: string, action: () => Promise<unknown>) => async () => {
    try {
      await action();
    } catch {
      report(`No se ha podido ${what}. Puede que el navegador no deje guardar (modo privado o sin espacio).`);
    }
  };

  const protect = () => requestPersistence().then((ok) => ok && setStorage('persisted'));

  /** «Más tarde»: el aviso de copia se oculta una semana. */
  const remindBackupLater = () => {
    setItem(BACKUP_LATER_KEY, String(Date.now() + 7 * 24 * 3600 * 1000));
    setBackupLater(true);
  };

  const downloadBackup = guarded('preparar la copia', async () => {
    const [exercises, sessions] = await Promise.all([listExercises(), listSessions()]);
    download(new Blob([JSON.stringify(backupData(exercises, sessions), null, 2)], { type: 'application/json' }), backupFileName());
    remindBackupLater();
  });

  /** Importa uno o varios archivos .json: jugadas de ATO, ejercicios o copias de seguridad. */
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    protect();
    let exercises = 0;
    let sessions = 0;
    let skipped = 0;
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const r = await readImportFile(file);
        for (const e of r.exercises) await saveExercise(e);
        for (const s of r.sessions) await saveSession(s);
        exercises += r.exercises.length;
        sessions += r.sessions.length;
        skipped += r.skipped;
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : 'no se pudo leer.'}`);
      }
    }
    if (fileInput.current) fileInput.current.value = ''; // permite volver a elegir el mismo archivo
    const parts: string[] = [];
    const got = [exercises && plural(exercises, '1 ejercicio', '# ejercicios'), sessions && plural(sessions, '1 sesión', '# sesiones')].filter(Boolean);
    if (got.length) parts.push(`Importado: ${got.join(' y ')}.`);
    if (skipped) parts.push(plural(skipped, 'Se ha saltado 1 elemento dañado.', 'Se han saltado # elementos dañados.'));
    report([...parts, ...problems].join(' '), got.length > 0 && problems.length === 0);
    onChanged();
  };

  const menu = (
    <Menu
      iconOnly
      label="Importar y copias de seguridad"
      title="Importar y copias de seguridad"
      icon={<IconMore />}
      items={[
        { label: 'Importar archivos…', hint: 'Jugadas de ATO, ejercicios o una copia', icon: <IconUpload />, onSelect: () => fileInput.current?.click() },
        { label: 'Descargar copia de seguridad', hint: 'Ejercicios y sesiones en un archivo', icon: <IconDownload />, onSelect: downloadBackup, disabled: !hasData },
        { label: 'Compartidos', hint: 'Conmigo y lo que he compartido', icon: <IconShare />, onSelect: () => navigate(routeHref.inbox) },
        ...(pwa.canInstall ? [{ label: 'Instalar la app', hint: 'En la pantalla de inicio, y funciona sin conexión', icon: <IconPlus />, onSelect: () => void installApp() }] : []),
      ]}
    />
  );

  const fileInputEl = <input ref={fileInput} type="file" accept=".json,application/json" multiple hidden onChange={(e) => importFiles(e.target.files)} aria-label="Importar archivos" />;

  const notices = (
    <>
      {message && (
        <p className={`notice${message.ok ? ' ok' : ' error'}`} role="status">
          {message.text}{' '}
          <button className="link" onClick={() => setMessage(null)}>
            Cerrar
          </button>
        </p>
      )}
      {/* con cuenta, todo está ya en la nube: el aviso sobraría */}
      {storage === 'at-risk' && !backupLater && hasData && !signedIn && (
        <div className="notice backup" role="note">
          <p>
            <strong>Tus ejercicios y sesiones solo están en este navegador.</strong> Si se queda sin espacio, o en iPhone si pasas una semana sin abrir la app, podría borrarlos. Guarda una copia de vez en cuando (o añade la app a la pantalla de inicio).
          </p>
          <div className="notice-actions">
            <button className="btn" onClick={downloadBackup}>
              <IconDownload /> Descargar copia
            </button>
            <button className="link" onClick={remindBackupLater}>
              Más tarde
            </button>
          </div>
        </div>
      )}
    </>
  );

  return { report, guarded, protect, openImport: () => fileInput.current?.click(), menu, fileInputEl, notices };
}
