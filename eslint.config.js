// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions is Deno (jsr: imports) — checked by deno / deploy,
    // not by the React Native ESLint config.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
