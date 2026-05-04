/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
    },
  },
};
