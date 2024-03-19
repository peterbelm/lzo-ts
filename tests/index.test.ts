import { LZO } from '../dist';

import * as assert from 'uvu/assert';
import { test } from 'uvu';

const floor = (value: number): number => {
	return parseFloat(value.toFixed(4));
};

const log = (...args: any[]): void => {
	const reset = '\x1b[0m';
	const color = `\x1b[35m`;

	console.log(`${color}[LOG]${reset}`, ...args);
};

const testingMethod = (input: string | number[] | Uint8Array): Uint8Array => {
	const t0 = performance.now();

	if (typeof input === 'string') input = new TextEncoder().encode(input as string);

	const compressed = LZO.compress(input);

	const t1 = performance.now();

	const decompressed = LZO.decompress(compressed);

	const t2 = performance.now();

	log(`Input length: ${input.length}`);
	log(`${floor(t1 - t0)}ms compression`);
	log(`${floor(t2 - t1)}ms decompression`);
	log(`${floor((compressed.length / decompressed.length) * 100)}% compression ratio`);

	return decompressed;
};

test('Simple text compression and decompression', () => {
	log('Simple text compression and decompression');

	const input = 'Hello, World!';

	const output = new TextDecoder().decode(testingMethod(input));

	assert.is(output, input);
});

test('Random compression and decompression', () => {
	log('Random compression and decompression');

	const input = new Uint8Array(1e7).map(() => Math.floor(Math.random() * 256));

	const output = testingMethod(input);

	assert.equal(input, output);
});

test('Pattern-based compression and decompression', () => {
	log('Pattern-based compression and decompression');

	const input = new Uint8Array(1e7).map((_, i) => i % 256);

	const output = testingMethod(input);

	assert.equal(input, output);
});

test('Empty array compression and decompression', () => {
	log('Empty array compression and decompression');

	const input = new Uint8Array(1e7);

	const output = testingMethod(input);

	assert.equal(input, output);
});

test.before.each(() => {
	console.log('\n');
});

test.run();
