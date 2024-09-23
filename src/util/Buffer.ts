import ReadonlyUint8Array from "../types/ReadonlyUint8Array.js"
import encoding from "./text.js"
import { findLength } from "./varuint.js"

declare global {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface ArrayBuffer {
        resize: (byteLength: number) => void
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface SharedArrayBuffer {
        resize: (byteLength: number) => void
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface ArrayBufferConstructor {
        // eslint-disable-next-line @typescript-eslint/prefer-function-type
        new (byteLength: number, options?: { maxByteLength?: number }): ArrayBuffer
    }
}

class Buffer {
    private constructor (view: Uint8Array) {
        this.#view = view
        this.buffer = view.buffer
        this.length = view.length
        // this.lengthLastMean = view.length
    }

    length: number

    slice (start?: number, end?: number) {
        return this.#view.slice(start, end)
    }

    subarray (start?: number, end?: number) {
        return this.#view.subarray(start, end)
    }

    set (buffer: Uint8Array, offset = 0) {
        this.#view.set(buffer, offset)
    }

    setString (str: string, offset = 0) {
        if (str.length > 32) {
            encoding.encodeInto(str, this.#view.subarray(offset))
        } else {
            for (let i = 0; i < str.length; i++) {
                this.#view[offset + i] = str.charCodeAt(i)
            }
        }
    }

    getString (start?: number, end?: number) {
        return encoding.decode(this.#view.subarray(start, end))
    }

    setInt8 (value: number, offset = 0) {
        this.#view[offset] = value
    }

    setInt16 (value: number, offset = 0) {
        this.#view[offset] = value
        this.#view[offset + 1] = value >> 8
    }

    setInt24 (value: number, offset = 0) {
        this.#view[offset] = value
        this.#view[offset + 1] = value >> 8
        this.#view[offset + 2] = value >> 16
    }

    setInt32 (value: number, offset = 0) {
        this.#view[offset] = value
        this.#view[offset + 1] = value >> 8
        this.#view[offset + 2] = value >> 16
        this.#view[offset + 3] = value >> 24
    }

    /* setInt40 (value: bigint, offset = 0) {
        const low = Number(value & 0xffffffffn)
        this.#view[offset] = low
        this.#view[offset + 1] = (low >> 8)
        this.#view[offset + 2] = (low >> 16)
        this.#view[offset + 3] = (low >> 24)
        const high = Number((value >> 32n) & 0xffn)
        this.#view[offset + 4] = high
    }

    setInt48 (value: bigint, offset = 0) {
        const low = Number(value & 0xffffffffn)
        this.#view[offset] = low
        this.#view[offset + 1] = (low >> 8)
        this.#view[offset + 2] = (low >> 16)
        this.#view[offset + 3] = (low >> 24)
        const high = Number((value >> 32n) & 0xffffn)
        this.#view[offset + 4] = high
        this.#view[offset + 5] = (high >> 8)
    } */

    setInt64 (value: bigint, offset = 0) {
        const low = Number(value & 0xffffffffn)
        this.#view[offset] = low
        this.#view[offset + 1] = (low >> 8)
        this.#view[offset + 2] = (low >> 16)
        this.#view[offset + 3] = (low >> 24)
        const high = Number((value >> 32n) & 0xffffffffn)
        this.#view[offset + 4] = high
        this.#view[offset + 5] = (high >> 8)
        this.#view[offset + 6] = (high >> 16)
        this.#view[offset + 7] = (high >> 24)
    }

    /* setUint8 (value: number, offset = 0) {
        this.#view[offset] = value
    }

    setUint16 (value: number, offset = 0) {
        this.#view[offset] = value
        this.#view[offset + 1] = value >> 8
    }

    setUint32 (value: number, offset = 0) {
        this.#view[offset] = value
        this.#view[offset + 1] = value >> 8
        this.#view[offset + 2] = value >> 16
        this.#view[offset + 3] = value >> 24
    }

    setUint64 (value: bigint, offset = 0) {
        const low = Number(value & 0xffffffffn)
        this.#view[offset] = low
        this.#view[offset + 1] = (low >> 8)
        this.#view[offset + 2] = (low >> 16)
        this.#view[offset + 3] = (low >> 24)
        const high = Number((value >> 32n) & 0xffffffffn)
        this.#view[offset + 4] = high
        this.#view[offset + 5] = (high >> 8)
        this.#view[offset + 6] = (high >> 16)
        this.#view[offset + 7] = (high >> 24)
    } */

    getInt8 (offset = 0) {
        return this.#view[offset] << 24 >> 24
    }

    getInt16 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8)) << 16 >> 16
    }

    getInt24 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16)) << 8 >> 8
    }

    getInt32 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) 
    }

    getInt64 (offset = 0) {
        const low = (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) >>> 0
        const high = (this.#view[offset + 4] | (this.#view[offset + 5] << 8) | (this.#view[offset + 6] << 16) | (this.#view[offset + 7] << 24))
        return BigInt(low) | (BigInt(high) << 32n)
    }

    getUint8 (offset = 0) {
        return this.#view[offset]
    }

    getUint16 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8))
    }

    getUint24 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16))
    }

    getUint32 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) >>> 0
    }

    getUint64 (offset = 0) {
        const low = (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) >>> 0
        const high = (this.#view[offset + 4] | (this.#view[offset + 5] << 8) | (this.#view[offset + 6] << 16) | (this.#view[offset + 7] << 24)) >>> 0
        return BigInt(low) | (BigInt(high) << 32n)
    }

    setVarint (value: number, offset = 0, length: ReturnType<typeof findLength>) {
        const end = length + offset - 1
        for (let i = offset; i < end; i++) {
            this.#view[i] = (value & 0x7f | 0x80)
            value >>>= 7
        }
        this.#view[end] = (value & 0x7f)
    }

    getVarint (offset = 0) {
        let value = 0
        let shift = 0
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
        while (true) {
            const byte = this.#view[offset++]
            value = (value | (byte & 0x7f) << shift) >>> 0
            if (!(byte & 0x80)) return { value, end: offset }
            shift += 7
        }
    }

    // private lengthLastMean: number

    resize (length: number) {
        // this.lengthLastMean = (this.lengthLastMean + length) / 2
        if (length <= this.length) {
            if (length > this.length >>> 2) return
            // console.log(length, this.length)
        }
       
        this.buffer.resize(length)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.#view = new Uint8Array(this.buffer, 0, length)
        this.length = length
    }

    static alloc (length: number, maxByteLength?: number) {
        const buffer = new ArrayBuffer(length, {
            maxByteLength
        })
        const view = new Uint8Array(buffer, 0, length)
        return new this(view)
    }

    static wrap (view: Uint8Array) {
        return new this(view)
    }

    readonly buffer: ArrayBufferLike

    #view: Uint8Array

    get view () {
        return this.#view
    }
}


