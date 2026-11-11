/** Velocidades de reproducción y de vídeo. */
export const SPEEDS = [0.5, 0.75, 1, 1.5, 2];

const NAMES: Record<number, string> = { 0.5: 'lenta', 1: 'normal' };

/** Selector de velocidad. Con `named`, la lenta y la normal llevan su nombre. */
export function SpeedSelect({ value, onChange, disabled, named = false }: { value: number; onChange: (v: number) => void; disabled?: boolean; named?: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} aria-label="Velocidad">
      {SPEEDS.map((v) => (
        <option key={v} value={v}>
          {String(v).replace('.', ',')}×{named && NAMES[v] ? ` (${NAMES[v]})` : ''}
        </option>
      ))}
    </select>
  );
}
