const appConfig = require('./app.json');

const expoConfig = appConfig.expo ?? {};
const resolvedSlug =
  process.env.EXPO_APP_SLUG ??
  process.env.EAS_PROJECT_SLUG ??
  expoConfig.slug;
const projectId =
  process.env.EAS_PROJECT_ID ?? expoConfig.extra?.eas?.projectId;

const extra = { ...expoConfig.extra };
if (projectId) {
  extra.eas = { ...extra.eas, projectId };
}

module.exports = {
  ...expoConfig,
  slug: resolvedSlug,
  extra,
};
