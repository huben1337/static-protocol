/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-ts-comment */
type EncodingBinding = {
    encodeInto: (string: string, dest: Uint8Array) => void,
    encodeIntoResults: { 0: boolean, 1: boolean },
    encodeUtf8String: (string: string) => Uint8Array,
    decodeUTF8: (data: Uint8Array) => string,
}
type InternalBindings = {
    encoding_binding: EncodingBinding
}
type Primordials = Record<never, never>
type Internals = {
    internalBinding: <T extends keyof InternalBindings> (tag: T) => InternalBindings[T],
    primordials: Primordials
}
type InternalsModule = {
    default: Internals
}

let nodeInternals: Internals | undefined

if ('process' in globalThis) {
    try {
        // @ts-ignore
        const internalsModule = await import('internal/test/binding') as InternalsModule
        nodeInternals = internalsModule.default
    } catch {
        console.log('Node internals not found')
    }
}


export default nodeInternals