class ReadonlyBuffer<T extends ReadonlyUint8Array | Uint8Array> {
    private constructor (view: T) {
        this.#view = view
        this.buffer = view.buffer
        this.length = view.length
    }

    readonly length: number

    slice (start?: number, end?: number) {
        return this.#view.slice(start, end)
    }

    subarray (start?: number, end?: number) {
        return this.#view.subarray(start, end)
    }

    getString (start?: number, end?: number) {
        return encoding.decode(this.#view.subarray(start, end) as Uint8Array)
    }

    getInt8 (offset = 0) {
        return this.#view[offset] << 24 >> 24
    }

    getInt16 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8)) << 16 >> 16
    }

    getInt24 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16)) << 8 >> 8
    }

    getInt32 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) 
    }

    getInt64 (offset = 0) {
        const low = (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) >>> 0
        const high = (this.#view[offset + 4] | (this.#view[offset + 5] << 8) | (this.#view[offset + 6] << 16) | (this.#view[offset + 7] << 24))
        return BigInt(low) | (BigInt(high) << 32n)
    }

    getUint8 (offset = 0) {
        return this.#view[offset]
    }

    getUint16 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8))
    }

    getUint24 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16))
    }

    getUint32 (offset = 0) {
        return (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) >>> 0
    }

    getUint64 (offset = 0) {
        const low = (this.#view[offset] | (this.#view[offset + 1] << 8) | (this.#view[offset + 2] << 16) | (this.#view[offset + 3] << 24)) >>> 0
        const high = (this.#view[offset + 4] | (this.#view[offset + 5] << 8) | (this.#view[offset + 6] << 16) | (this.#view[offset + 7] << 24)) >>> 0
        return BigInt(low) | (BigInt(high) << 32n)
    }

    getVarint (offset = 0) {
        let value = 0
        let shift = 0
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
        while (true) {
            const byte = this.#view[offset++]
            value = (value | (byte & 0x7f) << shift) >>> 0
            if (!(byte & 0x80)) return { value, end: offset }
            shift += 7
        }
    }

    static wrap<T extends ReadonlyUint8Array | Uint8Array> (view: T) {
        return new this(view)
    }

    readonly buffer: ArrayBufferLike

    readonly #view: T

}

type FullyReadonlyBuffer = ReadonlyBuffer<ReadonlyUint8Array>

type BufferLike = Uint8Array | ReadonlyUint8Array | Buffer | ReadonlyBuffer<ReadonlyUint8Array | Uint8Array>

export { Buffer, ReadonlyBuffer, ReadonlyUint8Array, FullyReadonlyBuffer, BufferLike }