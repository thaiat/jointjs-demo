var path = require("path");
var webpack = require("webpack");

var path = require('path');
var HtmlwebpackPlugin = require('html-webpack-plugin');
console.log(process.env.npm_lifecycle_event);
var PATHS = {
    app: path.join(__dirname, 'client', 'scripts', 'app'),
    build: path.join(__dirname, 'dist')
};


module.exports = {
    module: {
        loaders: [{
            test: /\.css$/,
            loader: "style-loader!css-loader"
        }, {
            test: /\.png$/,
            loader: "url-loader?limit=100000"
        }, {
            test: /\.jpg$/,
            loader: "file-loader"
        }]
    },
    devtool: 'eval-source-map',
    debug: true,
    entry: {
        'bundle': PATHS.app
    },
    output: {
        path: PATHS.build,
        filename: 'bundle.js'
    },
    resolve: {
        root: [path.join(__dirname, "bower_components")]
    },
    devServer: {
        historyApiFallback: true,
        hot: true,
        inline: true,
        progress: true,

        // Display only errors to reduce the amount of output.
        stats: 'errors-only',

        // Parse host and port from env so this is easy to customize.
        host: 'localhost',
        port: 5000
    },
    plugins: [
        new HtmlwebpackPlugin({
            title: 'Kanban app',
            template: 'client/index.html',
            inject: 'body'
        }),
        new webpack.ResolverPlugin(
            new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin("bower.json", ["main"])
        )
    ]
}
