'use strict';

class AdharError extends Error {
    constructor({ file, line, message, hint }) {
        super(message);
        this.name = 'AdharError';
        this.file = file;
        this.line = line;
        this.hint = hint;
    }
}

function levenshtein(a, b) {
    const left = Array.from(a);
    const right = Array.from(b);
    let previous = Array.from({ length: right.length + 1 }, (_, i) => i);

    for (let i = 1; i <= left.length; i++) {
        const current = [i];
        for (let j = 1; j <= right.length; j++) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + cost,
            );
        }
        previous = current;
    }
    return previous[right.length];
}

function suggest(name, candidates) {
    const limit = Math.max(2, Math.ceil(name.length / 3));
    let best = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
        const distance = levenshtein(name.toLowerCase(), candidate.toLowerCase());
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }
    return bestDistance <= limit ? best : null;
}

function formatLocation({ file, line }) {
    if (!file) return '';
    return line ? `${file}:${line}` : file;
}

function indentContinuation(text, prefix) {
    const padding = ' '.repeat(prefix.length);
    return text.split('\n').map((part, i) => (i === 0 ? prefix + part : padding + part));
}

// Returns the diagnostic as plain lines; colouring and the leading icon belong to the CLI.
function formatDiagnostic(diagnostic) {
    const lines = [formatLocation(diagnostic), '  ' + diagnostic.message];

    if (diagnostic.hint) {
        lines.push('');
        lines.push(...indentContinuation(diagnostic.hint, '  Hint: '));
    }
    return lines;
}

module.exports = {
    AdharError,
    levenshtein,
    suggest,
    formatLocation,
    formatDiagnostic,
};
