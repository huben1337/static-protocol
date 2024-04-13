import Code from './util/Code.js'
import { addFieldsStatic } from './util/addFields.js'
import getObjectStructure from './util/getObjectStructure.js'
import { Buffer, ReadonlyBuffer, ReadonlyUint8Array } from './util/Buffer.js'

const INT_TYPES = {
    'uint8': 1,
    'int8': -1,
    'uint16': 2,
    'int16': -2,
    'uint32': 4,
    'int32': -4,
    'uint64': 8,
    'int64': -8
}

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
    allocateNew?: boolean
}

type FieldTypes = keyof InputDataTypes | DataDefintion | EnumDefintionInternal
type DataDefintion = { 
    [field: string]: FieldTypes
    [isEnum]?: never
}

const isEnum = Symbol('isEnum')

type EnumDefintion = {
    [id: number | string]: keyof InputDataTypes | DataDefintion
}
type EnumDefintionInternal = {
    def: EnumDefintion
    [isEnum]: true
}

function Enum <T extends EnumDefintion>(def: T) {
    return {
        def,
        [isEnum]: true as const
    }
}

type t = EnumTypeInput<{
    0: {
        v: {
            a: "bool";
            b: "uint8";
        };
        t: "varchar:4";
    };
    1: "varbuf:3";
}>


type SubInput<T> = T extends FieldTypes ? DefinedTypeInput<T> : never
type SubOutput<T> = T extends FieldTypes ? DefinedTypeOutput<T> : never

type DefinedTypeInput<T extends FieldTypes> = T extends keyof InputDataTypes ? InputDataTypes[T] : (
    T extends ReturnType<typeof Enum> ? EnumTypeInput<T['def']> : (
        {
            [key in keyof T]: SubInput<T[key]>
        }
    )
)

type DefinedTypeOutput<T extends FieldTypes> = T extends keyof OutputDataTypes ? OutputDataTypes[T] : (
    T extends ReturnType<typeof Enum> ? EnumTypeOutput<T['def']> : (
        {
            [key in keyof T]: SubOutput<T[key]>
        }
    )
)

type EnumTypeInput<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: {
        id: key extends `${infer num extends number}` ? num : key
        value: SubInput<T[key]>
    }
}>

type EnumTypeOutput<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: {
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
    INT
}


