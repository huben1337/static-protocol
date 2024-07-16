import { Buffer, BufferLike, FullyReadonlyBuffer, ReadonlyBuffer } from './util/Buffer.js'
import { findLength } from './util/varuint.js'
import { ArrayFieldTypes,  DataDefintion, Definition, DefinedTypeInput, DefinedTypeOutput, EnumDefintion, HasExtended } from './types/definition.js'
import processDefinition from './util/processDefinition.js'
import addEncodeDecode from './codegen/addEncodeDecode.js'
import Code from './codegen/Code.js'

/**
 * Specifies an enum.
 * 
 * @param def - Enum definition: `{ [id: string | number]: type }`
 */
const Enum = <T extends EnumDefintion>(def: T) => {
    return {
        def,
        isEnum: true as const
    }
}

/**
 * Specifies an array.
 * 
 * @param def - Array definition
 */
const List = <T extends ArrayFieldTypes>(def: T, maxSize = 256) => {
    return {
        def,
        long: maxSize > 256,
        isArray: true as const
    }
}

type StaticEndpointType<T extends Definition> = {
    /**
     * The channel id of the endpoint
     */
    readonly channel: T['channel'] extends number ? T['channel'] : undefined
    /**
     * Encodes data into a buffer
     * 
     * @param data - The data to encode
     */
    readonly encode: T['data'] extends DataDefintion ? (
        (data: DefinedTypeInput<T['data']>) => T['allocateNew'] extends true ? Buffer : FullyReadonlyBuffer
    ) : (
        () => T['allocateNew'] extends true ? Buffer : FullyReadonlyBuffer
    )
    /**
     * Decodes data from a buffer
     * 
     * @param buffer - The buffer to decode
     */
    readonly decode: (buffer: BufferLike) => T['data'] extends DataDefintion ? (
        T['validate'] extends false ? DefinedTypeOutput<T['data']> : (
            HasExtended<T['data']> extends never ? DefinedTypeOutput<T['data']> : DefinedTypeOutput<T['data']> | null
        )
    // we disable the rule cuz it is bugged
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    ) : void
}

/**
 * Creates a new static endpoint
 * 
 * @param definition - The definition for the endpoint
 */
const StaticEndpoint = <T extends Definition> (definition: T) => {
    const defInfo = processDefinition(definition)

    const encodeCode = new Code('const Buffer = this.Buffer')
    if (defInfo.varuintSizeCalc.length > 0) {
        encodeCode.add('const getViLen = this.getViLen')
    }

    const decodeCode = new Code('const ReadonlyBuffer = this.ReadonlyBuffer')
    for (const name in defInfo.validators) {
        decodeCode.add(`const vd${name} = this.vd.${name}.test`)
    }

    addEncodeDecode(defInfo, definition.channel, definition.allocateNew, encodeCode, decodeCode, 'return', 'vd')

    return Object.seal(Object.defineProperties(Object.create(null), {
        channel: {
            value: definition.channel,
        },
        encode: {
            value: encodeCode.compile<StaticEndpointType<T>['encode']>(defInfo.varuintSizeCalc.length > 0 ? {
                Buffer,
                getViLen: findLength,
            } : {
                Buffer,
            })
        },
        decode: {
            value: decodeCode.compile<StaticEndpointType<T>['decode']>(defInfo.validate ? {
                ReadonlyBuffer,
                vd: defInfo.validators
            } : {
                ReadonlyBuffer
            })
        }
    })) as StaticEndpointType<T>
}

// type EnumHasExtended<T extends EnumDefintion> = T[keyof T] extends FieldTypes ? HasExtended<T[keyof T]> : never

/* 
type EncodeFunction<T extends Definition> = (data: ProtoObject<T, true>) => Buffer
type EncodeFunctionNoAlloc<T extends Definition> = (data: ProtoObject<T, true>) => ReadonlyBuffer
type EncodeFuntionNoArg = () => Buffer
type EncodeFuntionNoArgNoAlloc = () => ReadonlyBuffer

type DecodeFunction<T extends Definition> = (buffer: BufferLike) => ProtoObject<T, false>
type DecodeFunctionNoRet = (buffer: BufferLike) => void
*/

export { StaticEndpoint, StaticEndpointType, Enum, List }