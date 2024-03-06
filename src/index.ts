/**
 * Compress and decompress data using the LZO1X-1 algorithm.
 *
 * Derived from https://github.com/abraidwood/minilzo-js
 *
 * @author Alistair Braidwood (abraidwood), Markus F.X.J. Oberhumer
 * @license GPL-3.0
 */
export class LZO {
	private _blockSize = 128 * 1024;

	public get blockSize() {
		return this._blockSize;
	}

	public set blockSize(value) {
		if (value <= 0) throw new Error('Block size must be a positive integer');

		this._blockSize = value;
	}

	private minNewSize = this.blockSize;
	private maxSize = 0;

	private out = new Uint8Array(256 * 1024);
	private cbl = 0;
	private ip_end = 0;
	private op_end = 0;
	private t = 0;

	private inputPointer = 0;
	private outputPointer = 0;
	private matchPosition = 0;
	private matchLength = 0;
	private matchOffset = 0;

	private dv_hi = 0;
	private dv_lo = 0;
	private dindex = 0;

	private index = 0;
	private index2 = 0;

	private tt = 0;
	private v = 0;

	private emptyDictionary = new Uint32Array(16384);
	private dictionary = new Uint32Array(16384);

	private skipToFirstLiteralFunc = false;

	private bufferLength!: number;
	private ip_start!: number;
	private previousInputPointer!: number;
	private ll!: number;
	private ti!: number;

	private buffer!: Uint8Array;

	private extendBuffer() {
		var newBuffer = new Uint8Array(
			this.minNewSize + (this.blockSize - (this.minNewSize % this.blockSize))
		);

		newBuffer.set(this.out);

		this.out = newBuffer;
		this.cbl = this.out.length;
	}

	private matchNext() {
		this.minNewSize = this.outputPointer + 3;

		if (this.minNewSize > this.cbl) this.extendBuffer();

		this.out[this.outputPointer++] = this.buffer[this.inputPointer++];

		if (this.t > 1) {
			this.out[this.outputPointer++] = this.buffer[this.inputPointer++];
			if (this.t > 2) {
				this.out[this.outputPointer++] = this.buffer[this.inputPointer++];
			}
		}

		this.t = this.buffer[this.inputPointer++];
	}

	private matchDone() {
		this.t = this.buffer[this.inputPointer - 2] & 3;

		return this.t;
	}

	private copyMatch() {
		this.t += 2;
		this.minNewSize = this.outputPointer + this.t;
		if (this.minNewSize > this.cbl) {
			this.extendBuffer();
		}

		do {
			this.out[this.outputPointer++] = this.out[this.matchPosition++];
		} while (--this.t > 0);
	}

	private copyFromBuffer() {
		this.minNewSize = this.outputPointer + this.t;
		if (this.minNewSize > this.cbl) {
			this.extendBuffer();
		}

		do {
			this.out[this.outputPointer++] = this.buffer[this.inputPointer++];
		} while (--this.t > 0);
	}

	private match(): boolean | Uint8Array {
		while (true) {
			if (this.t >= 64) {
				this.matchPosition =
					this.outputPointer - 1 - ((this.t >> 2) & 7) - (this.buffer[this.inputPointer++] << 3);
				this.t = (this.t >> 5) - 1;

				this.copyMatch();
			} else if (this.t >= 32) {
				this.t &= 31;

				if (this.t === 0) {
					while (this.buffer[this.inputPointer] === 0) {
						this.t += 255;
						this.inputPointer++;
					}

					this.t += 31 + this.buffer[this.inputPointer++];
				}

				this.matchPosition =
					this.outputPointer -
					1 -
					(this.buffer[this.inputPointer] >> 2) -
					(this.buffer[this.inputPointer + 1] << 6);
				this.inputPointer += 2;

				this.copyMatch();
			} else if (this.t >= 16) {
				this.matchPosition = this.outputPointer - ((this.t & 8) << 11);

				this.t &= 7;

				if (this.t === 0) {
					while (this.buffer[this.inputPointer] === 0) {
						this.t += 255;
						this.inputPointer++;
					}

					this.t += 7 + this.buffer[this.inputPointer++];
				}

				this.matchPosition -=
					(this.buffer[this.inputPointer] >> 2) + (this.buffer[this.inputPointer + 1] << 6);
				this.inputPointer += 2;

				// End reached
				if (this.matchPosition === this.outputPointer) {
					return this.out.subarray(0, this.outputPointer);
				} else {
					this.matchPosition -= 0x4000;
					this.copyMatch();
				}
			} else {
				this.matchPosition =
					this.outputPointer - 1 - (this.t >> 2) - (this.buffer[this.inputPointer++] << 2);

				this.minNewSize = this.outputPointer + 2;

				if (this.minNewSize > this.cbl) {
					this.extendBuffer();
				}

				this.out[this.outputPointer++] = this.out[this.matchPosition++];
				this.out[this.outputPointer++] = this.out[this.matchPosition];
			}

			if (this.matchDone() === 0) {
				return true;
			}

			this.matchNext();
		}
	}

