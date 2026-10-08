module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // In the Jest/Node.js environment, nativewind/babel requires Metro's file
    // system and fails. Drop it for tests while keeping babel-preset-expo so
    // JSX, TypeScript, and module resolution still work correctly.
    env: {
      test: {
        presets: [
          ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
        ],
      },
    },
  };
};
