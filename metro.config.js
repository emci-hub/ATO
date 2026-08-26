// Sentry Metro wrapper: unique Debug IDs on bundles/source maps.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
