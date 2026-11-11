'use strict';

const { formatDiagnostic } = require('../core/errors.js');

const COLORS = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
};

function useColor(stream) {
    if (process.env.NO_COLOR) return false;
    return Boolean(stream.isTTY);
}

function paint(stream, color, text) {
    if (!useColor(stream)) return text;
    return COLORS[color] + text + COLORS.reset;
}

function printDiagnostic(icon, label, color, diagnostic) {
    const stream = process.stderr;
    const [location, ...rest] = formatDiagnostic(diagnostic);
    const header = location ? `${icon} ${label}: ${location}` : `${icon} ${label}:`;
    stream.write(paint(stream, color, header) + '\n' + rest.join('\n') + '\n\n');
}

function error(diagnostic) {
    printDiagnostic('✖', 'Error', 'red', diagnostic);
}

function warn(diagnostic) {
    printDiagnostic('⚠', 'Warning', 'yellow', diagnostic);
}

function bug(err) {
    const stream = process.stderr;
    stream.write(paint(stream, 'red', '✖ Unexpected error (probably a bug in Adhar):') + '\n');
    stream.write(String(err && err.stack ? err.stack : err) + '\n');
}

// One line per request: `GET /users 200 3ms`.
function request(method, url, status, milliseconds) {
    const stream = process.stdout;
    const color = status >= 500 ? 'red' : status >= 400 ? 'yellow' : 'green';
    stream.write(`${method} ${url} ${paint(stream, color, String(status))} ${paint(stream, 'dim', milliseconds + 'ms')}\n`);
}

// The details of a 500, which the response hides in production.
function requestError(failed, err) {
    const stream = process.stderr;
    stream.write(paint(stream, 'red', `✖ ${failed.method} ${failed.url}`) + '\n');
    stream.write(String(err && err.stack ? err.stack : err) + '\n\n');
}

// A promise in the user's code failed and nothing was waiting for it.
function unhandled(err) {
    const stream = process.stderr;
    stream.write(paint(stream, 'red', '✖ Unhandled promise rejection:') + '\n');
    stream.write(String(err && err.stack ? err.stack : err) + '\n\n');
}

function info(message) {
    process.stdout.write(message + '\n');
}

function success(message) {
    process.stdout.write(paint(process.stdout, 'green', '✔ ' + message) + '\n');
}

function dim(message) {
    process.stdout.write(paint(process.stdout, 'dim', message) + '\n');
}

module.exports = { error, warn, bug, request, requestError, unhandled, info, success, dim };
