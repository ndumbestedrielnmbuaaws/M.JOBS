// Logs ids and outcomes only: never names, emails or letter text.
const ts = () => new Date().toISOString().slice(11, 19);
export const log = {
  info: (msg: string) => console.log(`${ts()}  ${msg}`),
  warn: (msg: string) => console.warn(`${ts()}  ! ${msg}`),
  error: (msg: string) => console.error(`${ts()}  x ${msg}`),
};
