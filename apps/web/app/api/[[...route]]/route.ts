import { handle } from '@hono/vercel';

import { app } from '@uspomena/api';

// The API uses Drizzle, Storage, sharp and the Node crypto module, so it must
// never run on the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
