import { ThemeContext } from '../court/theme';
import { useAppearance } from '../features/appearance/useAppearance';
import { ExerciseEditor } from '../features/exercises/ExerciseEditor';
import { Library } from '../features/exercises/Library';
import { SessionList } from '../features/sessions/SessionList';
import { SessionScreen } from '../features/sessions/SessionScreen';
import { type Route, useRoute } from './useRoute';

/** La pantalla de cada ruta. `key` hace que al cambiar de id se monte una pantalla nueva. */
function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'exercise':
      return <ExerciseEditor key={route.id} id={route.id} />;
    case 'session':
      return <SessionScreen key={route.id} id={route.id} />;
    case 'library':
      return <Library />;
    default:
      return <SessionList />;
  }
}

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
        <Screen route={route} />
      </div>
    </ThemeContext.Provider>
  );
}
