import Code from './util/Code.js'
import { addFieldsStatic } from './util/addFields.js'
import getObjectStructure from './util/getObjectStructure.js'
import { Buffer, ReadonlyBuffer, ReadonlyUint8Array } from './util/Buffer.js'
import { findLength } from './util/varuint.js'

type ValueType<T> = T[keyof T]

type IntTypes = {
    uint8: number
    int8: number
    uint16: number
    int16: number
    uint32: number
    int32: number
    uint64: bigint
    int64: bigint
    // varuint: number
}

type BaseDataTypes = {
    [x: `char:${number}`]: string
    [x: `varchar:${number}`]: string
    varchar: string
    bool: boolean
} & IntTypes

type InputDataTypes = {
    [x: `buf:${number}`]: Uint8Array | ReadonlyUint8Array
    [x: `varbuf:${number}`]: Uint8Array | ReadonlyUint8Array
    varbuf: Uint8Array | ReadonlyUint8Array
} & BaseDataTypes

type OutputDataTypes = {
    [x: `buf:${number}`]: ReadonlyUint8Array
    [x: `varbuf:${number}`]: ReadonlyUint8Array
    varbuf: ReadonlyUint8Array
} & BaseDataTypes

type Defintion = {
    channel?: number
    data?: DataDefintion
    validate?: boolean
    allocateNew?: boolean
}

type ExtendedFieldType = ValueType<{
    [T in keyof InputDataTypes]: {
        type: T
        test: (value: InputDataTypes[T]) => boolean
    }
}>

type BaseFieldTypes = keyof InputDataTypes | DataDefintion | ExtendedFieldType

type FieldTypes = BaseFieldTypes | EnumDefintionInternal 

type DataDefintion = { 
    [field: string]: FieldTypes
}

type EnumFieldTypes = BaseFieldTypes | 'none'

type EnumDefintion = {
    /** Maps id to type */
    [id: number | string]: EnumFieldTypes
}

type EnumDefintionInternal = {
    def: EnumDefintion
    isEnum: true
}

/**
 * Specifies an enum.
 * 
 * @param def - Enum definition: `{ [id: string | number]: type }`
 */
function Enum <T extends EnumDefintion>(def: T) {
    return {
        def,
        isEnum: true as const
    }
}


type SubInput<T> = T extends FieldTypes ? DefinedTypeInput<T> : never
type SubOutput<T> = T extends FieldTypes ? DefinedTypeOutput<T> : never

type DefinedTypeInput<T extends FieldTypes> = T extends keyof InputDataTypes ? InputDataTypes[T] : (
    T extends ExtendedFieldType ? InputDataTypes[T['type']] : (
        T extends EnumDefintionInternal ? EnumTypeInput<T['def']> : (
            {
                [key in keyof T]: SubInput<T[key]>
            }
        )
    )
)

type DefinedTypeOutput<T extends FieldTypes> = T extends keyof OutputDataTypes ? OutputDataTypes[T] : (
    T extends ExtendedFieldType ? OutputDataTypes[T['type']] : (
        T extends EnumDefintionInternal ? EnumTypeOutput<T['def']> : (
            {
                [key in keyof T]: SubOutput<T[key]>
            }
        )
    )
)

type EnumTypeInput<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: T[key] extends 'none' ? {
        id: key extends `${infer num extends number}` ? num : key
    } : {
        id: key extends `${infer num extends number}` ? num : key
        value: SubInput<T[key]>
    }
}>

type EnumTypeOutput<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: T[key] extends 'none' ? {
        id: key extends `${infer num extends number}` ? num : key
    } : {
        id: key extends `${infer num extends number}` ? num : key
        value: SubOutput<T[key]>
    }
}>

type ProtoObject<T extends Defintion, I extends boolean> = T['data'] extends DataDefintion ? (
    I extends true ? DefinedTypeInput<T['data']> : DefinedTypeOutput<T['data']>
) : {}

const enum INTERNAL_TYPES {
    BUF,
    VARBUF,
    CHAR,
    VARCHAR,
    BOOL,
    NONE,
    UINT,
    INT,
    VARUINT
}


