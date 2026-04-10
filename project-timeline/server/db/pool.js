/**
 * server/db/pool.js — Shared PostgreSQL connection pool.
 *
 * Uses the `pg` library's Pool for connection reuse across requests.
 * All controllers require this module to run queries.
 *
 * Environment variables (set in .env):
 *   DATABASE_URL  — Full connection string, e.g.:
 *                   postgresql://user:password@localhost:5432/project_timeline
 *
 * Alternative individual vars (if DATABASE_URL is not set):
 *   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
 */

"use strict";

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
console.log(
  "[pool.js] Connecting to:",
  connectionString
    ? connectionString.replace(/:[^:]*@/, ":****@")
    : "using defaults",
);

const pool = new Pool({
  connectionString: connectionString,
  // Uncomment for SSL in production (e.g. Heroku, Railway, Supabase):
  // ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL client error:", err.message);
});

module.exports = pool;
