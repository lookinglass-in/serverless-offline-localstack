var webpack = require('webpack');
var path = require('path');
var libraryName = 'library';
var nodeExternals = require('webpack-node-externals');

var UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
var env = process.env.WEBPACK_ENV;

var plugins = [];
var outputFile;
if (env === 'build') {
    plugins.push(new UglifyJsPlugin({minimize: true}));
    outputFile = libraryName + '.min.js';
} else {
    outputFile = libraryName + '.js';
}

var config = {
    entry: {
        index: __dirname + '/src/index.js',
        kinesisConsumer: __dirname + '/src/kinesisConsumer.js',
        localstack: __dirname + '/src/localstack.js'
    },
    // devtool: 'source-map',
    target: 'node',
    node: {
        __dirname: true,
        __filename: true
    },
    output: {
        libraryTarget: 'commonjs',
        path: path.join(__dirname, 'lib'),
        filename: '[name].js',
    },
    externals: [nodeExternals()],
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: 'eslint-loader',
                exclude: [
                    /node_modules/,
                    /bin/,
                    /config/
                ],
                options: {
                    fix: true
                },
                enforce: 'pre'
            },
            {
                test: /(\.jsx|\.js)$/,
                loader: 'babel-loader',
                exclude: /(node_modules|bower_components)/
            }
        ]
    },
    resolve: {
        extensions: ['.js']
    },
    plugins: plugins
};

module.exports = config;