const processType = (def: keyof InputDataTypes | 'none') => {
    const defMatch = /^([a-zA-Z]+):?([0-9]+)?$/.exec(def)
    if (defMatch === null) throw new Error(`Invalid type: ${def.toString()}`)
    const [,type, bytes] = defMatch
    switch (type) {
        case 'buf':
        case 'char': {
            if (!bytes) throw new Error('Must specify length in bytes')
            const size = parseInt(bytes)
            return {
                type: type === 'buf' ? INTERNAL_TYPES.BUF : INTERNAL_TYPES.CHAR,
                size
            }
        }
        case 'varbuf':
        case 'varchar': {
            if (bytes) {
                const maxSize = parseInt(bytes)
                if (maxSize < 0) throw new Error('Max size must be positive integer')
                if (maxSize > 1 << 16) throw new Error('Max string length is 65536')
                if (maxSize > 1 << 8) {
                    return {
                        type: type === 'varbuf' ? INTERNAL_TYPES.VARBUF : INTERNAL_TYPES.VARCHAR,
                        size: 2
                    }
                }
            }
            return {
                type: type === 'varbuf' ? INTERNAL_TYPES.VARBUF : INTERNAL_TYPES.VARCHAR,
                size: 1
            }
        }
        case 'bool': {
            return {
                type: INTERNAL_TYPES.BOOL,
                size: 0
            }
        }
        case 'none': {
            return {
                type: INTERNAL_TYPES.NONE,
                size: 0
            }
        }
        case 'varuint': {
            throw new Error('Not implemented yet')
            return {
                type: INTERNAL_TYPES.VARUINT,
                size: 0
            }   
        }
        case 'int':
        case 'uint': {
            if (!bytes) throw new Error('Must specify length in bytes')
            const size = parseInt(bytes) >>> 3
            return {
                type: INTERNAL_TYPES.INT,
                size: type === 'uint' ? size : size * -1
            }
        }
        default: {
            throw new Error(`Unknown type ${type}`)            
        }
    }
}

type EnumCase = { 
    id: number,
    idString?: string,
    nested: true,
    def: DefinitionInfo
    validate: boolean
} | { 
    id: number,
    idString?: string,
    nested: false,
    def: ReturnType<typeof processType>
    validate: boolean
}

class Args  {
    constructor (name = '') {
        this.name = name
    }
    name: string
    args = new Array<string | Args>()
    varArgs = new Array<string | Args>()
}

const FieldList = Array<{varName: string, size: number, validate: boolean}>

class Fields {
    buf = new FieldList()
    varbuf = new FieldList()
    char = new FieldList()
    varchar = new FieldList()
    int = new FieldList()
    varuint = new FieldList()
    bool = new FieldList()
    none = new FieldList()
    enum: {idName: string, valueName: string, cases: EnumCase[], mappedIds: boolean}[] = []
}

class DefinitionInfo {
    constructor (validate: boolean) {
        this.validate = validate
    }
    validators: Record<string, ExtendedFieldType['test']> = {}
    validate: boolean
    fields = new Fields()
    args = new Args()
    sizeCalc = new Array<string>()
    varuintSizeCalc = new Array<string>()
    fixedSize = 0
    state = {
        valueIndex: 0
    }
    getVarName () {
        return `_${this.state.valueIndex++}`
    }
    getBufferSize () {
        const fixedSize = this.fixedSize + Math.ceil(this.fields.bool.length / 8)
        if (this.sizeCalc.length > 0) {
            const sizeCalcString = this.sizeCalc.join(' + ')
            return fixedSize > 0 ? `${fixedSize}${` + ${sizeCalcString} `}` : sizeCalcString
        } else {
            return `${fixedSize}`
        }
    }

    sub () {
        const sub = new DefinitionInfo(this.validate)
        sub.state = this.state
        // sub.varuintSizeCalc = this.varuintSizeCalc
        sub.validators = this.validators
        return sub
    }
}

