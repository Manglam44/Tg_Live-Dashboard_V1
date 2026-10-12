import { Pool } from "pg";

// Reuse one pool across hot reloads in dev so connections don't pile up.
const g = globalThis as unknown as { qdbPool?: Pool };

export const questdb =
    g.qdbPool ??
    new Pool({
        host: process.env.NEXT_PUBLIC_QDB_HOST,
        port: 8812,
        user: process.env.NEXT_PUBLIC_QDB_USER,
        password: process.env.NEXT_PUBLIC_QDB_PASSWORD,
        database: process.env.NEXT_PUBLIC_QDB_DATABASE,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    });

if (process.env.NODE_ENV !== "production") g.qdbPool = questdb;