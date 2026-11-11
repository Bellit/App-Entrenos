import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cronómetro de un bloque: cuenta hacia atrás sus minutos y, al llegar a cero, avisa con tres
 * pitidos y una vibración (en los móviles que la permiten). Sigue contando en negativo para que
 * se vea cuánto se ha pasado.
 *
 * - Se calcula con la hora de fin (`endsAt`), no restando un segundo en cada tic: así no se
 *   desajusta aunque el móvil vaya lento o la pestaña se quede en segundo plano.
 * - Al cambiar de bloque (`resetKey`) vuelve a los minutos del nuevo bloque y, si estaba en
 *   marcha, sigue en marcha: el entreno fluye sin tener que pulsar «empezar» cada vez.
 * - El sonido usa Web Audio, que el navegador solo deja sonar después de un toque de la persona;
 *   por eso el «aparato de sonido» se crea al pulsar empezar.
 */
export function useBlockTimer(minutes: number, resetKey: string) {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(minutes * 60);
  const endsAt = useRef(0);
  const alarmed = useRef(false);
  const audio = useRef<AudioContext | null>(null);

  // nuevo bloque: vuelve a sus minutos (y si iba en marcha, sigue)
  useEffect(() => {
    setRemaining(minutes * 60);
    endsAt.current = Date.now() + minutes * 60 * 1000;
    alarmed.current = false;
  }, [resetKey, minutes]);

  const beep = useCallback(() => {
    try {
      const ctx = audio.current;
      if (ctx) {
        for (let i = 0; i < 3; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35);
          g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + i * 0.35 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.25);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + i * 0.35);
          o.stop(ctx.currentTime + i * 0.35 + 0.3);
        }
      }
      navigator.vibrate?.([300, 150, 300, 150, 300]);
    } catch {
      /* sin sonido ni vibración: queda el aviso en pantalla */
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = (endsAt.current - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0 && !alarmed.current) {
        alarmed.current = true;
        beep();
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [running, beep, resetKey]);

  const toggle = useCallback(() => {
    if (!audio.current) {
      try {
        audio.current = new AudioContext();
      } catch {
        /* navegador sin Web Audio */
      }
    }
    void audio.current?.resume();
    setRunning((r) => {
      if (!r) endsAt.current = Date.now() + remaining * 1000; // reanuda desde donde se quedó
      return !r;
    });
  }, [remaining]);

  const reset = useCallback(() => {
    setRemaining(minutes * 60);
    endsAt.current = Date.now() + minutes * 60 * 1000;
    alarmed.current = false;
  }, [minutes]);

  /** Suma (o resta) tiempo al bloque en marcha: «+1 min». */
  const add = useCallback((seconds: number) => {
    endsAt.current += seconds * 1000;
    setRemaining((r) => r + seconds);
    if (seconds > 0) alarmed.current = false;
  }, []);

  return { running, remaining, toggle, reset, add };
}
