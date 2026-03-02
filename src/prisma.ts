// Prisma Client Singleton
// created a single Prisma Client instance and reusing it across the app.
// This avoids creating multiple database connections which can exhaust
// the connection pool.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    log: ["warn", "error"],
});

export default prisma;
