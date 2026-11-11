import { useStore } from '../../store';
import { paletteFor, PITCHES, TEAM_COLORS, ThemeContext } from '../../court/theme';
import { CourtLines, PlayerShape } from '../../court/Scene';
import { PanelSection } from '../../ui/PanelSection';
import './Appearance.css';

/** Muestra pequeña de un tema: un trozo de pista con un atacante y un defensor. */
function PitchSample({ pitch }: { pitch: (typeof PITCHES)[number]['id'] }) {
  const appearance = useStore((s) => s.appearance);
  return (
    <ThemeContext.Provider value={paletteFor({ ...appearance, pitch })}>
      <svg viewBox="20 -6 110 66" aria-hidden="true">
        <CourtLines court="half" />
        <PlayerShape team="O" label="1" pos={{ x: 58, y: 40 }} />
        <PlayerShape team="D" label="X1" pos={{ x: 92, y: 30 }} />
      </svg>
    </ThemeContext.Provider>
  );
}

function TeamColor({ team, label }: { team: 'offense' | 'defense'; label: string }) {
  const value = useStore((s) => s.appearance[team]);
  const setAppearance = useStore((s) => s.setAppearance);
  return (
    <fieldset className="options swatches">
      <legend>{label}</legend>
      {TEAM_COLORS.map((c) => (
        <label key={c.hex} className={`swatch${c.hex === value ? ' on' : ''}`} title={c.name} style={{ background: c.hex }}>
          <input type="radio" name={`color-${team}`} value={c.hex} checked={c.hex === value} onChange={() => setAppearance({ [team]: c.hex })} />
          <span className="sr-only">{c.name}</span>
        </label>
      ))}
      {/* cualquier otro color, por ejemplo el del club */}
      <label className={`swatch custom${TEAM_COLORS.some((c) => c.hex === value) ? '' : ' on'}`} title="Otro color">
        <input type="color" value={value} onChange={(e) => setAppearance({ [team]: e.target.value })} />
        <span className="sr-only">Otro color</span>
      </label>
    </fieldset>
  );
}

/** Tema de la pista y colores de los equipos, para todos los ejercicios. */
export function Appearance() {
  const pitch = useStore((s) => s.appearance.pitch);
  const setAppearance = useStore((s) => s.setAppearance);
  return (
    <>
      <fieldset className="options pitches">
        <legend>Pista</legend>
        {PITCHES.map((p) => (
          <label key={p.id} className={`pitch${p.id === pitch ? ' on' : ''}`}>
            <input type="radio" name="pitch" value={p.id} checked={p.id === pitch} onChange={() => setAppearance({ pitch: p.id })} />
            <PitchSample pitch={p.id} />
            <strong>{p.name}</strong>
          </label>
        ))}
      </fieldset>
      <TeamColor team="offense" label="Ataque" />
      <TeamColor team="defense" label="Defensa" />
      <p className="muted small">Se aplica a todos los ejercicios. Es una preferencia de este navegador.</p>
    </>
  );
}

/** La sección «Aspecto» del panel lateral, plegada al principio. */
export function AppearanceSection() {
  return (
    <PanelSection id="aspecto" title="Aspecto" defaultOpen={false}>
      <Appearance />
    </PanelSection>
  );
}
