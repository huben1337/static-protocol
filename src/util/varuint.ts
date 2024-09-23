import { Buffer } from "./Buffer.js"

const B1 = (1 << 7)
const B2 = (1 << 14)
const B3 = (1 << 21)
const B4 = (1 << 28)

// Find length of varuint in constant time (useless)
// const findLengthCT = (v: number) => {
//     if (v < B4) {
//         if (v < B2) {
//             if (v < B1) {
//                 return 1
//             } else {
//                 return 2
//             }
//         } else {
//             if (v < B3) {
//                 return 3
//             } else {
//                 return 4
//             }
//         }
//     } else {
//         return 5
//     }
// }

const findLength = (v: number) => {
    return v < B1
        ? 1
        : v < B2
            ? 2
            : v < B3
                ? 3
                : v < B4
                    ? 4
                    : 5
}

function encode (value: number) {
    const length = findLength(value) - 1
    const buf = Buffer.alloc(length + 1)
    for (let i = 0; i < length; i++) {
        buf.setInt8(value & 0x7f | 0x80, i)
        value >>>= 7
    }
    buf.setInt8(value & 0x7f, length)
    return buf
}

function decode (buf: Buffer, offset = 0) {
    let value = 0
    let shift = 0
    while (true) {
        const byte = buf.getUint8(offset)
        value = (value | (byte & 0x7f) << shift) >>> 0
        if (!(byte & 0x80)) return value
        shift += 7
        offset++
    }
}

export { findLength }