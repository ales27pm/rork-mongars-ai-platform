const appConfig = require("./app.json");

const expoConfig = appConfig.expo ?? {};

// Prefer explicit CI overrides when you intentionally want to change slug per-environment.
const resolvedSlug =
  process.env.EXPO_APP_SLUG ?? process.env.EAS_PROJECT_SLUG ?? expoConfig.slug;

// EAS expects expo.extra.eas.projectId to be the *actual* project ID.
// In CI it's common to accidentally set EAS_PROJECT_ID to something else (slug/name).
// To avoid breaking builds, only accept env var values that look like a real project ID.
const looksLikeUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const rawEnvProjectId = process.env.EAS_PROJECT_ID;
const configProjectId = expoConfig.extra?.eas?.projectId;

const projectId = looksLikeUuid(rawEnvProjectId)
  ? rawEnvProjectId
  : configProjectId;

const extra = { ...(expoConfig.extra ?? {}) };
if (projectId) {
  extra.eas = { ...(extra.eas ?? {}), projectId };
}

module.exports = {
  ...expoConfig,
  slug: resolvedSlug,
  extra,
};