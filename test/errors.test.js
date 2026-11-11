'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AdharError, levenshtein, suggest, formatDiagnostic } = require('../core/errors.js');

test('levenshtein counts insertions, deletions and substitutions', () => {
    assert.equal(levenshtein('', ''), 0);
    assert.equal(levenshtein('users', 'users'), 0);
    assert.equal(levenshtein('uesrs', 'users'), 2);
    assert.equal(levenshtein('user', 'users'), 1);
    assert.equal(levenshtein('kitten', 'sitting'), 3);
});

test('suggest returns the closest name', () => {
    assert.equal(suggest('strat', ['init', 'dev', 'start', 'routes', 'migrate', 'new']), 'start');
    assert.equal(suggest('user', ['users', 'posts']), 'users');
    assert.equal(suggest('get', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']), 'GET');
});

test('suggest returns nothing for distant names', () => {
    assert.equal(suggest('xyzzy', ['init', 'dev', 'start']), null);
    assert.equal(suggest('anything', []), null);
});

test('AdharError keeps file, line and hint', () => {
    const err = new AdharError({
        file: 'routes/users/route.js',
        line: 4,
        message: 'Unknown export `get`.',
        hint: 'Did you mean `GET`?',
    });
    assert.ok(err instanceof Error);
    assert.equal(err.name, 'AdharError');
    assert.equal(err.message, 'Unknown export `get`.');
    assert.equal(err.file, 'routes/users/route.js');
    assert.equal(err.line, 4);
    assert.equal(err.hint, 'Did you mean `GET`?');
});

test('formatDiagnostic puts the location first, then message and hint', () => {
    const lines = formatDiagnostic({
        file: 'routes/users/route.js',
        line: 4,
        message: 'Unknown export `get`.',
        hint: 'Did you mean `GET`?',
    });
    assert.deepEqual(lines, [
        'routes/users/route.js:4',
        '  Unknown export `get`.',
        '',
        '  Hint: Did you mean `GET`?',
    ]);
});

test('formatDiagnostic works without a file, line or hint', () => {
    assert.deepEqual(formatDiagnostic({ message: 'Unknown command `x`.' }), ['', '  Unknown command `x`.']);
    assert.deepEqual(formatDiagnostic({ file: 'routes/route.js', message: 'Broken.' }), [
        'routes/route.js',
        '  Broken.',
    ]);
});

test('formatDiagnostic aligns a hint that has several lines', () => {
    const lines = formatDiagnostic({ message: 'Broken.', hint: 'First line.\nSecond line.' });
    assert.deepEqual(lines.slice(2), ['', '  Hint: First line.', '        Second line.']);
});
