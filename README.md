# Run it

*Practice plan*: la pareja de [ATO · Draw it up](https://ato-draw-it-up.pages.dev). En ATO se dibuja la jugada; en Run it se prepara el entreno y se ejecuta.

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

## Publicación

Publicada en **https://run-it-session.pages.dev** (Cloudflare Pages, conectado a este repositorio): **cada `git push` a `main` se publica solo**.

- Comando de compilación: `npm run build` (comprueba tipos, pasa los tests y genera `dist/`; si algo falla, no se publica).
- Carpeta de salida: `dist`.
- Versión de Node: la del archivo `.node-version`.
- Las cabeceras de seguridad y de caché van en `dist/_headers`, que genera `vite.config.ts`.
- La web lleva `noindex`: no aparece en buscadores.

Los datos (ejercicios y sesiones) se guardan en el navegador de cada dispositivo, no en el servidor. Para pasarlos de uno a otro, usa «Descargar copia de seguridad» e «Importar archivos…» en el menú «⋯».
