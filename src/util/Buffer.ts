import ReadonlyUint8Array from "../types/ReadonlyUint8Array.js"
import { findLength } from "./varuint.js"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const INT_8_OFFSET = 1 << 7
const INT_16_OFFSET = 1 << 15
const INT_32_OFFSET = 1 << 31
const INT_64_OFFSET = 1n << 63n

class Buffer {
    private constructor (bufferView: Uint8Array) {
        this.bufferView = bufferView
        this.buffer = bufferView.buffer
        this.length = bufferView.length
    }

    readonly length: number

    slice (start?: number, end?: number) {
        return this.bufferView.slice(start, end)
    }

    subarray (start?: number, end?: number) {
        return this.bufferView.subarray(start, end)
    }

    getCopy () {
        return this.bufferView.slice()
    }


    set (buffer: Uint8Array, offset = 0) {
        this.bufferView.set(buffer, offset)
    }

    setString (str: string, offset = 0) {
        if (str.length > 32) {
            encoder.encodeInto(str, this.bufferView.subarray(offset))
        } else {
            for (let i = 0; i < str.length; i++) {
                this.bufferView[offset + i] = str.charCodeAt(i)
            }
        }
    }

    getString (start?: number, end?: number) {
        return decoder.decode(this.bufferView.subarray(start, end))
    }

    setUint8 (value: number, offset = 0) {
        this.bufferView[offset] = value
    }

    getUint8 (offset = 0) {
        return this.bufferView[offset]
    }

    setInt8 (value: number, offset = 0) {
        this.bufferView[offset] = value + INT_8_OFFSET
    }

    getInt8 (offset = 0) {
        return this.bufferView[offset] - INT_8_OFFSET
    }

    setUint16 (value: number, offset = 0) {
        this.bufferView[offset] = value
        this.bufferView[offset + 1] = (value >>> 8)
    }

    getUint16 (offset = 0) {
        return (this.bufferView[offset] | (this.bufferView[offset + 1] << 8))
    }

    setInt16 (value: number, offset = 0) {
        this.setUint16(value + INT_16_OFFSET, offset)
    }

    getInt16 (offset = 0) {
        return this.getUint16(offset) - INT_16_OFFSET
    }

    setUint32 (value: number, offset = 0) {
        this.bufferView[offset] = value
        this.bufferView[offset + 1] = (value >>> 8)
        this.bufferView[offset + 2] = (value >>> 16)
        this.bufferView[offset + 3] = (value >>> 24)
    }

    getUint32 (offset = 0) {
        return (this.bufferView[offset] | (this.bufferView[offset + 1] << 8) | (this.bufferView[offset + 2] << 16) | (this.bufferView[offset + 3] << 24))
    }

    setInt32 (value: number, offset = 0) {
        this.setUint32(value + INT_32_OFFSET, offset)
    }

    getInt32 (offset = 0) {
        return this.getUint32(offset) - INT_32_OFFSET
    }

    setUint64 (value: bigint, offset = 0) {
        const low = Number(value & 0xffffffffn)
        this.bufferView[offset] = low
        this.bufferView[offset + 1] = (low >>> 8)
        this.bufferView[offset + 2] = (low >>> 16)
        this.bufferView[offset + 3] = (low >>> 24)
        const high = Number((value >> 32n) & 0xffffffffn)
        this.bufferView[offset + 4] = high
        this.bufferView[offset + 5] = (high >>> 8)
        this.bufferView[offset + 6] = (high >>> 16)
        this.bufferView[offset + 7] = (high >>> 24)
    }

    getUint64 (offset = 0) {
        const low = (this.bufferView[offset] | (this.bufferView[offset + 1] << 8) | (this.bufferView[offset + 2] << 16) | (this.bufferView[offset + 3] << 24))
        const high = (this.bufferView[offset + 4] | (this.bufferView[offset + 5] << 8) | (this.bufferView[offset + 6] << 16) | (this.bufferView[offset + 7] << 24))
        return BigInt(low) | (BigInt(high) << 32n)
    }

