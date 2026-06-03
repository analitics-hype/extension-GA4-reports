const { merge } = require('webpack-merge');
const createCommonConfig = require('./webpack.common.js');

module.exports = merge(createCommonConfig('development'), {
  mode: 'development',
  devtool: 'inline-source-map',
});
