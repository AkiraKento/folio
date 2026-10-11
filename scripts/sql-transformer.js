/* eslint-disable @typescript-eslint/no-require-imports */
const upstreamTransformer = require('@expo/metro-config/babel-transformer');

module.exports.transform = function ({ src, filename, options }) {
  if (filename.endsWith('.sql')) {
    return upstreamTransformer.transform({
      src: `module.exports = ${JSON.stringify(src)};`,
      filename,
      options,
    });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
