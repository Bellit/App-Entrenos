/**
 * Modelo de una jugada: TypeScript puro, sin React ni almacén. Este fichero solo reúne los módulos
 * para poder importar todo desde `model/play`.
 */
export * from './common';
export * from './create';
export * from './query';
export * from './animate';
export { movePlayer, setMove, setActionEnd, setActionType, setPass, setShot, deleteAction, setBall, sanitizeFrame, setCourt, canReceive } from './edit';
export * from './balls';
export * from './frames';
export * from './players';
export * from './parse';
