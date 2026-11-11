import { useId } from 'react';
import './Choice.css';

/** Grupo de opciones excluyentes con aspecto de botones. */
export function Choice<T extends string>({ legend, value, options, onChange, disabled }: { legend: string; value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  const name = useId();
  return (
    <fieldset className="options choice" disabled={disabled}>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={o.value === value ? 'on' : undefined}>
          <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
          <strong>{o.label}</strong>
          {o.hint && <span>{o.hint}</span>}
        </label>
      ))}
    </fieldset>
  );
}
