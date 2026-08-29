// Sentry Metro wrapper: unique Debug IDs on bundles/source maps.
const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

const PROBE_MODULES =
  /(?:^|\/)(?:you-dev-tools|sentry-test-card|push-test-card)(?:\.(?:tsx?|jsx?))?$/;
const PROBE_STUB = path.resolve(__dirname, 'src/components/dev-probes-stub.ts');
const previousResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const normalized = String(moduleName).replace(/\\/g, '/');
  if (process.env.NODE_ENV === 'production' && PROBE_MODULES.test(normalized)) {
    return { type: 'sourceFile', filePath: PROBE_STUB };
  }
  if (typeof previousResolve === 'function') {
    return previousResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
