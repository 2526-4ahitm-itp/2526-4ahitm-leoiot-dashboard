// Einfacher Logger; in Tests wird er durch einen Sammler ersetzt.
export type Log = (message: string) => void;

export const consoleLog: Log = (message) => {
  console.log(`${new Date().toISOString()} [Collector] ${message}`);
};