    setInt64 (value: bigint, offset = 0) {
        this.setUint64(value + INT_64_OFFSET, offset)
    }

    getInt64 (offset = 0) {
        return this.getUint64(offset) - INT_64_OFFSET
    }

    setVarint (value: number, offset = 0, length: ReturnType<typeof findLength>) {
        const end = length + offset - 1
        for (let i = offset; i < end; i++) {
            this.bufferView[i] = (value & 0x7f | 0x80)
            value >>>= 7
        }
        this.bufferView[end] = (value & 0x7f)
    }

    getVarint (offset = 0) {
        let value = 0
        let shift = 0
        while (true) {
            const byte = this.bufferView[offset++]
            value = (value | (byte & 0x7f) << shift) >>> 0
            if (!(byte & 0x80)) return { value, end: offset }
            shift += 7
        }
    }

    static alloc (length: number) {
        const bufferView = new Uint8Array(length)
        return new this(bufferView)
    }

    static wrap (bufferView: Uint8Array) {
        return new this(bufferView)
    }

    readonly buffer: Uint8Array['buffer']

    readonly bufferView: Uint8Array

}


class ReadonlyBuffer<T extends ReadonlyUint8Array | Uint8Array> {
    private constructor (bufferView: T) {
        this.bufferView = bufferView
        this.buffer = bufferView.buffer
        this.length = bufferView.length
    }

    readonly length: number

    slice (start?: number, end?: number) {
        return this.bufferView.slice(start, end)
    }

    subarray (start?: number, end?: number) {
        return this.bufferView.subarray(start, end)
    }

    getString (start?: number, end?: number) {
        return decoder.decode(this.bufferView.subarray(start, end))
    }

    getUint8 (offset = 0) {
        return this.bufferView[offset]
    }

    getInt8 (offset = 0) {
        return this.bufferView[offset] - INT_8_OFFSET
    }

    getUint16 (offset = 0) {
        return (this.bufferView[offset] | (this.bufferView[offset + 1] << 8))
    }

    getInt16 (offset = 0) {
        return this.getUint16(offset) - INT_16_OFFSET
    }

    getUint32 (offset = 0) {
        return (this.bufferView[offset] | (this.bufferView[offset + 1] << 8) | (this.bufferView[offset + 2] << 16) | (this.bufferView[offset + 3] << 24))
    }

    getInt32 (offset = 0) {
        return this.getUint32(offset) - INT_32_OFFSET
    }

    getUint64 (offset = 0) {
        const low = (this.bufferView[offset] | (this.bufferView[offset + 1] << 8) | (this.bufferView[offset + 2] << 16) | (this.bufferView[offset + 3] << 24))
        const high = (this.bufferView[offset + 4] | (this.bufferView[offset + 5] << 8) | (this.bufferView[offset + 6] << 16) | (this.bufferView[offset + 7] << 24))
        return BigInt(low) | (BigInt(high) << 32n)
    }

    getInt64 (offset = 0) {
        return this.getUint64(offset) - INT_64_OFFSET
    }

    getVarint (offset = 0) {
        let value = 0
        let shift = 0
        while (true) {
            const byte = this.bufferView[offset++]
            value = (value | (byte & 0x7f) << shift) >>> 0
            if (!(byte & 0x80)) return { value, end: offset }
            shift += 7
        }
    }

    static wrap<T extends ReadonlyUint8Array | Uint8Array> (bufferView: T) {
        return new this(bufferView)
    }

    readonly buffer: T['buffer']

    readonly bufferView: T

}

type FullyReadonlyBuffer = ReadonlyBuffer<ReadonlyUint8Array>

type BufferLike = Uint8Array | ReadonlyUint8Array | Buffer | ReadonlyBuffer<ReadonlyUint8Array | Uint8Array>

export { Buffer, ReadonlyBuffer, ReadonlyUint8Array, FullyReadonlyBuffer, BufferLike }