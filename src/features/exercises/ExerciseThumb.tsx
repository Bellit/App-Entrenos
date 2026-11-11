import { memo } from 'react';
import { SceneSvg } from '../../court/Scene';
import type { Exercise } from '../../model/exercise';
import * as P from '../../model/play';

/**
 * Miniatura de un ejercicio: su primer fotograma con las líneas. Se usa en la biblioteca, en el
 * selector de ejercicios y en los bloques de una sesión. Solo se redibuja si cambia el ejercicio
 * (mismo id y misma fecha de modificación = mismo dibujo), porque dibujar muchas pistas cuesta.
 */
export const ExerciseThumb = memo(
  function ExerciseThumb({ exercise }: { exercise: Exercise }) {
    const play = exercise.play;
    return <SceneSvg play={play} scene={P.frameScene(play, 0)} actions={P.drawables(play, 0)} />;
  },
  (a, b) => a.exercise.id === b.exercise.id && a.exercise.updatedAt === b.exercise.updatedAt,
);