function processEnumCase (typeDef: EnumFieldTypes, id: number, defInfo: DefinitionInfo, idString: string, valueName: string): EnumCase {
    if (typeof typeDef === 'string') { // throw new Error('Enum can onbly specify type as string')
        return {
            id,
            idString,
            nested: false,
            def: processType(typeDef),
            validate: false
        }
    } else if (('test' in typeDef) && typeof typeDef.test === 'function') {
        const validate = defInfo.validate
        if (validate) {
            defInfo.validators[valueName] = typeDef.test
        }
        return {
            id,
            idString,
            nested: false,
            def: processType(typeDef.type as keyof InputDataTypes),
            validate
        }
    } else {
        const subDefInfo = defInfo.sub()
        processDef(typeDef as DataDefintion, subDefInfo.args, subDefInfo)
        return {
            id,
            idString,
            nested: true,
            def: subDefInfo,
            validate: false
        }
    }
}

const processEnumDef = (def: EnumDefintion, name: string, parent: Args, defInfo: DefinitionInfo) => {
    const subFields = Object.entries(def)
    // if (subFields.some((value) => value.match(/^[^0-9]+$/))) throw new Error('Enum can only contain numbers as ids')
    const usedIds = new Set<number>()
    const cases = new Array<EnumCase>(subFields.length)
    const idName = defInfo.getVarName()
    const valueName = defInfo.getVarName()
    let mappedId = 0
    for (let i = 0; i < subFields.length; i++) {
        const [idString, sub] = subFields[i]
        if (/^[0-9]{1,3}$/.test(idString)) {
            const id = parseInt(idString)
            if (id > 255) throw new Error('Enum indecies must be between 0 and 255')
            if (usedIds.has(id)) throw new Error('Enum indecies must be unique')
            usedIds.add(id)
            cases[i] = processEnumCase(sub, id, defInfo, idString, valueName)
        } else {
            while (usedIds.has(mappedId)) {
                mappedId++
                if (mappedId > 255) throw new Error('Ran out of enum indecies for mapping')
            }
            cases[i] = processEnumCase(sub, mappedId, defInfo, `'${idString}'`, valueName)
        }
    }
    parent.args.push(`${name}: {id: ${idName}, value: ${valueName}}`)
    defInfo.fields.enum.push({
        idName,
        valueName,
        cases,
        mappedIds: mappedId > 0
    })
    defInfo.fixedSize++
}

const processField = (sub: keyof InputDataTypes, name: string, parent: Args, defInfo: DefinitionInfo, test: ExtendedFieldType['test'] | null) => {
    const { type, size } = processType(sub)
    const varName = defInfo.getVarName()
    parent.args.push(`${name}: ${varName}`)
    if (type === INTERNAL_TYPES.VARBUF || type === INTERNAL_TYPES.VARCHAR || type === INTERNAL_TYPES.VARUINT) {
        parent.varArgs.push(`${name}: ${varName}`)
    }
    const validate = defInfo.validate && test !== null
    if (validate) {
        defInfo.validators[varName] = test
    }
    const field = {
        varName,
        size,
        validate
    }
    defInfo.fixedSize += Math.abs(size)
    const { fields } = defInfo
    switch (type) {
        case INTERNAL_TYPES.INT: {
            fields.int.push(field)
            break
        }
        case INTERNAL_TYPES.BOOL: {
            fields.bool.push(field)
            break
        }
        case INTERNAL_TYPES.NONE: {
            fields.none.push(field)
            break
        }
        case INTERNAL_TYPES.BUF: {
            fields.buf.push(field)
            break
        }
        case INTERNAL_TYPES.VARBUF: {
            defInfo.sizeCalc.push(`${varName}.length`)
            fields.varbuf.push(field)
            break
        }
        case INTERNAL_TYPES.CHAR: {
            fields.char.push(field)
            break
        }
        case INTERNAL_TYPES.VARCHAR: {
            defInfo.sizeCalc.push(`${varName}.length`)  
            fields.varchar.push(field)
            break
        }
        case INTERNAL_TYPES.VARUINT: {
            const sizeVarName = `${varName}_len`
            defInfo.varuintSizeCalc.push(`const ${sizeVarName} = getViLen(${varName})`)
            defInfo.sizeCalc.push(sizeVarName)
            fields.varuint.push(field)
            break
        }
    }
}