const processType = (def: keyof InputDataTypes) => {
    const [type, bytes] = def.split(':')
    switch (type) {
        case 'buf':
        case 'char': {
            if (!bytes || !bytes.match(/^[0-9]+$/)) throw new Error('Must specify length in bytes')
            const size = parseInt(bytes)
            return {
                type: type === 'buf' ? INTERNAL_TYPES.BUF : INTERNAL_TYPES.CHAR,
                size
            }
        }
        case 'varbuf':
        case 'varchar': {
            if (bytes) {
                if (!bytes.match(/^[0-9]+$/)) throw new Error('Must specify max length in bytes')
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
        default: {
            if (!(type in INT_TYPES)) throw new Error('Invalid type')
            const size = INT_TYPES[type as keyof typeof INT_TYPES]
            return {
                type: INTERNAL_TYPES.INT,
                size
            }
                          
        }
    }
}

type EnumCase = { 
    id: number,
    idString?: string,
    nested: true,
    def: DefinitionInfo
} | { 
    id: number,
    idString?: string,
    nested: false,
    def: ReturnType<typeof processType>
}

class Args  {
    constructor (name = '') {
        this.name = name
    }
    name: string
    args = new Array<string | Args>()
    varArgs = new Array<string | Args>()
}


class DefinitionInfo {
    fields = new Fields()
    args = new Args()
    sizeCalc = new Array<string>()
    fixedSize = 0
    valueIndex = 0
    getVarName () {
        return `_${this.valueIndex++}`
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

    /* getSub () {
        let closed = false
        const sub = new DefinitionInfo()
        sub.valueIndex = this.valueIndex
        const done = () => {
            if (closed) throw new Error('Sub definition already closed')
            closed = true
            this.valueIndex = sub.valueIndex  
        }
        return { sub, done }
    } */
}

function addEnumCase (typeDef: keyof InputDataTypes | DataDefintion, id: number, i: number, defInfo: DefinitionInfo, cases: EnumCase[], idString?: string) {
    if (typeof typeDef === 'string') { // throw new Error('Enum can onbly specify type as string')
        cases[i] = {
            id,
            idString,
            nested: false,
            def: processType(typeDef)
        }
    } else if (typeof typeDef === 'object') {
        const subDefInfo = new DefinitionInfo()
        subDefInfo.valueIndex = defInfo.valueIndex
        processDef(typeDef, subDefInfo.args, subDefInfo)
        cases[i] = {
            id,
            idString,
            nested: true,
            def: subDefInfo
        }
        defInfo.valueIndex = subDefInfo.valueIndex
    }
}

const processDef = (def : DataDefintion, parent: Args, defInfo: DefinitionInfo) => {
    for (const name in def) {
        const sub = def[name]
        if (typeof sub === 'string') {
            const varName = defInfo.getVarName()
            const { type, size } = processType(sub)
            parent.args.push(`${name}: ${varName}`)
            if (type === INTERNAL_TYPES.VARBUF || type === INTERNAL_TYPES.VARCHAR) {
                parent.varArgs.push(`${name}: ${varName}`)
            }
            const field = {
                varName,
                size
            }
            defInfo.fixedSize += size
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
            }
        } else if (typeof sub === 'object') {
            if (sub[isEnum]) { // !
                const enumDef = sub.def
                const subFields = Object.entries(enumDef)
                // if (subFields.some((value) => value.match(/^[^0-9]+$/))) throw new Error('Enum can only contain numbers as ids')
                const usedIds = new Set<number>()
                const cases = new Array<EnumCase>(subFields.length)
                let mappedId = 0
                for (let i = 0; i < subFields.length; i++) {
                    const [idString, typeDef] = subFields[i]
                    if (/^[0-9]{1,3}$/.test(idString)) {
                        const id = parseInt(idString)
                        if (id > 255) throw new Error('Enum indecies must be between 0 and 255')
                        if (usedIds.has(id)) throw new Error('Enum indecies must be unique')
                        usedIds.add(id)
                        addEnumCase(typeDef, id, i, defInfo, cases, idString)
                        
                    } else {
                        while (usedIds.has(mappedId)) {
                            mappedId++
                            if (mappedId > 255) throw new Error('Ran out of enum indecies for mapping')
                        }
                        addEnumCase(typeDef, mappedId, i, defInfo, cases, `'${idString}'`)
                    }
                }
                const idName = defInfo.getVarName()
                const valueName = defInfo.getVarName()
                parent.args.push(`${name}: {id: ${idName}, value: ${valueName}}`)
                // console.log(cases)
                defInfo.fields.enum.push({
                    idName,
                    valueName,
                    cases,
                    mappedIds: mappedId > 0
                })
                defInfo.fixedSize++
            } else {
                const child = new Args(name)
                processDef(sub, child, defInfo)
                parent.args.push(child)
                parent.varArgs.push(child)
            }
        }
    }
}



const FieldList = Array<{varName: string, size: number}>

class Fields {
    buf = new FieldList()
    varbuf = new FieldList()
    char = new FieldList()
    varchar = new FieldList()
    int = new FieldList()
    bool = new FieldList()
    enum: {idName: string, valueName: string, cases: EnumCase[], mappedIds: boolean}[] = []
}


class StaticEndpoint<T extends Defintion, C extends boolean> {
    constructor (definition: T, noValidator: C) {
        this.channel = (definition.channel as T['channel'] extends number ? T['channel'] : undefined)
        const defInfo = new DefinitionInfo()
        const { args, fields } = defInfo
        if (definition.data) {
            processDef(definition.data, args, defInfo)
        }
        // console.dir(defInfo, { depth: null })
        const objTemplate = getObjectStructure(args.args)
        const encodeCode = new Code(`return ((${objTemplate.length > 0 ? `{${objTemplate}}` : ''}) => {`)

        const decodeCode = new Code('return ((input) => {')
        
        encodeCode.indent++
        decodeCode.indent++
        
        decodeCode.add('const buffer = ArrayBuffer.isView(input) ? this.B.wrap(input) : input')
        
        if (definition.channel !== undefined) {
            defInfo.fixedSize++
        }
        const bufferSize = defInfo.getBufferSize()
        if (fields.enum.length > 0) {
            encodeCode.add(`let bufferLength = ${bufferSize}`)
            fields.enum.forEach(({ idName, valueName, cases }) => {
                const encodeSwitch = encodeCode.switch(idName)
                cases.forEach(({ id, idString, nested, def }) => {
                    const encodeCase = encodeSwitch.case(`${idString ?? id}`)
                    if (nested) {
                        const objectStructure = getObjectStructure(def.args.varArgs)
                        encodeCase.add(`const {${objectStructure}} = ${valueName}`)
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

        } else {
            if (fields.varchar.length > 0 || fields.varbuf.length > 0 || definition.allocateNew) {
                encodeCode.add(`const buffer = this.B.alloc(${bufferSize})`)
            } else {
                
                encodeCode.insert(`const buffer = this.B.alloc(${bufferSize})`, 0)
            }  
        }
        let bufferOffset = 0
        if (definition.channel !== undefined) {
            encodeCode.add(`buffer.setUint8(${definition.channel}, ${bufferOffset++})`)
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

        // console.log(encodeCode.toString())
        // console.log(decodeCode.toString())

        this.encode = encodeCode.compile({
            B: Buffer,
        })
        this.decode = decodeCode.compile({
            B: ReadonlyBuffer,
        })
    }

    channel: T['channel'] extends number ? T['channel'] : undefined

    readonly encode: (data: T['data'] extends DataDefintion ? ProtoObject<T, true> : void) => T['allocateNew'] extends true ? Buffer : ReadonlyBuffer<ReadonlyUint8Array>

    readonly decode: (buffer: BufferLike) => T['data'] extends DataDefintion ? ProtoObject<T, false> : void
}


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
