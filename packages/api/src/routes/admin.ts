import { Hono, type Context } from 'hono';

import { errorBody, type AppEnv } from '../http.ts';
import {
  AdminError,
  createAccount,
  deleteAccount,
  listAccounts,
  resetAccountPassword,
  updateAccount,
  type AdminAccountInput,
} from '../services/admin.ts';

/** Maps the admin service errors to the shared envelope; other errors bubble to the global handler. */
const handle = async (c: Context<AppEnv>, run: () => Promise<Response>): Promise<Response> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AdminError) return c.json(errorBody(c, error.code), error.status);
    throw error;
  }
};

const body = async (c: Context<AppEnv>): Promise<AdminAccountInput> =>
  ((await c.req.json().catch(() => ({}))) as AdminAccountInput) ?? {};

/**
 * Superadmin account management (API.md, UC-71 – UC-76). Every route runs behind
 * `adminGuard`; the organizer app never calls them.
 */
export const adminRoutes = new Hono<AppEnv>()
  .get('/admin/accounts', (c) => handle(c, async () => c.json({ accounts: await listAccounts() })))
  .post('/admin/accounts', (c) =>
    handle(c, async () => {
      const result = await createAccount(await body(c));
      return c.json(result, 201);
    }),
  )
  .patch('/admin/accounts/:id', (c) =>
    handle(c, async () => c.json({ account: await updateAccount(c.req.param('id'), await body(c)) })),
  )
  .post('/admin/accounts/:id/password', (c) =>
    handle(c, async () => {
      const input = (await c.req.json().catch(() => ({}))) as { password?: string };
      return c.json(await resetAccountPassword(c.req.param('id'), input.password));
    }),
  )
  .delete('/admin/accounts/:id', (c) =>
    handle(c, async () => {
      await deleteAccount(c.req.param('id'));
      return c.json({ ok: true });
    }),
  );
