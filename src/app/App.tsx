import { ThemeContext } from '../court/theme';
import { useAppearance } from '../features/appearance/useAppearance';
import { ExerciseEditor } from '../features/exercises/ExerciseEditor';
import { Library } from '../features/exercises/Library';
import { useRoute } from './useRoute';

/**
 * La app: elige la pantalla según la dirección (`useRoute`) y da a toda la pista los colores
 * del aspecto elegido. Cada pantalla vive en su carpeta dentro de `features/`.
 */
export default function App() {
  const route = useRoute();
  const { palette, style, pitch } = useAppearance();
  return (
    <ThemeContext.Provider value={palette}>
      <div className="theme-root" data-pitch={pitch} style={style}>
        {route.name === 'exercise' ? <ExerciseEditor key={route.id} id={route.id} /> : <Library />}
      </div>
    </ThemeContext.Provider>
  );
}
