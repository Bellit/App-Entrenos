import { useEffect } from 'react';
import { useStore } from '../store';

/** Avanza la reproducción con requestAnimationFrame. */
export function usePlayback() {
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const s = useStore.getState();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const n = s.play.frames.length;
      let { k, t } = s.playhead ?? { k: 0, t: 0 };
      t += (dt * s.speed) / s.play.frames[k].duration;
      if (t >= 1) {
        if (k < n - 1) {
          k += 1;
          t = 0;
        } else if (s.loop) {
          k = 0;
          t = 0;
        } else {
          s.set({ playhead: { k, t: 1 }, playing: false });
          return;
        }
      }
      s.set({ playhead: { k, t } });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}
