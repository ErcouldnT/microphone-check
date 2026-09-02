module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ["babel-preset-expo", { jsxImportSource: "nativewind" }],
            "nativewind/babel",
        ],
        plugins: [
            // Drizzle's generated migrations import .sql files directly.
            ["inline-import", { extensions: [".sql"] }],
            "react-native-reanimated/plugin",
        ],
    };
};
