/**
 * Puntos de corte de la maqueta, en un solo sitio. Los `@media` de las hojas de estilo usan
 * exactamente estos números (CSS no deja usar variables en `@media`); un test lo comprueba.
 *
 * - Móvil: hasta 767 px de ancho, o hasta 500 px de alto (un móvil en horizontal mide unos 844 × 390).
 * - Tablet: de 768 a 1.180 px de ancho (desde 1.180 hacia abajo la barra superior ya va solo con iconos).
 * - Escritorio: más de 1.180 px.
 * Aparte, con dedo (`pointer: coarse`) se aplican los ajustes táctiles, sea cual sea el ancho.
 */
export const BREAKPOINTS = { mobileMax: 767, tabletMax: 1180, shortMax: 500 } as const;

export const MEDIA = {
  mobile: `(max-width: ${BREAKPOINTS.mobileMax}px), (max-height: ${BREAKPOINTS.shortMax}px)`,
  tablet: `(min-width: ${BREAKPOINTS.mobileMax + 1}px) and (max-width: ${BREAKPOINTS.tabletMax}px) and (min-height: ${BREAKPOINTS.shortMax + 1}px)`,
  touch: '(pointer: coarse)',
  landscape: '(orientation: landscape)',
} as const;

export type Layout = 'mobile' | 'tablet' | 'desktop';

/** Qué maqueta toca para un tamaño de pantalla (en px CSS). */
export const layoutForSize = (width: number, height = Infinity): Layout =>
  width <= BREAKPOINTS.mobileMax || height <= BREAKPOINTS.shortMax ? 'mobile' : width <= BREAKPOINTS.tabletMax ? 'tablet' : 'desktop';

/** Anchos que pueden aparecer en un `@media` de las hojas de estilo. */
export const MEDIA_WIDTHS = [BREAKPOINTS.mobileMax, BREAKPOINTS.mobileMax + 1, BREAKPOINTS.tabletMax, BREAKPOINTS.tabletMax + 1];
