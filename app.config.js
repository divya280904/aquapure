
const config = require("./app.json");

module.exports = () => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || "./google-services.json";

  return {
    ...config.expo,
    android: {
      ...config.expo.android,
      googleServicesFile,
    },
  };
};
