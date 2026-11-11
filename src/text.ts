/** «1 jugada nueva», «3 jugadas nuevas»: el número con la palabra en singular o plural. */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
