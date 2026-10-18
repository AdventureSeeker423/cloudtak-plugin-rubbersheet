import assert from 'node:assert/strict';
import test from 'node:test';
import { errorMessage } from '../lib/api-error.ts';

test('errorMessage returns the plain text body', () => {
    assert.equal(errorMessage('  Forbidden by policy \n', 'fallback'), 'Forbidden by policy');
});

test('errorMessage prefers the JSON message', () => {
    assert.equal(errorMessage('{"status":403,"message":"No write access"}', 'fallback'), 'No write access');
});

test('errorMessage falls back when the body is empty', () => {
    assert.equal(errorMessage('', 'Upload failed (404)'), 'Upload failed (404)');
    assert.equal(errorMessage('  \n', 'Upload failed (404)'), 'Upload failed (404)');
});

test('errorMessage keeps JSON without a message as text', () => {
    assert.equal(errorMessage('{"status":500}', 'fallback'), '{"status":500}');
    assert.equal(errorMessage('null', 'fallback'), 'null');
});
