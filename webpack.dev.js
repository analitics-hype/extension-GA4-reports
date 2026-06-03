const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_URL': JSON.stringify(
        process.env.API_URL || 'https://backend-ga4-reports-production.up.railway.app/api',
      ),
      'process.env.DASHBOARD_URL': JSON.stringify(
        process.env.DASHBOARD_URL || 'https://www.abtestcalculator.com.tr',
      ),
    }),
  ],
}); 