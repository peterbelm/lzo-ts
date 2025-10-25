/**
 * Compress and decompress data using the LZO1X-1 algorithm.
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

	private _minNewSize = this.blockSize;
	private _maxSize = 0;

	private _out = new Uint8Array(256 * 1024);
	private _cbl = 0;
	private _ip_end = 0;
	private _op_end = 0;
	private _t = 0;

	private _inputPointer = 0;
	private _outputPointer = 0;
	private _matchPosition = 0;
	private _matchLength = 0;
	private _matchOffset = 0;

	private _dv_hi = 0;
	private _dv_lo = 0;
	private _dindex = 0;

	private _index = 0;
	private _index2 = 0;

	private _tt = 0;
	private _v = 0;

	private _emptyDictionary = new Uint32Array(16384);
	private _dictionary = new Uint32Array(16384);

	private _skipToFirstLiteralFunc = false;

	private _bufferLength!: number;
	private _ip_start!: number;
	private _previousInputPointer!: number;
	private _ll!: number;
	private _ti!: number;

	private _buffer!: Uint8Array;

	private _extendBuffer() {
		var newBuffer = new Uint8Array(
			this._minNewSize + (this.blockSize - (this._minNewSize % this.blockSize))
		);

		newBuffer.set(this._out);

		this._out = newBuffer;
		this._cbl = this._out.length;
	}

	private _matchNext() {
		this._minNewSize = this._outputPointer + 3;

		if (this._minNewSize > this._cbl) this._extendBuffer();

		this._out[this._outputPointer++] = this._buffer[this._inputPointer++];

		if (this._t > 1) {
			this._out[this._outputPointer++] = this._buffer[this._inputPointer++];
			if (this._t > 2) {
				this._out[this._outputPointer++] = this._buffer[this._inputPointer++];
			}
		}

		this._t = this._buffer[this._inputPointer++];
	}

	private _matchDone() {
		this._t = this._buffer[this._inputPointer - 2] & 3;

		return this._t;
	}

	private _copyMatch() {
		this._t += 2;
		this._minNewSize = this._outputPointer + this._t;
		if (this._minNewSize > this._cbl) {
			this._extendBuffer();
		}

		do {
			this._out[this._outputPointer++] = this._out[this._matchPosition++];
		} while (--this._t > 0);
	}

	private _copyFromBuffer() {
		this._minNewSize = this._outputPointer + this._t;
		if (this._minNewSize > this._cbl) {
			this._extendBuffer();
		}

		do {
			if (this._inputPointer >= this._buffer.length) {
				throw new Error('Invalid LZO compressed data');
			}
			this._out[this._outputPointer++] = this._buffer[this._inputPointer++];
		} while (--this._t > 0);
	}

	private _match(): boolean | Uint8Array {
		while (true) {
			if (this._t >= 64) {
				this._matchPosition =
					this._outputPointer -
					1 -
					((this._t >> 2) & 7) -
					(this._buffer[this._inputPointer++] << 3);
				this._t = (this._t >> 5) - 1;

				this._copyMatch();
			} else if (this._t >= 32) {
				this._t &= 31;

				if (this._t === 0) {
					while (this._buffer[this._inputPointer] === 0) {
						this._t += 255;
						this._inputPointer++;
					}

					this._t += 31 + this._buffer[this._inputPointer++];
				}

				this._matchPosition =
					this._outputPointer -
					1 -
					(this._buffer[this._inputPointer] >> 2) -
					(this._buffer[this._inputPointer + 1] << 6);
				this._inputPointer += 2;

				this._copyMatch();
			} else if (this._t >= 16) {
				this._matchPosition = this._outputPointer - ((this._t & 8) << 11);

				this._t &= 7;

				if (this._t === 0) {
					while (this._buffer[this._inputPointer] === 0) {
						this._t += 255;
						this._inputPointer++;
					}

					this._t += 7 + this._buffer[this._inputPointer++];
				}

				this._matchPosition -=
					(this._buffer[this._inputPointer] >> 2) + (this._buffer[this._inputPointer + 1] << 6);
				this._inputPointer += 2;

				// End reached
				if (this._matchPosition === this._outputPointer) {
					return this._out.subarray(0, this._outputPointer);
				} else {
					this._matchPosition -= 0x4000;
					this._copyMatch();
				}
			} else {
				this._matchPosition =
					this._outputPointer - 1 - (this._t >> 2) - (this._buffer[this._inputPointer++] << 2);

				this._minNewSize = this._outputPointer + 2;

				if (this._minNewSize > this._cbl) {
					this._extendBuffer();
				}

				this._out[this._outputPointer++] = this._out[this._matchPosition++];
				this._out[this._outputPointer++] = this._out[this._matchPosition];
			}

			if (this._matchDone() === 0) {
				return true;
			}

			this._matchNext();
		}
	}

	public _decompressBuffer(buffer: Uint8Array): Uint8Array {
		this._buffer = buffer;

		this._ip_end = this._buffer.length;
		this._op_end = this._out.length;
		this._cbl = this._out.length;

		this._t = 0;
		this._inputPointer = 0;
		this._outputPointer = 0;
		this._matchPosition = 0;

		this._skipToFirstLiteralFunc = false;

		if (this._buffer[this._inputPointer] > 17) {
			this._t = this._buffer[this._inputPointer++] - 17;

			if (this._t < 4) {
				this._matchNext();

				const matched = this._match();

				if (matched !== true) return matched as Uint8Array;
			} else {
				this._copyFromBuffer();
				this._skipToFirstLiteralFunc = true;
			}
		}

		while (true) {
			if (!this._skipToFirstLiteralFunc) {
				this._t = this._buffer[this._inputPointer++];

				if (this._t >= 16) {
					const matched = this._match();

					if (matched !== true) return matched as Uint8Array;

					continue;
				} else if (this._t === 0) {
					while (this._buffer[this._inputPointer] === 0) {
						this._t += 255;
						this._inputPointer++;
					}

					this._t += 15 + this._buffer[this._inputPointer++];
				}

				this._t += 3;
				this._copyFromBuffer();
			} else this._skipToFirstLiteralFunc = false;

			this._t = this._buffer[this._inputPointer++];

			if (this._t < 16) {
				this._matchPosition = this._outputPointer - (1 + 0x0800);
				this._matchPosition -= this._t >> 2;
				this._matchPosition -= this._buffer[this._inputPointer++] << 2;

				this._minNewSize = this._outputPointer + 3;

				if (this._minNewSize > this._cbl) {
					this._extendBuffer();
				}

				this._out[this._outputPointer++] = this._out[this._matchPosition++];
				this._out[this._outputPointer++] = this._out[this._matchPosition++];
				this._out[this._outputPointer++] = this._out[this._matchPosition];

				if (this._matchDone() === 0) continue;
				else this._matchNext();
			}

			const matched = this._match();

			if (matched !== true) return matched as Uint8Array;
		}
	}

	_compressCore() {
		this._ip_start = this._inputPointer;
		this._ip_end = this._inputPointer + this._ll - 20;

		this._index2 = this._inputPointer;
		this._ti = this._t;

		this._inputPointer += this._ti < 4 ? 4 - this._ti : 0;
		this._inputPointer += 1 + ((this._inputPointer - this._index2) >> 5);

		while (true) {
			if (this._inputPointer >= this._ip_end) break;

			this._dv_lo = this._buffer[this._inputPointer] | (this._buffer[this._inputPointer + 1] << 8);
			this._dv_hi =
				this._buffer[this._inputPointer + 2] | (this._buffer[this._inputPointer + 3] << 8);

			this._dindex =
				((((this._dv_lo * 0x429d) >>> 16) + this._dv_hi * 0x429d + this._dv_lo * 0x1824) &
					0xffff) >>>
				2;

			this._matchPosition = this._ip_start + this._dictionary[this._dindex];

			this._dictionary[this._dindex] = this._inputPointer - this._ip_start;

			if (
				(this._dv_hi << 16) + this._dv_lo !=
				(this._buffer[this._matchPosition] |
					(this._buffer[this._matchPosition + 1] << 8) |
					(this._buffer[this._matchPosition + 2] << 16) |
					(this._buffer[this._matchPosition + 3] << 24))
			) {
				this._inputPointer += 1 + ((this._inputPointer - this._index2) >> 5);
				continue;
			}

			this._index2 -= this._ti;
			this._ti = 0;
			this._v = this._inputPointer - this._index2;

			if (this._v !== 0) {
				if (this._v <= 3) {
					this._out[this._outputPointer - 2] |= this._v;

					do {
						this._out[this._outputPointer++] = this._buffer[this._index2++];
					} while (--this._v > 0);
				} else {
					if (this._v <= 18) this._out[this._outputPointer++] = this._v - 3;
					else {
						this._tt = this._v - 18;
						this._out[this._outputPointer++] = 0;
						while (this._tt > 255) {
							this._tt -= 255;
							this._out[this._outputPointer++] = 0;
						}
						this._out[this._outputPointer++] = this._tt;
					}

					do {
						this._out[this._outputPointer++] = this._buffer[this._index2++];
					} while (--this._v > 0);
				}
			}

			this._matchLength = 4;

			while (
				this._buffer[this._inputPointer + this._matchLength] ===
				this._buffer[this._matchPosition + this._matchLength]
			) {
				this._matchLength += 1;

				if (
					this._buffer[this._inputPointer + this._matchLength] !==
						this._buffer[this._matchPosition + this._matchLength] ||
					this._inputPointer + this._matchLength >= this._ip_end
				)
					break;
			}

			this._matchOffset = this._inputPointer - this._matchPosition;
			this._inputPointer += this._matchLength;
			this._index2 = this._inputPointer;

			if (this._matchLength <= 8 && this._matchOffset <= 0x0800) {
				this._matchOffset -= 1;

				this._out[this._outputPointer++] =
					((this._matchLength - 1) << 5) | ((this._matchOffset & 7) << 2);
				this._out[this._outputPointer++] = this._matchOffset >> 3;
			} else if (this._matchOffset <= 0x4000) {
				this._matchOffset -= 1;

				if (this._matchLength <= 33)
					this._out[this._outputPointer++] = 32 | (this._matchLength - 2);
				else {
					this._matchLength -= 33;
					this._out[this._outputPointer++] = 32;

					while (this._matchLength > 255) {
						this._matchLength -= 255;
						this._out[this._outputPointer++] = 0;
					}

					this._out[this._outputPointer++] = this._matchLength;
				}

				this._out[this._outputPointer++] = this._matchOffset << 2;
				this._out[this._outputPointer++] = this._matchOffset >> 6;
			} else {
				this._matchOffset -= 0x4000;

				if (this._matchLength <= 9)
					this._out[this._outputPointer++] =
						16 | ((this._matchOffset >> 11) & 8) | (this._matchLength - 2);
				else {
					this._matchLength -= 9;
					this._out[this._outputPointer++] = 16 | ((this._matchOffset >> 11) & 8);

					while (this._matchLength > 255) {
						this._matchLength -= 255;
						this._out[this._outputPointer++] = 0;
					}

					this._out[this._outputPointer++] = this._matchLength;
				}

				this._out[this._outputPointer++] = this._matchOffset << 2;
				this._out[this._outputPointer++] = this._matchOffset >> 6;
			}
		}

		this._t = this._ll - (this._index2 - this._ip_start - this._ti);
	}

	_compressBuffer(buffer: Uint8Array): Uint8Array {
		this._buffer = buffer;

		this._inputPointer = this._outputPointer = this._t = 0;
		this._outputPointer = 0;
		this._t = 0;

		this._bufferLength = this._buffer.length;

		this._maxSize = this._bufferLength + Math.ceil(this._buffer.length / 16) + 64 + 3;

		if (this._maxSize > this._out.length) {
			this._out = new Uint8Array(this._maxSize);
		}

		while (this._bufferLength > 20) {
			this._ll = this._bufferLength <= 49152 ? this._bufferLength : 49152;

			if ((this._t + this._ll) >> 5 <= 0) {
				break;
			}

			this._dictionary.set(this._emptyDictionary);

			this._previousInputPointer = this._inputPointer;

			this._compressCore();

			this._inputPointer = this._previousInputPointer + this._ll;

			this._bufferLength -= this._ll;
		}

		this._t += this._bufferLength;

		if (this._t > 0) {
			this._index = this._buffer.length - this._t;

			if (this._outputPointer === 0 && this._t <= 238)
				this._out[this._outputPointer++] = 17 + this._t;
			else if (this._t <= 3) this._out[this._outputPointer - 2] |= this._t;
			else if (this._t <= 18) this._out[this._outputPointer++] = this._t - 3;
			else {
				this._tt = this._t - 18;
				this._out[this._outputPointer++] = 0;

				while (this._tt > 255) {
					this._tt -= 255;
					this._out[this._outputPointer++] = 0;
				}

				this._out[this._outputPointer++] = this._tt;
			}

			do {
				this._out[this._outputPointer++] = this._buffer[this._index++];
			} while (--this._t > 0);
		}

		this._out[this._outputPointer++] = 17;
		this._out[this._outputPointer++] = 0;
		this._out[this._outputPointer++] = 0;

		return this._out.subarray(0, this._outputPointer);
	}

	/**
	 * Compresses the given buffer using the LZO1X-1 algorithm.
	 * @param buffer The buffer to compress.
	 * @returns The compressed buffer.
	 */
	static compress<T = Uint8Array>(buffer: Uint8Array | number[]): T {
		return new LZO()._compressBuffer(buffer as Uint8Array) as T;
	}

	/**
	 * Decompresses the given buffer using the LZO1X-1 algorithm.
	 * @param buffer The buffer to decompress.
	 * @returns The decompressed buffer.
	 */
	static decompress<T = Uint8Array>(buffer: Uint8Array | number[]): T {
		return new LZO()._decompressBuffer(buffer as Uint8Array) as T;
	}
}
