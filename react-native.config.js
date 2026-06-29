/** Ensure React Native community autolinking picks up RevenueCat on native builds. */
module.exports = {
  dependencies: {
    "react-native-purchases": {
      platforms: {
        ios: {},
        android: {},
      },
    },
  },
};
