import { env } from '../env.ts';

const BUCKET = 'photos';

/**
 * Minimal Storage client for the API (M2 account deletion; M4 adds uploads and
 * signed URLs). Only server code uses the service-role key.
 */
const headers = (): Record<string, string> => ({
  apikey: env.supabaseServiceKey(),
  authorization: `Bearer ${env.supabaseServiceKey()}`,
  'content-type': 'application/json',
});

/** Deletes the given object paths in batches (Storage caps a delete request). */
export const deleteObjects = async (paths: string[]): Promise<void> => {
  const unique = [...new Set(paths.filter(Boolean))];
  const batchSize = 100;
  for (let index = 0; index < unique.length; index += batchSize) {
    const prefixes = unique.slice(index, index + batchSize);
    const response = await fetch(`${env.supabaseUrl()}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ prefixes }),
    });
    if (!response.ok) {
      throw new Error(`Storage delete failed (${response.status}): ${await response.text()}`);
    }
  }
};
