import { describe, expect, it } from 'vitest';
import { DEFAULT_WEB_ORIGIN, resolveWebOrigins } from './cors.js';

describe('resolveWebOrigins', () => {
  it.each([
    [undefined, DEFAULT_WEB_ORIGIN],
    ['', DEFAULT_WEB_ORIGIN],
    ['  ', DEFAULT_WEB_ORIGIN],
    ['https://preview.example.com', 'https://preview.example.com'],
    [' https://preview.example.com ', 'https://preview.example.com'],
    ['https://main.example.com, https://preview.example.com', ['https://main.example.com', 'https://preview.example.com']],
    ['https://main.example.com,, https://preview.example.com, ', ['https://main.example.com', 'https://preview.example.com']],
  ])('normaliza %j como %j', (value, expected) => {
    expect(resolveWebOrigins(value)).toEqual(expected);
  });
});