const processDef = (def: DataDefintion, parent: Args, defInfo: DefinitionInfo) => {
    for (const name in def) {
        const sub = def[name]
        if (typeof sub === 'string') {
            processField(sub, name, parent, defInfo, null)
        } else if (('test' in sub) && typeof sub.test === 'function') {
            processField(sub.type as keyof InputDataTypes, name, parent, defInfo, sub.test)
        } else if (('isEnum' in sub) && sub.isEnum === true) {
            processEnumDef((sub as EnumDefintionInternal).def, name, parent, defInfo)
        } else {
            const child = new Args(name)
            processDef(sub as DataDefintion, child, defInfo)
            parent.args.push(child)
            parent.varArgs.push(child)
        }
    }
}

/**
 * Class representing a static endpoint.
 *
 * @template T The type of the definition for this endpoint.
 */
class StaticEndpoint<T extends Defintion> {
    /**
     * Creates a new static endpoint.
     *
     * @param definition - The definition for this endpoint.
     */
    constructor (definition: T) {
        this.channel = definition.channel
        const validate = definition.validate !== false
        const defInfo = new DefinitionInfo(validate)
        const { args, fields } = defInfo
        if (definition.data) {
            processDef(definition.data, args, defInfo)
        }
        // console.dir(defInfo, { depth: null })
        const objTemplate = getObjectStructure(args.args)
        const encodeCode = new Code()
        if (defInfo.varuintSizeCalc.length > 0) {
            encodeCode.add('const getViLen = this.getViLen')
        }
        encodeCode.add(`return ((${objTemplate.length > 0 ? `{${objTemplate}}` : ''}) => {`)

        encodeCode.indent++
        for (const calc of defInfo.varuintSizeCalc) {
            encodeCode.add(calc)
        }

        const decodeCode = new Code()
        for (const name in defInfo.validators) {
            decodeCode.add(`const vd${name} = this.vd.${name}`)
        }
        decodeCode.add('return ((input) => {')
        
        decodeCode.indent++
        
        decodeCode.add('const buffer = ArrayBuffer.isView(input) ? this.B.wrap(input) : input')
        
        if (definition.channel !== undefined) {
            defInfo.fixedSize++
        }
        const bufferSize = defInfo.getBufferSize()
        let bufferOffset = 0
        if (fields.enum.length > 0) {
            // Determine buffer length if length is dependent on enum
            encodeCode.add(`let bufferLength = ${bufferSize}`)
            fields.enum.forEach(({ idName, valueName, cases }) => {
                const encodeSwitch = encodeCode.switch(idName)
                cases.forEach(({ id, idString, nested, def }) => {
                    const encodeCase = encodeSwitch.case(`${idString ?? id}`)
                    if (nested) {
                        if (def.args.varArgs.length > 0) {
                            const objectStructure = getObjectStructure(def.args.varArgs)
                            encodeCase.add(`const {${objectStructure}} = ${valueName}`)
                        }
                        encodeCase.add(`bufferLength += ${def.getBufferSize()}`)
                    } else {
                        const { type, size } = def
                        switch (type) {
                            case INTERNAL_TYPES.INT: {
                                encodeCase.add(`bufferLength += ${Math.abs(size)}`)
                                break
                            }
                            case INTERNAL_TYPES.BOOL: {
                                encodeCase.add(`bufferLength++`)
                                break
                            }
                            case INTERNAL_TYPES.NONE: {
                                break
                            }
                            case INTERNAL_TYPES.BUF:
                            case INTERNAL_TYPES.CHAR: {
                                encodeCase.add(`bufferLength += ${size}`)
                                break
                            }
                            case INTERNAL_TYPES.VARBUF:
                            case INTERNAL_TYPES.VARCHAR: {
                                encodeCase.add(`bufferLength += ${valueName}.length + ${size}`)
                                break
                            }
                            default: throw new Error(`Unknown type ${type}`)
                        }
                    }
                    encodeCase.add('break')
                })
            })
            encodeCode.add('const buffer = this.B.alloc(bufferLength)')
            if (definition.channel !== undefined) {
                encodeCode.add(`buffer.setUint8(${definition.channel}, ${bufferOffset++})`)
            }

        } else {
            if (defInfo.sizeCalc.length > 0 || definition.allocateNew) {
                encodeCode.add(`const buffer = this.B.alloc(${bufferSize})`)
                if (definition.channel !== undefined) {
                    encodeCode.add(`buffer.setUint8(${definition.channel}, ${bufferOffset++})`)
                }
            } else {
                encodeCode.insert(`const buffer = this.B.alloc(${bufferSize})`, 0)
                if (definition.channel !== undefined) {
                    encodeCode.insert(`buffer.setUint8(${definition.channel}, ${bufferOffset++})`, 1)
                }
            }  
        }
        
        

        addFieldsStatic(defInfo, encodeCode, decodeCode, bufferOffset)
        
        encodeCode.add('return buffer')
        encodeCode.indent--
        encodeCode.add('})')

        if (objTemplate.length > 0) {
            decodeCode.add(`return {${objTemplate}}`)
        }
        decodeCode.indent--
        decodeCode.add('})')

        this.encode = encodeCode.compile(defInfo.varuintSizeCalc.length > 0 ? {
            B: Buffer,
            getViLen: findLength,
        } : {
            B: Buffer,
        })
        this.decode = decodeCode.compile(validate ? {
            B: ReadonlyBuffer,
            vd: defInfo.validators
        } : {
            B: ReadonlyBuffer
        })
    }

