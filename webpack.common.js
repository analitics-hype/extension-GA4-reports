const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');
const { loadExtensionEnv } = require('./webpack.env.js');

/** Shared webpack config — pass mode: 'development' | 'production' */
module.exports = function createCommonConfig(mode) {
  const env = loadExtensionEnv(mode);

  return {
    entry: {
      popup: './src/popup/popup.js',
      content: './src/content/content.js',
      background: './src/background/background.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name][ext]',
          },
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin({
        cleanStaleWebpackAssets: false,
      }),
      new CopyPlugin({
        patterns: [
          { from: './src/manifest.json' },
          {
            from: './src/images',
            to: 'images',
            noErrorOnMissing: true,
          },
        ],
      }),
      new HtmlWebpackPlugin({
        template: './src/popup/popup.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        template: './src/popup/disabled.html',
        filename: 'disabled.html',
        chunks: [],
      }),
      new webpack.DefinePlugin({
        'process.env.API_URL': JSON.stringify(env.API_URL),
        'process.env.DASHBOARD_URL': JSON.stringify(env.DASHBOARD_URL),
        'process.env.EXTENSION_ENV': JSON.stringify(env.EXTENSION_ENV),
      }),
    ],
  };
};
