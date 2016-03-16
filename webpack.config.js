
var path = require('path'),
babelPresets = ['es2015'];

module.exports = {
    context: path.join(__dirname, 'src', 'public'),
    entry: {
        theme: './js/theme'
    },
    output: {
        path: path.join(__dirname, 'src', 'public', 'js'),
        filename: '[name].bundle.js'
    },
    module: {
        loaders: [
            {
                test: path.join(__dirname, 'src', 'public', 'js'),
                loader: 'babel-loader'
            }
        ]
    },
    devtool: 'source-map',
    debug: true
};
