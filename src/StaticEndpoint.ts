import { Buffer, BufferLike, FullyReadonlyBuffer, ReadonlyBuffer, ReadonlyUint8Array } from './util/Buffer.js'
import { findLength } from './util/varuint.js'
import { DataDefintion, Definition, EnumDefintion, HasExtended, ProtoObject } from './types/definition.js'
import { DefinitionInfo } from './util/structure.js'
import processDefinition from './util/processDefinition.js'
import addEncodeDecode from './codegen/addEncodeDecode.js'
import Code from './util/Code.js'

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

type StaticEndpointType<T extends Definition> = {
    /**
     * The channel id of the endpoint
     */
    readonly channel: T['channel'] extends number ? T['channel'] : undefined
    /**
     * Encodes data into a buffer
     * 
     * @param data - The data to encode
     * @returns 
     */
    readonly encode: (data: T['data'] extends DataDefintion ? ProtoObject<T, true> : void) => T['allocateNew'] extends true ? Buffer : FullyReadonlyBuffer
    /**
     * Decodes data from a buffer
     * 
     * @param buffer - The buffer to decode
     * @returns 
     */
    readonly decode: (buffer: BufferLike) => T['data'] extends DataDefintion ? (
        T['validate'] extends false ? ProtoObject<T, false> : (
            HasExtended<T['data']> extends never ? ProtoObject<T, false> : ProtoObject<T, false> | null
        )
    ) : void
}

/**
 * Creates a new static endpoint
 * 
 * @param definition - The definition for the endpoint
 */
const StaticEndpoint = <T extends Definition> (definition: T) => {
    const defInfo = new DefinitionInfo(definition.validate !== false)
    if (definition.data) {
        processDefinition(definition.data, defInfo.args, defInfo)
    }

    const encodeCode = new Code('const Buffer = this.Buffer')
    if (defInfo.varuintSizeCalc.length > 0) {
        encodeCode.add('const getViLen = this.getViLen')
    }

    const decodeCode = new Code('const ReadonlyBuffer = this.ReadonlyBuffer')
    for (const name in defInfo.validators) {
        decodeCode.add(`const vd${name} = this.vd.${name}.test`)
    }

    addEncodeDecode(defInfo, definition.channel, definition.allocateNew, encodeCode, decodeCode, 'return')

    return Object.seal(Object.defineProperties<StaticEndpointType<T>>(Object.create(null), {
        channel: {
            value: definition.channel,
        },
        encode: {
            value: encodeCode.compile(defInfo.varuintSizeCalc.length > 0 ? {
                Buffer,
                getViLen: findLength,
            } : {
                Buffer,
            })
        },
        decode: {
            value: decodeCode.compile(defInfo.validate ? {
                ReadonlyBuffer,
                vd: defInfo.validators
            } : {
                ReadonlyBuffer
            })
        }
    }))
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

export { StaticEndpoint, StaticEndpointType, Enum }