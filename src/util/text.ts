
import nodeInternals from "./NodeInternals.js"

let encoding: {
    encode: (value: string) => Uint8Array
    encodeInto: (value: string, dest: Uint8Array) => void,
    decode: (value: Uint8Array) => string
}

if (nodeInternals) {
    const binding = nodeInternals.internalBinding('encoding_binding')
    encoding = {
        encode: binding.encodeUtf8String,
        encodeInto: binding.encodeInto,
        decode: binding.decodeUTF8
    }
} else {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    encoding = {
        encode: encoder.encode.bind(encoder),
        encodeInto: encoder.encodeInto.bind(encoder),
        decode: decoder.decode.bind(decoder)
    }
}

export default encoding