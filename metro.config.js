// Sentry Metro wrapper: unique Debug IDs on bundles/source maps.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Pre-launch: crash/push probe modules (you-dev-tools, sentry-test-card,
// push-test-card) ship in production so they work over OTA. Re-add the
// production probe stub before signup_mode goes public — see PROJECT_CONTEXT.md
// "Pre-launch re-gating checklist".

module.exports = config;
