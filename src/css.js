const camelcase = require('camelcase');
const css = require('css');
const decamelize = require('decamelize');

module.exports = {
	createScopedCss,
	combineCss
};

/**
 * Strips scoped style from html and return html and metadata.
 *
 * @param {string} html HTML input source
 * @param {Object|string} scope Namespace for generated classNames
 * @param {string?} filepath Input file path (mainly for debugging)
 * @returns [html: string, CSSOM: {classNames: any, vars: any}, css: string]
 */
function createScopedCss(html, scope, filepath) {
	scope = typeof scope === 'string' ? {ns: scope, vars: new Map()} : scope;

	// https://regex101.com/r/EFULGo/2
	const styleMatcher = /<style(?:.+)scoped(?:.*)>((?:.|[\r\n])*?)<\/style>/i;
	const style = html.match(styleMatcher);
	html = html.replace(styleMatcher, '');
	if (!style) {
		return [html, {classNames: {}, vars: scope.vars}, ''];
	}
	const cssom = css.parse(style[1], {source: filepath});
	cssom.vars = new Map(scope.vars.entries());
	getVariables(cssom).forEach((value, key) => cssom.vars.set(key, value));

	resolveScopeVariables(cssom, cssom.vars);
	const hash = createHash(css.stringify(cssom));
	cssom.classNames = getClassNames(`${scope.ns}-${hash}`, cssom);

	return [html.trim(), cssom, css.stringify(cssom)];
}

function createHash(input) {
	let hash = 0;
	if (input.length === 0) {
		return hash;
	}
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		// Convert to 32bit integer
		hash &= hash;
	}
	return hash;
}

/**
 * Returns a combined CSS from all component CSS and scopedCss.
 *
 * @param {object} templates A map of schlump templates
 * @param {string[]} scopedCss A list of page CSS
 * @returns {string} CSS result
 */
function combineCss(templates, scopedCss) {
	if (!Array.isArray(scopedCss)) {
		scopedCss = [scopedCss];
	}
	return [
		...Object.keys(templates).map(name => templates[name].css),
		...scopedCss
	]
	.join('\n').trim();
}

const toScopedClassName = (ns, selector) => `${decamelize(ns, '-')}-${decamelize(camelcase(selector), '-')}`;

function getClassNames(ns, cssom) {
	return cssom.stylesheet.rules
		.filter(rule => rule.type === 'rule')
		.reduce((rules, rule) => {
			rules = [...rules, ...rule.selectors];
			rule.selectors = rule.selectors.map(selector => `.${toScopedClassName(ns, selector)}`);
			return rules;
		}, [])
		.reduce((classNames, selector) => {
			classNames[camelcase(selector)] = toScopedClassName(ns, selector);
			return classNames;
		}, {});
}

function getDeclarations(cssom) {
	return cssom.stylesheet.rules
		.filter(rule => rule.type === 'rule')
		.reduce((declarations, rule) => [...declarations, ...rule.declarations], [])
		.filter(declaration => declaration.type === 'declaration');
}

function getVariables(cssom) {
	return getDeclarations(cssom)
		.filter(declaration => declaration.property.startsWith('--'))
		.reduce((vars, declaration) => {
			vars.set(declaration.property, declaration.value);
			return vars;
		}, new Map());
}

function resolveScopeVariables(cssom, scope) {
	getDeclarations(cssom)
		.forEach(declaration => {
			scope.forEach((value, variableName) => {
				declaration.value = declaration.value.replace(`var(${variableName})`, value);
			});
		});
}
