import { type Database as DatabaseType } from 'better-sqlite3';
declare const db: DatabaseType;
export declare function initDatabase(): void;
export { db };
