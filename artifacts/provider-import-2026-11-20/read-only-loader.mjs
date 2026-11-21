// Read-only module loader (evidence probing only) — mirrors the precedent of
// dsh-floating-accounts/scripts/runtime-loader.mjs (DSH_CHECKOUT + createRequire).
// This probe does NOT import or execute any host module; the hook only redirects
// @deepseek-ai/* specifiers against the DSH checkout if an import were attempted.
// It never writes and never touches the network.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const host = process.env.DSH_CHECKOUT;
export async function resolve(specifier, context, nextResolve) {
  if (host && specifier.startsWith('@deepseek-ai/')) {
    try {
      const require = createRequire(host.replace(/[\\/]+$/, '') + '/package.json');
      return { url: pathToFileURL(require.resolve(specifier)).href, shortCircuit: true };
    } catch {}
  }
  return nextResolve(specifier, context);
}
