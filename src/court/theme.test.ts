import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, inkFor, paletteFor, parseAppearance } from './theme';

describe('aspecto', () => {
  it('lo guardado que no encaja vuelve al valor por defecto', () => {
    expect(parseAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({ pitch: 'marte', offense: 'red', defense: '#ABCDEF' })).toEqual({ ...DEFAULT_APPEARANCE, defense: '#abcdef' });
  });

  it('el número se lee sobre cualquier color de equipo', () => {
    expect(inkFor('#111827')).toBe('#ffffff');
    expect(inkFor('#eab308')).toBe('#111827');
  });

  it('en la pizarra blanca un equipo blanco se dibuja en negro', () => {
    const p = paletteFor({ pitch: 'blanca', offense: '#f8fafc', defense: '#c62828' });
    expect(p.team.O.stroke).toBe('#111827');
    expect(p.team.D.ink).toBe('#c62828');
  });
});
