# lzo.ts

a simple ~1.4 kB minified and gzipped implementation of the lzo1x codec written in TypeScript

## Installation & Usage

### Node.js

Install the package using your desired package manager.

lzo.ts is fully compatible with yarn, pnpm, deno and bun.

```bash
npm install lzo-ts
```

```ts
import { LZO } from 'lzo-ts';

const input = new TextEncoder().encode('Hello world!');

const compressed = LZO.compress(input);

const decompressed = LZO.decompress(compressed);

console.log(decompressed); // Returns "Hello world!"
```

### Web environment

If you are using the library in a web environment, you can include it directly from a CDN of your choice.

```html
<script src="https://www.unpkg.com/lzo-ts"></script>
<script>
	const { LZO } = lzoTs;

	LZO.compress(/*...*/);
	LZO.decompress(/*...*/);
</script>
```

## Credits

Based on the efforts of

- abraidwood's [JavaScript implementation](https://github.com/abraidwood/minilzo-js) and
- zzattack's [C# implementation](https://github.com/zzattack/MiniLZO).

As well as the original work of [Markus F.X.J. Oberhumer](https://www.oberhumer.com/opensource/lzo/#minilzo).

## License

This project is licensed under the GPL-3.0 license, compatible with the original GPL-2.0 licensed code it utilizes.
