import { Buffer } from 'node:buffer';
import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function isForbiddenSupabaseKey(key: string): boolean {
  const modernSecretPrefix = ['sb', 'secret'].join('_') + '_';
  if (key.toLowerCase().startsWith(modernSecretPrefix)) return true;

  // Legacy elevated-role keys are JWTs; inspect only the public payload claim.
  const segments = key.split('.');
  if (segments.length !== 3) return false;
  try {
    const claims = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as { role?: unknown };
    return claims.role === ['service', 'role'].join('_');
  } catch {
    return false;
  }
}

// `VITE_*` values are compiled into browser-facing code. Fail the build before bundling if a high-privilege key is supplied.
export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const publishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    fileEnv.VITE_SUPABASE_ANON_KEY?.trim() ||
    '';

  const explicitlyForbiddenNames = [
    'VITE_SUPABASE_SECRET_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
  ];
  const forbiddenNamedKey = explicitlyForbiddenNames.find((name) =>
    Boolean(process.env[name]?.trim() || fileEnv[name]?.trim()),
  );

  if (forbiddenNamedKey || isForbiddenSupabaseKey(publishableKey)) {
    throw new Error(
      `Unsafe Supabase frontend configuration (${forbiddenNamedKey ?? 'publishable-key field'}). VITE_* values are exposed in the browser bundle; use only a publishable/anon key.`,
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
