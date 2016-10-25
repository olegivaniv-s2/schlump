const vm = require('vm');
const path = require('path');
const sander = require('sander');
const React = require('react');
const ReactDOM = require('react-dom/server');
const matter = require('gray-matter');
const chalk = require('chalk');
const figures = require('figures');
const {oneLine} = require('common-tags');

const {transformJsx, evaluateHelpers} = require('./jsx');
const {validatePages} = require('./validator');

module.exports = {
	renderPages
};

function getDestinationPath(filepath, dest) {
	let destinationpath = path.join(dest, filepath.replace(/src\/pages/, ''));
	if (!path.extname(destinationpath)) {
		destinationpath += '/index.html';
	}
	return destinationpath;
}

/**
 * Renders all given pages as static HTML into the destination folder.
 *
 * @param {string[]} filepaths Input files to generate
 * @param {string} dest Path to write files to
 * @param {any} {components, vars, statics}
 *                 components
 *                 vars key-value pairs of globals
 *                 statics list of all available static files
 * @returns
 */
function renderPages(filepaths, dest, {components, vars, statics}) {
	console.log(`\nGenerating pages...`);
	return Promise.all(filepaths.map(filepath => {
		let destinationPath;
		return sander.readFile(filepath)
			.then(content => {
				const parsed = matter(content.toString());
				destinationPath = getDestinationPath(parsed.data.route || filepath, dest);
				const {helpers, statement} = transformJsx(parsed.content);
				const sandbox = Object.assign(
					{},
					components,
					evaluateHelpers(helpers),
					{
						global: new Proxy(Object.assign({}, vars), {
							get: (target, name) => {
								console.warn('  ' + oneLine`${chalk.bold.red(figures.warning)} Use of ${chalk.bold(`global.${name}`)}
									in page ${filepath} is deprecated. Use ${chalk.bold(`props.${name}`)} instead.`);
								return target[name];
							}
						}),
						props: vars,
						frontmatter: parsed.data,
						React,
						__html__: undefined
					}
				);
				const opts = {
					filename: filepath,
					displayErrors: true
				};
				vm.runInNewContext('__html__ = ' + statement, sandbox, opts);
				return '<!DOCTYPE html>' + ReactDOM.renderToStaticMarkup(sandbox.__html__);
			})
			.then(html => sander.writeFile(destinationPath, html))
			.then(() => console.log(`  ${chalk.bold.green(figures.tick)} ${filepath} -> ${destinationPath}`))
			.then(() => destinationPath);
	}))
	.then(files => validatePages(dest, files, statics));
}
