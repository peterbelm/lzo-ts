# lzo.ts

a simple ~1.3 kB minified and gzipped implementation of the lzo1x codec written in TypeScript

## Installation

Install the package using your desired package manager.

lzo.ts is fully compatible with yarn, pnpm, deno and bun.

```bash
$ npm install lzo-ts
```

## Usage

```ts
import { LZO } from 'node-ts';

const input = 'Compress me!';

const compressed = LZO.compress(input);

const decompressed = LZO.decompress(compressed);

console.log(decompressed); // Returns "Compress me!"
```

## Credits

Based on the efforts of

- abraidwood's [JavaScript implementation](https://github.com/abraidwood/minilzo-js) and
- zzattack's [C# implementation](https://github.com/zzattack/MiniLZO).

As well as the original work of [Markus F.X.J. Oberhumer](https://www.oberhumer.com/opensource/lzo/#minilzo).

## License

This project is licensed under the GPL-3.0 license, compatible with the original GPL-2.0 licensed code it utilizes.
