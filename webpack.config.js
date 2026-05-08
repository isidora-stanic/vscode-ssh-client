/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
const config = {
  target: 'node',
  mode: 'none',

  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    // VS Code API is provided by the host
    vscode: 'commonjs vscode',
    // ssh2 uses native addons — keep it out of the bundle
    'cpu-features': 'commonjs cpu-features',
    'sshcrypto.node': 'commonjs sshcrypto.node',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: ['ts-loader'],
      },
      {
        // Pass through native .node addons unchanged
        test: /\.node$/,
        use: 'node-loader',
      },
    ],
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
};

module.exports = config;