    /**
     * The channel id of the endpoint
     */
    channel: T['channel']

    /**
     * Encodes data into a buffer
     */
    readonly encode: (data: T['data'] extends DataDefintion ? ProtoObject<T, true> : void) => T['allocateNew'] extends true ? Buffer : ReadonlyBuffer<ReadonlyUint8Array>

    /**
     * Decodes data from a buffer
     */
    readonly decode: (buffer: BufferLike) => T['data'] extends DataDefintion ? (
        T['validate'] extends false ? ProtoObject<T, false> : (
            HasExtended<T['data']> extends never ? ProtoObject<T, false> : ProtoObject<T, false> | null
        )
    ) : void
}

type HasExtended<T extends FieldTypes> = T extends keyof InputDataTypes ? never : (
    T extends ExtendedFieldType ? true : (
        T extends EnumDefintionInternal ? EnumHasExtended<T['def']> : ValueType<{
            [key in keyof T]: T[key] extends FieldTypes ? HasExtended<T[key]> : never
        }>
    )
)

type EnumHasExtended<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: T[key] extends FieldTypes ? HasExtended<T[key]> : never
}>

// type EnumHasExtended<T extends EnumDefintion> = T[keyof T] extends FieldTypes ? HasExtended<T[keyof T]> : never



/* 
type EncodeFunction<T extends Defintion> = (data: ProtoObject<T, true>) => Buffer
type EncodeFunctionNoAlloc<T extends Defintion> = (data: ProtoObject<T, true>) => ReadonlyBuffer
type EncodeFuntionNoArg = () => Buffer
type EncodeFuntionNoArgNoAlloc = () => ReadonlyBuffer

type DecodeFunction<T extends Defintion> = (buffer: BufferLike) => ProtoObject<T, false>
type DecodeFunctionNoRet = (buffer: BufferLike) => void
*/

type BufferLike = Uint8Array | ReadonlyUint8Array | Buffer | ReadonlyBuffer<ReadonlyUint8Array | Uint8Array>


export { StaticEndpoint, Defintion, Enum, ProtoObject, INTERNAL_TYPES, DefinitionInfo, Args, BufferLike }
