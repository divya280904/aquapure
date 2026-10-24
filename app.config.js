
const staticConfig = require("./app.json").expo;

module.exports = ({ config }) => ({
  ...config,
  ...staticConfig,
  android: {
    ...config.android,
    ...staticConfig.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ||
      staticConfig.android.googleServicesFile ||
      "./google-services.json",
  },
});
