/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require("./app.json");

module.exports = {
  expo: {
    ...appJson.expo,
    /** Must match the Expo project slug tied to extra.eas.projectId (EAS build). */
    slug: "saycart",
    extra: {
      ...(appJson.expo.extra ?? {}),
      eas: {
        ...(appJson.expo.extra?.eas ?? {}),
        projectId: "fdb85394-385c-43ac-aea8-526bbc6a1749",
      },
    },
  },
};
