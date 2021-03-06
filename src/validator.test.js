const test = require('ava');

const {validatePages} = require('./validator');

test('validatePages should throw on link to non-existing page', async t => {
	const host = {
		readFile: () => Promise.resolve(`
			<html>
			<body>
				<a href="/does/not/exist">link</a>
			</body>
			</html>
		`)
	};

	await t.throws(validatePages(host, 'destination', ['destination/file1.html'], undefined));
});

test('validatePages should not throw on link to existing page', async t => {
	const host = {
		readFile: filename => {
			if (filename === '') {
				return Promise.resolve(`
					<html>
					<body>
						<a href="./does/exist">link</a>
					</body>
					</html>
				`);
			}
			return Promise.resolve('');
		}
	};

	await t.notThrows(validatePages(host, 'destination', ['destination/file1.html', 'destination/does/exist/index.html'], undefined));
});
