'use strict';

const { AdharError, HttpError, suggest } = require('./errors.js');

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PARTS = ['body', 'query', 'params'];
const TYPES = ['string', 'number', 'integer', 'boolean', 'email', 'array', 'object'];
// Names people bring from other tools, mapped to the type they mean.
const TYPE_ALIASES = { int: 'integer', bool: 'boolean', str: 'string', text: 'string', float: 'number', list: 'array' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function didYouMean(name, candidates, fallback) {
    const close = typeof name === 'string' ? suggest(name, candidates) : null;
    return close ? `Did you mean \`${close}\`?` : fallback;
}

// Checks the `schema` export of a route file once, at startup, and turns
// { POST: { body: { name: 'string', age: 'number?' } } } into lists of field rules.
function compileSchema(route) {
    const { schema, file } = route;
    if (schema === undefined) return {};

    const fail = (message, hint) => new AdharError({ file, message, hint });
    const example = "Write it like `export const schema = { POST: { body: { name: 'string' } } };`.";

    if (!isPlainObject(schema)) throw fail('`schema` must be an object.', example);

    const paramNames = route.segments.filter((segment) => segment.type === 'param').map((segment) => segment.name);
    const compiled = {};

    for (const [method, parts] of Object.entries(schema)) {
        if (!METHODS.includes(method)) {
            throw fail(
                `Unknown method \`${method}\` in \`schema\`.`,
                didYouMean(method, METHODS, 'The keys of `schema` are method names: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.'),
            );
        }
        if (!route.handlers[method]) {
            throw fail(
                `\`schema\` has rules for \`${method}\`, but this file does not export \`${method}\`.`,
                `Add \`export function ${method}(ctx) { ... }\`, or remove \`${method}\` from \`schema\`.`,
            );
        }
        if (!isPlainObject(parts)) throw fail(`\`schema.${method}\` must be an object.`, example);

        compiled[method] = [];
        for (const [part, fields] of Object.entries(parts)) {
            if (!PARTS.includes(part)) {
                throw fail(
                    `Unknown key \`${part}\` in \`schema.${method}\`.`,
                    didYouMean(part, PARTS, 'Use `body`, `query` or `params`.'),
                );
            }
            if (part === 'body' && (method === 'GET' || method === 'DELETE')) {
                throw fail(
                    `\`schema.${method}.body\` is not allowed: a ${method} request has no body.`,
                    'Use `query` for values in the URL.',
                );
            }
            if (!isPlainObject(fields)) throw fail(`\`schema.${method}.${part}\` must be an object.`, example);

            const rules = [];
            for (const [name, spec] of Object.entries(fields)) {
                const where = `\`schema.${method}.${part}.${name}\``;
                const optional = typeof spec === 'string' && spec.endsWith('?');
                const type = optional ? spec.slice(0, -1) : spec;

                if (!TYPES.includes(type)) {
                    const alias = Object.hasOwn(TYPE_ALIASES, type) ? TYPE_ALIASES[type] : null;
                    throw fail(
                        `Unknown type ${JSON.stringify(spec) ?? String(spec)} for ${where}.`,
                        alias
                            ? `Did you mean \`${alias}\`?`
                            : didYouMean(type, TYPES, `The types are: ${TYPES.join(', ')}. Add \`?\` to make a field optional.`),
                    );
                }
                if (part !== 'body' && (type === 'object' || (type === 'array' && part === 'params'))) {
                    throw fail(`${where} cannot be \`${type}\`: values in the URL are text.`);
                }
                if (part === 'params' && !paramNames.includes(name)) {
                    throw fail(
                        `${where} is not part of this route's path.`,
                        paramNames.length > 0
                            ? `This route has: ${paramNames.map((param) => `\`${param}\``).join(', ')}.`
                            : 'This route has no `[name]` folder in its path.',
                    );
                }
                rules.push({ name, type, optional });
            }
            compiled[method].push({ part, rules });
        }
    }
    return compiled;
}

// Each check returns [value] when the input is fine, or a message when it is not.
// `fromUrl` is true for query and params, where everything arrives as text.
function check(type, value, fromUrl) {
    switch (type) {
        case 'string':
            if (typeof value !== 'string') return 'must be a string';
            return [value];
        case 'email':
            if (typeof value !== 'string' || !EMAIL.test(value)) return 'must be a valid email';
            return [value];
        case 'number': {
            const number = fromUrl && typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
            if (typeof number !== 'number' || !Number.isFinite(number)) return 'must be a number';
            return [number];
        }
        case 'integer': {
            const number = fromUrl && typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
            if (!Number.isSafeInteger(number)) return 'must be a whole number';
            return [number];
        }
        case 'boolean': {
            if (fromUrl && value === 'true') return [true];
            if (fromUrl && value === 'false') return [false];
            if (typeof value !== 'boolean') return 'must be true or false';
            return [value];
        }
        case 'array':
            // In a query, `?tag=a` is a list of one.
            if (fromUrl && typeof value === 'string') return [[value]];
            if (!Array.isArray(value)) return 'must be a list';
            return [value];
        default:
            if (!isPlainObject(value)) return 'must be an object';
            return [value];
    }
}

function checkPart({ part, rules }, input, errors) {
    const fromUrl = part !== 'body';
    // Params keep every value; body and query keep only the fields the schema names.
    const output = part === 'params' ? { ...input } : {};

    if (part === 'body' && input !== undefined && !isPlainObject(input)) {
        errors.body = 'must be an object';
        return input;
    }

    for (const { name, type, optional } of rules) {
        const value = input && Object.hasOwn(input, name) ? input[name] : undefined;
        const missing = value === undefined || value === null || (fromUrl && value === '');

        if (missing) {
            if (!optional) errors[name] = 'is required';
            continue;
        }
        if (type === 'string' && value === '' && !optional) {
            errors[name] = 'must not be empty';
            continue;
        }

        const result = check(type, value, fromUrl);
        if (typeof result === 'string') {
            errors[name] = result;
        } else {
            output[name] = result[0];
        }
    }
    return output;
}

// Runs just before the handler: fixes up ctx.body, ctx.query and ctx.params, or throws a 422.
function applySchema(checks, ctx) {
    if (!checks) return;

    const errors = {};
    const cleaned = {};
    for (const partCheck of checks) {
        cleaned[partCheck.part] = checkPart(partCheck, ctx[partCheck.part], errors);
    }

    if (Object.keys(errors).length > 0) {
        throw new HttpError(422, 'Validation failed', { fields: errors });
    }
    Object.assign(ctx, cleaned);
}

module.exports = { TYPES, compileSchema, applySchema };