	public decompressBuffer(buffer: Uint8Array): Uint8Array {
		this.buffer = buffer;

		this.ip_end = this.buffer.length;
		this.op_end = this.out.length;
		this.cbl = this.out.length;

		this.t = 0;
		this.inputPointer = 0;
		this.outputPointer = 0;
		this.matchPosition = 0;

		this.skipToFirstLiteralFunc = false;

		if (this.buffer[this.inputPointer] > 17) {
			this.t = this.buffer[this.inputPointer++] - 17;

			if (this.t < 4) {
				this.matchNext();

				const matched = this.match();

				if (matched !== true) return matched as Uint8Array;
			} else {
				this.copyFromBuffer();
				this.skipToFirstLiteralFunc = true;
			}
		}

		while (true) {
			if (!this.skipToFirstLiteralFunc) {
				this.t = this.buffer[this.inputPointer++];

				if (this.t >= 16) {
					const matched = this.match();

					if (matched !== true) return matched as Uint8Array;

					continue;
				} else if (this.t === 0) {
					while (this.buffer[this.inputPointer] === 0) {
						this.t += 255;
						this.inputPointer++;
					}

					this.t += 15 + this.buffer[this.inputPointer++];
				}

				this.t += 3;
				this.copyFromBuffer();
			} else this.skipToFirstLiteralFunc = false;

			this.t = this.buffer[this.inputPointer++];

			if (this.t < 16) {
				this.matchPosition = this.outputPointer - (1 + 0x0800);
				this.matchPosition -= this.t >> 2;
				this.matchPosition -= this.buffer[this.inputPointer++] << 2;

				this.minNewSize = this.outputPointer + 3;

				if (this.minNewSize > this.cbl) {
					this.extendBuffer();
				}

				this.out[this.outputPointer++] = this.out[this.matchPosition++];
				this.out[this.outputPointer++] = this.out[this.matchPosition++];
				this.out[this.outputPointer++] = this.out[this.matchPosition];

				if (this.matchDone() === 0) continue;
				else this.matchNext();
			}

			const matched = this.match();

			if (matched !== true) return matched as Uint8Array;
		}
	}

	private compressCore() {
		this.ip_start = this.inputPointer;
		this.ip_end = this.inputPointer + this.ll - 20;

		this.index2 = this.inputPointer;
		this.ti = this.t;

		this.inputPointer += this.ti < 4 ? 4 - this.ti : 0;
		this.inputPointer += 1 + ((this.inputPointer - this.index2) >> 5);

		while (true) {
			if (this.inputPointer >= this.ip_end) break;

			this.dv_lo = this.buffer[this.inputPointer] | (this.buffer[this.inputPointer + 1] << 8);
			this.dv_hi = this.buffer[this.inputPointer + 2] | (this.buffer[this.inputPointer + 3] << 8);

			this.dindex =
				((((this.dv_lo * 0x429d) >>> 16) + this.dv_hi * 0x429d + this.dv_lo * 0x1824) & 0xffff) >>>
				2;

			this.matchPosition = this.ip_start + this.dictionary[this.dindex];

			this.dictionary[this.dindex] = this.inputPointer - this.ip_start;

			if (
				(this.dv_hi << 16) + this.dv_lo !=
				(this.buffer[this.matchPosition] |
					(this.buffer[this.matchPosition + 1] << 8) |
					(this.buffer[this.matchPosition + 2] << 16) |
					(this.buffer[this.matchPosition + 3] << 24))
			) {
				this.inputPointer += 1 + ((this.inputPointer - this.index2) >> 5);
				continue;
			}

			this.index2 -= this.ti;
			this.ti = 0;
			this.v = this.inputPointer - this.index2;

			if (this.v !== 0) {
				if (this.v <= 3) {
					this.out[this.outputPointer - 2] |= this.v;

					do {
						this.out[this.outputPointer++] = this.buffer[this.index2++];
					} while (--this.v > 0);
				} else {
					if (this.v <= 18) this.out[this.outputPointer++] = this.v - 3;
					else {
						this.tt = this.v - 18;
						this.out[this.outputPointer++] = 0;
						while (this.tt > 255) {
							this.tt -= 255;
							this.out[this.outputPointer++] = 0;
						}
						this.out[this.outputPointer++] = this.tt;
					}

					do {
						this.out[this.outputPointer++] = this.buffer[this.index2++];
					} while (--this.v > 0);
				}
			}

			this.matchLength = 4;

			while (
				this.buffer[this.inputPointer + this.matchLength] ===
				this.buffer[this.matchPosition + this.matchLength]
			) {
				this.matchLength += 1;

				if (
					this.buffer[this.inputPointer + this.matchLength] !==
						this.buffer[this.matchPosition + this.matchLength] ||
					this.inputPointer + this.matchLength >= this.ip_end
				)
					break;
			}

			this.matchOffset = this.inputPointer - this.matchPosition;
			this.inputPointer += this.matchLength;
			this.index2 = this.inputPointer;

			if (this.matchLength <= 8 && this.matchOffset <= 0x0800) {
				this.matchOffset -= 1;

				this.out[this.outputPointer++] =
					((this.matchLength - 1) << 5) | ((this.matchOffset & 7) << 2);
				this.out[this.outputPointer++] = this.matchOffset >> 3;
			} else if (this.matchOffset <= 0x4000) {
				this.matchOffset -= 1;

				if (this.matchLength <= 33) this.out[this.outputPointer++] = 32 | (this.matchLength - 2);
				else {
					this.matchLength -= 33;
					this.out[this.outputPointer++] = 32;

					while (this.matchLength > 255) {
						this.matchLength -= 255;
						this.out[this.outputPointer++] = 0;
					}

					this.out[this.outputPointer++] = this.matchLength;
				}

				this.out[this.outputPointer++] = this.matchOffset << 2;
				this.out[this.outputPointer++] = this.matchOffset >> 6;
			} else {
				this.matchOffset -= 0x4000;

				if (this.matchLength <= 9)
					this.out[this.outputPointer++] =
						16 | ((this.matchOffset >> 11) & 8) | (this.matchLength - 2);
				else {
					this.matchLength -= 9;
					this.out[this.outputPointer++] = 16 | ((this.matchOffset >> 11) & 8);

					while (this.matchLength > 255) {
						this.matchLength -= 255;
						this.out[this.outputPointer++] = 0;
					}

					this.out[this.outputPointer++] = this.matchLength;
				}

				this.out[this.outputPointer++] = this.matchOffset << 2;
				this.out[this.outputPointer++] = this.matchOffset >> 6;
			}
		}

		this.t = this.ll - (this.index2 - this.ip_start - this.ti);
	}

