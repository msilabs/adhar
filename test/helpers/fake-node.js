'use strict';

Object.defineProperty(process, 'versions', {
    value: { ...process.versions, node: process.env.FAKE_NODE_VERSION },
});
