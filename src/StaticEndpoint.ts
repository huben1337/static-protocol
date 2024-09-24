import { Buffer, BufferLike, FullyReadonlyBuffer, ReadonlyBuffer } from './util/Buffer.js'
import { findLength } from './util/varuint.js'
import { ArrayFieldTypes,  DataDefintion, Definition, DefinedTypeInput, DefinedTypeOutput, EnumDefintion, HasExtended, HasData, Validators, HasValidators, InputDataTypes } from './types/definition.js'
import processDefinition from './util/processDefinition.js'
import addTSEncodeDecode from './codegen/ts/addEncodeDecode.js'
import addCPPEncodeDecode from './codegen/cpp/addEncodeDecode.js'
import Code, { compile } from './codegen/Code.js'
import { DeepReadonly } from './types/helpers.js'


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
const List = <T extends ArrayFieldTypes>(def: T, maxSize = 255) => {
    return {
        def,
        long: maxSize > 255,
        isArray: true as const
    }
}

const Validate = <T extends keyof InputDataTypes> (type: T) => {
    return {
        type,
        validate: true as const
    }
}


export type StaticEndpointType<T extends Definition> = {
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
        HasData<T['data']> extends false ? (
            () => T['allocateNew'] extends true ? Buffer : FullyReadonlyBuffer
        ) : (
            (data: DefinedTypeInput<T['data']>) => T['allocateNew'] extends true ? Buffer : FullyReadonlyBuffer
        )
    ) : (
        () => T['allocateNew'] extends true ? Buffer : FullyReadonlyBuffer
    )
    /**
     * Decodes data from a buffer
     * 
     * @param buffer - The buffer to decode
     */
    readonly decode: (buffer: BufferLike) => T['data'] extends DataDefintion ? (
        // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
        HasData<T['data']> extends false ? void : (
            T['validate'] extends false ? DefinedTypeOutput<T['data']> : (
                HasExtended<T['data']> extends never ? DefinedTypeOutput<T['data']> : DefinedTypeOutput<T['data']> | null
            )
        )

    // we disable the rule cuz it is bugged
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    ) : void
    readonly definition: DeepReadonly<T>
}

export type EndpointValidators<T extends Definition> = T['data'] extends DataDefintion ? (HasValidators<T['data']> extends true ? Validators<T['data']> : never) : never
type ValidatorsArgs<T extends Definition> = EndpointValidators<T> extends never ? [] : [validators: EndpointValidators<T>]

/**
 * Creates a new static endpoint
 * 
 * @param definition - The definition for the endpoint
 */
const StaticEndpoint = <T extends Definition> (definition: T, ...args: ValidatorsArgs<T>) => {
    const defInfo = processDefinition(definition)

    const encodeCode = new Code('const Buffer = this.Buffer')
    if (defInfo.varuintSizeCalc.length > 0) {
        encodeCode.add('const getViLen = this.getViLen')
    }

    const decodeCode = new Code('const ReadonlyBuffer = this.ReadonlyBuffer')
    
    const [validators] = args
    if (validators) {
        let i = 0
        console.log(defInfo.fieldsToValidate)
        const addValidators = (validators: object, path: string) => {
            const entries = Object.entries(validators)
            for (const [key, value] of entries) {
                const subPath = `${path}['${key}']`
                if (!(typeof value === 'function')) {
                    addValidators(value as object, subPath)
                } else {
                    decodeCode.add(`const vd${defInfo.fieldsToValidate[i++]} = ${subPath}`)
                }
                
            }
        }
        addValidators(validators, 'this.vd')
    }
    
    addTSEncodeDecode(defInfo, definition.channel, definition.allocateNew, encodeCode, decodeCode, 'return', 'vd')

    // addCPPEncodeDecode(defInfo, definition.channel, definition.allocateNew, encodeCode, decodeCode, 'return', 'vd')

    return Object.seal(Object.create(null, {
        channel: {
            value: definition.channel,
        },
        encode: {
            value: compile<StaticEndpointType<T>['encode']>(encodeCode, defInfo.varuintSizeCalc.length > 0 ? {
                Buffer,
                getViLen: findLength,
            } : {
                Buffer,
            })
        },
        decode: {
            value: compile<StaticEndpointType<T>['decode']>(decodeCode, defInfo.validate ? {
                ReadonlyBuffer,
                vd: validators
            } : {
                ReadonlyBuffer
            })
        },
        definition: {
            value: definition,
            enumerable: true
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

export { StaticEndpoint, Enum, List, Validate }