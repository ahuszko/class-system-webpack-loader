const loaderUtils = require('loader-utils');
const path        = require('path');
const esprima     = require('esprima');
const escodegen   = require('escodegen');
const ASTQ        = require('astq');
const pattern     = /(?:HighEnd\.app\(|HighEnd\.define\()/;

class Loader {

    /**
     * @param config
     * @param config.basepath
     */
    constructor(config = {}) {
        this.basepath = config.basepath;
    }

    static nameToPath(name) {
        return name.split('.').join('/') + '.js';
    }

    static get queries() {
        return [
            '// Property [ / Identifier [ @name == "extend" ] ]',
            '// Property [ / Identifier [ @name == "mixins" ] ]',
            '// Property [ / Identifier [ @name == "requires" ] ]'
        ];
    }

    load(source) {
        return new Promise(resolve => {
            const ast   = esprima.parse(source);
            const astq  = new ASTQ;
            const files = Loader.queries.reduce((files, query) => {
                return files.concat(astq.query(ast, query).reduce((files, node) => {
                    return files.concat(JSON.parse(escodegen.generate(node.value, {
                        format: {
                            quotes: 'double'
                        }
                    })));
                }, []));

                // TODO use classpath instead of basepath
            }, []).map(file => path.join(this.basepath, Loader.nameToPath(file)));

            resolve(files);
        });
    }
}

module.exports = function (source, map) {
    if (pattern.test(source) === false) {
        return source;
    }

    const config   = loaderUtils.getOptions(this) || {};
    const loader   = new Loader(config);
    const callback = this.async();

    loader.load(source).then(files => {
        const requires = files.reduce((output, file) => {
            return output + 'require("' + file + '");\n';
        }, 'require("class-system");\n');

        callback(null, requires + '\n' + source, map);
    }).catch(error => callback(error));
};
