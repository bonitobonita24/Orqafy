module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [
      ["@nozbe/watermelondb/babel/plugin"],
      "react-native-reanimated/plugin",
    ],
  };
};
