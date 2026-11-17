import {getConnectionString} from '@netlify/database';
import pg from 'pg';

let pool;
export function createHandler(query) {
  return async request => {
    const reply = (body, status = 200) => Response.json(body, {
      status, headers: {'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store'}
    });
    if (request.method !== 'POST') return reply({error: 'Method not allowed'}, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply({error: 'Forbidden'}, 403);
    try {
      const body = await request.text();
      if (body.length > 200) return reply({error: 'Invalid session'}, 400);
      const {sessionId} = JSON.parse(body);
      if (typeof sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        return reply({error: 'Invalid session'}, 400);
      }
      const {rows} = await query('SELECT public.record_visitor($1::uuid) AS total', [sessionId]);
      const total = Number(rows[0].total);
      if (!Number.isSafeInteger(total) || total < 108) throw new Error('Invalid stored total');
      return reply({total});
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) return reply({error: 'Invalid request'}, 400);
      return reply({error: 'Counter unavailable'}, 503);
    }
  };
}
export default createHandler((text, values) => {
  pool ??= new pg.Pool({connectionString: getConnectionString(), max: 2,
    connectionTimeoutMillis: 5000, statement_timeout: 8000, idleTimeoutMillis: 10000});
  return pool.query(text, values);
});
