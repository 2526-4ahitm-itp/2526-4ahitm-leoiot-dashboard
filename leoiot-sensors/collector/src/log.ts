// Plain logger; tests replace it with a collector of messages.
export type Log = (message: string) => void;

export const consoleLog: Log = (message) => {
  console.log(`${new Date().toISOString()} [sensors-collector] ${message}`);
};
