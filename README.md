# Entrenos

App web para preparar entrenamientos de baloncesto: ejercicios con un dibujo animado (varios fotogramas) y su explicación, sesiones hechas con esos ejercicios y un modo entreno para seguirlas en el móvil.

La pizarra (modelo, pista y editor) se copió de ATO (`Pizzarra Jugadas`), que sigue siendo un proyecto aparte.

## Arrancar

```bash
npm install
npm run dev
```

## Comprobar

```bash
npm run typecheck
npm test
npm run build
```

`npm run build` comprueba los tipos, pasa los tests y genera `dist/`.

## Stack

React 19, TypeScript, Vite 6, Zustand (estado de la pizarra), Dexie (IndexedDB, guardado en el dispositivo) y Vitest. Vite se queda en la 6 y Rollup usa su versión WebAssembly (`overrides` en `package.json`) porque Windows bloquea los binarios nativos.

## Carpetas

- `src/model`: datos y reglas, TypeScript puro con tests.
- `src/court`: dibujo de la pista y los jugadores.
- `src/features/editor`: la pizarra (herramientas, pista, fotogramas, panel).
- `src/features/exercises`: biblioteca y editor de ejercicios.
- `src/data`: base de datos local.
- `src/ui`: piezas de interfaz reutilizables.