	public compressBuffer(buffer: Uint8Array): Uint8Array {
		this.buffer = buffer;

		this.inputPointer = this.outputPointer = this.t = 0;
		this.outputPointer = 0;
		this.t = 0;

		this.bufferLength = this.buffer.length;

		this.maxSize = this.bufferLength + Math.ceil(this.buffer.length / 16) + 64 + 3;

		if (this.maxSize > this.out.length) {
			this.out = new Uint8Array(this.maxSize);
		}

		while (this.bufferLength > 20) {
			this.ll = this.bufferLength <= 49152 ? this.bufferLength : 49152;

			if ((this.t + this.ll) >> 5 <= 0) {
				break;
			}

			this.dictionary.set(this.emptyDictionary);

			this.previousInputPointer = this.inputPointer;

			this.compressCore();

			this.inputPointer = this.previousInputPointer + this.ll;

			this.bufferLength -= this.ll;
		}

		this.t += this.bufferLength;

		if (this.t > 0) {
			this.index = this.buffer.length - this.t;

			if (this.outputPointer === 0 && this.t <= 238) this.out[this.outputPointer++] = 17 + this.t;
			else if (this.t <= 3) this.out[this.outputPointer - 2] |= this.t;
			else if (this.t <= 18) this.out[this.outputPointer++] = this.t - 3;
			else {
				this.tt = this.t - 18;
				this.out[this.outputPointer++] = 0;

				while (this.tt > 255) {
					this.tt -= 255;
					this.out[this.outputPointer++] = 0;
				}

				this.out[this.outputPointer++] = this.tt;
			}

			do {
				this.out[this.outputPointer++] = this.buffer[this.index++];
			} while (--this.t > 0);
		}

		this.out[this.outputPointer++] = 17;
		this.out[this.outputPointer++] = 0;
		this.out[this.outputPointer++] = 0;

		return this.out.subarray(0, this.outputPointer);
	}

	/**
	 * Compresses the given buffer using the LZO1X-1 algorithm.
	 * @param buffer The buffer to compress.
	 * @returns The compressed buffer.
	 */
	static compress<T = Uint8Array>(buffer: Buffer | Uint8Array | number[] | string): T {
		if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
		return new LZO().compressBuffer(buffer) as T;
	}

	/**
	 * Decompresses the given buffer using the LZO1X-1 algorithm.
	 * @param buffer The buffer to decompress.
	 * @returns The decompressed buffer.
	 */
	static decompress<T = Uint8Array>(buffer: Buffer | Uint8Array | number[] | string): T {
		if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
		return new LZO().decompressBuffer(buffer) as T;
	}
}
