/** Public Supabase configuration; the service-role key never reaches the browser. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isAuthConfigured = (): boolean => supabaseUrl !== '' && supabaseKey !== '';
