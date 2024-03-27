import Code from './Code'
import ReadonlyBuffer from './ReadonlyBuffer'

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
    [x: `buf:${number}`]: Buffer
    [x: `varbuf:${number}`]: Buffer
    varbuf: Buffer
} & BaseDataTypes

type OutputDataTypes = {
    [x: `buf:${number}`]: ReadonlyBuffer
    [x: `varbuf:${number}`]: ReadonlyBuffer
    varbuf: ReadonlyBuffer
} & BaseDataTypes

type Defintion = {
    channel?: number
    head?: DataDefintion
    data?: DataDefintion
    allocateNew?: boolean
}

type DataDefintion = { 
    [field: string]: keyof InputDataTypes | DataDefintion | EnumDefintion
}

type EnumDefintion = {
    [id: number]: keyof InputDataTypes
}


type DefinedType<D extends DataDefintion, F extends keyof D, I extends boolean, TD = I extends true ? InputDataTypes : OutputDataTypes> = D[F] extends keyof TD ? TD[D[F]] : (
    keyof D[F] extends keyof EnumDefintion ? (
        D[F] extends EnumDefintion ? EnumType<D[F], I> : never
    ) : (
        D[F] extends DataDefintion ? {
            [key in keyof D[F]]: DefinedType<D[F], key, I>
        } : never
    )
)

type EnumType<T extends EnumDefintion, I extends boolean, TD = I extends true ? InputDataTypes : OutputDataTypes> = ValueType<{
    [key in keyof T]: T[key] extends keyof TD ? {
        id: key
        value: TD[T[key]]
    } : never
}>

type ProtoObject<T extends Defintion, I extends boolean> = (
    T['head'] extends DataDefintion ? {
        [fieldName in keyof T['head']]: DefinedType<T['head'], fieldName, I>
    } : {}
) & (
    T['data'] extends DataDefintion ? {
        [fieldName in keyof T['data']]: DefinedType<T['data'], fieldName, I>
    } : {}
)


class Args  {
    constructor (name = '') {
        this.name = name
    }
    name: string
    args = new Array<string | Args>()
}


const getObjectTemplate = (args: Args['args']) => {
    let result = ''
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (typeof arg === 'string') {
            result += `${i === 0 ? '' : ', '}${arg}`
        } else {
            result += `${i === 0 ? '' : ', '}${arg.name}: {${getObjectTemplate(arg.args)}}`
        }
    }
    return result
}

const enum INTERNAL_TYPES {
    BUF,
    VARBUF,
    CHAR,
    VARCHAR,
    BOOL,
    INT
}

const intMethodFromSize = (size: number) => {
    const signed = size < 0
    return `${signed ? 'Int' : 'Uint'}${Math.abs(size) * 8}BE`
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

class StaticEndpoint<T extends Defintion> {
    constructor (definition: T) {
        this.channel = (definition.channel as T['channel'] extends number ? T['channel'] : undefined)
        let valueIndex = 0
        const sizeCalc: string[] = []
        let fixedSize = 0
        const bufFields: {varName: string, size: number}[] = []
        const varbufFields: {varName: string, size: number}[] = []
        const charFields: {varName: string, size: number}[] = []
        const varcharFields: {varName: string, size: number}[] = []
        const byteFields: string[] = []
        const intFields: {varName: string, size: number }[] = []
        const boolFields: string[] = []
        const args = new Args()
        const enums: {idName: string, valueName: string, cases: {id: number, type: number, size: number}[]}[] = []
        const processDef = (def : DataDefintion, parent: Args) => {
            for (const field in def) {
                const sub = def[field] // 
                if (typeof sub === 'string') {
                    const varName = `_${valueIndex++}`
                    parent.args.push(`${field}: ${varName}`)
                    const { type, size } = processType(sub)
                    switch (type) {
                        case INTERNAL_TYPES.INT: {
                            fixedSize += size
                            if (size === 1) {
                                byteFields.push(varName)
                            } else {
                                intFields.push({
                                    varName,
                                    size
                                })
                            }
                            break
                        }
                        case INTERNAL_TYPES.BOOL: {
                            boolFields.push(varName)
                            break
                        }
                        case INTERNAL_TYPES.BUF: {
                            fixedSize += size
                            bufFields.push({
                                varName,
                                size
                            })
                            break
                        }
                        case INTERNAL_TYPES.VARBUF: {
                            sizeCalc.push(`${varName}.length`)
                            fixedSize += size
                            varbufFields.push({
                                varName,
                                size
                            })
                            break
                        }
                        case INTERNAL_TYPES.CHAR: {
                            fixedSize += size
                            charFields.push({
                                varName,
                                size
                            })
                            break
                        }
                        case INTERNAL_TYPES.VARCHAR: {
                            sizeCalc.push(`${varName}.length`)
                            fixedSize += size
                            varcharFields.push({
                                varName,
                                size
                            })
                            break
                        }
                    }
                } else if (typeof sub === 'object') {
                    const subFields = Object.keys(sub)
                    if (!subFields.some((value) => value.match(/^[^0-9]+$/))) {
                        const cases = new Array<{id: number, type: number, size: number}>(subFields.length)
                        for (let i = 0; i < subFields.length; i++) {
                            const id = parseInt(subFields[i])
                            if (id > 255) throw new Error('Enum indecies must be between 0 and 255')
                            const typeDef = (sub as EnumDefintion)[id]
                            if (typeof typeDef !== 'string') throw new Error('Enum can onbly specify type as string')
                            const { type, size } = processType(typeDef)
                            cases.push({
                                id,
                                type,
                                size
                            })
                        }
                        const idName = `_${valueIndex++}`
                        const valueName = `_${valueIndex++}`
                        parent.args.push(`${field}: {id: ${idName}, value: ${valueName}}`)
                        enums.push({
                            idName,
                            valueName,
                            cases
                        })
                        fixedSize++
                    } else {
                        const child = new Args(field)
                        processDef(sub, child)
                        parent.args.push(child)
                    }
                }
            }
        }
        if (definition.head) {
            processDef(definition.head, args)
        }
        if (definition.data) {
            processDef(definition.data, args)
        }
        const objTemplate = getObjectTemplate(args.args)
        const encodeCode = new Code(`return ((${objTemplate.length > 0 ? `{${objTemplate}}` : ''}) => {`)

        const decodeCode = new Code('return ((buffer) => {')
        encodeCode.indent++
        decodeCode.indent++

        // const bufferWrapper = new Code('class BufferWrapper {')
        // bufferWrapper.indent++
        // bufferWrapper.addLine('constructor (buffer) {')
        // bufferWrapper.indent++
        // bufferWrapper.addLine('this.buffer = buffer')
        // bufferWrapper.indent--
        // bufferWrapper.addLine('}\n\n')
        // bufferWrapper.addLine('buffer\n')
        

        


        fixedSize += Math.ceil(boolFields.length / 8)
        if (definition.channel !== undefined) {
            fixedSize++
        }
        const sizeCalcString = sizeCalc.join(' + ')
        const bufferSize = fixedSize > 0 ? `${fixedSize}${sizeCalc.length > 0 ? ` + ${sizeCalcString} ` : ''}` : sizeCalcString
        if (enums.length > 0) {
            encodeCode.addLine(`let bufferLength = ${bufferSize}`)
            enums.forEach(({ idName, valueName, cases }) => {
                encodeCode.addLine(`switch (${idName}) {`)
                encodeCode.indent++
                cases.forEach(({ id, type, size}) => {
                    encodeCode.addLine(`case ${id}: {`)
                    encodeCode.indent++
                    switch (type) {
                        case INTERNAL_TYPES.INT: {
                            encodeCode.addLine(`bufferLength += ${Math.abs(size)}`)
                            break
                        }
                        case INTERNAL_TYPES.BOOL: {
                            encodeCode.addLine(`bufferLength++`)
                            break
                        }
                        case INTERNAL_TYPES.BUF:
                        case INTERNAL_TYPES.CHAR: {
                            encodeCode.addLine(`bufferLength += ${size}`)
                            break
                        }
                        case INTERNAL_TYPES.VARBUF:
                        case INTERNAL_TYPES.VARCHAR: {
                            encodeCode.addLine(`bufferLength += ${valueName}.length + ${size}`)
                            break
                        }
                        default: throw new Error(`Unknown type ${type}`)
                    }
                    encodeCode.addLine('break')
                    encodeCode.indent--
                    encodeCode.addLine('}')
                })
                encodeCode.indent--
                encodeCode.addLine('}')
            })
            encodeCode.addLine('const buffer = Buffer.alloc(bufferLength)')

        } else {
            if (varcharFields.length > 0 || varbufFields.length > 0 || definition.allocateNew) {
                encodeCode.addLine(`const buffer = Buffer.alloc(${bufferSize})`)
            } else {
                
                encodeCode.insertLine(`const buffer = Buffer.alloc(${bufferSize})`, 0)
            }  
        }
        let bufferOffset = 0
        if (definition.channel !== undefined) {
            encodeCode.addLine(`buffer[${bufferOffset++}] = ${definition.channel}`)
        }
        byteFields.forEach((varName) => {
            encodeCode.addLine(`buffer[${bufferOffset}] = ${varName}`)
            decodeCode.addLine(`const ${varName} = buffer[${bufferOffset}]`)
            bufferOffset++
        })
        intFields.forEach(({ varName, size }) => {
            const methodType = intMethodFromSize(size)
            encodeCode.addLine(`buffer.write${methodType}(${varName}, ${bufferOffset})`)
            decodeCode.addLine(`const ${varName} = buffer.read${methodType}(${bufferOffset})`)
            bufferOffset += size
        })
        bufFields.forEach(({ varName, size }) => {
            encodeCode.addLine(`${varName}.copy(buffer, ${bufferOffset})`)
            decodeCode.addLine(`const ${varName} = buffer.subarray(${bufferOffset}, ${bufferOffset + size})`)
            bufferOffset += size
        })
        charFields.forEach(({ varName, size }) => {
            encodeCode.addLine(`buffer.write(${varName}, ${bufferOffset})`)
            decodeCode.addLine(`const ${varName} = buffer.toString('utf8', ${bufferOffset}, ${bufferOffset + size})`)
            bufferOffset += size
        })
        for (let i = 0; i < boolFields.length; i += 8) {
            const packedBools = boolFields.slice(i, i + 8 > boolFields.length ? boolFields.length : i + 8)
            encodeCode.addLine(`buffer[${bufferOffset}] = ${packedBools.map((varName, index) => `${varName} << ${index}`).join(' | ')}`)
            packedBools.forEach((varName, index) => decodeCode.addLine(`const ${varName} = !!(buffer[${bufferOffset}] >> ${index} & 1)`))
            bufferOffset++
        }
        if (varcharFields.length > 0 || varbufFields.length > 0 || enums.length > 0) {
            let tempOffset = bufferOffset
            for (let i = 0; i < varcharFields.length; i++) {
                const { varName, size } = varcharFields[i]
                if (size === 2) {
                    encodeCode.addLine(`buffer.writeUint16LE(${varName}.length, ${bufferOffset})`)
                    bufferOffset += 2
                } else {
                    encodeCode.addLine(`buffer[${bufferOffset}] = ${varName}.length`)
                    bufferOffset++
                } 
                
            }
            for (let i = 0; i < varbufFields.length; i++) {
                const { varName, size } = varbufFields[i];
                if (size === 2) {
                    encodeCode.addLine(`buffer.writeUint16LE(${varName}.length, ${bufferOffset})`)
                    bufferOffset += 2
                } else {
                    encodeCode.addLine(`buffer[${bufferOffset}] = ${varName}.length`)
                    bufferOffset++
                }
            }

            encodeCode.addLine(`let offset = ${bufferOffset}`)
            decodeCode.addLine(`let offset = ${bufferOffset}`)

            for (let i = 0; i < varcharFields.length; i++) {
                const { varName, size } = varcharFields[i];
                encodeCode.addLine(`buffer.write(${varName}, offset)`)
                encodeCode.addLine(`offset += ${varName}.length`)
                if (size === 2) {
                    decodeCode.addLine(`const ${varName} = buffer.toString('utf8', offset, offset += buffer.readUint16LE(${tempOffset}))`)
                    tempOffset += 2
                } else {
                    decodeCode.addLine(`const ${varName} = buffer.toString('utf8', offset, offset += buffer[${tempOffset}])`)
                    tempOffset++
                }
                
            }
            for (let i = 0; i < varbufFields.length; i++) {
                const { varName, size } = varbufFields[i];
                encodeCode.addLine(`${varName}.copy(buffer, offset)`)
                encodeCode.addLine(`offset += ${varName}.length`)
                if (size === 2) {
                    decodeCode.addLine(`const ${varName} = buffer.subarray(offset, offset += buffer.readUint16LE(${tempOffset}))`)
                    tempOffset += 2
                } else {
                    decodeCode.addLine(`const ${varName} = buffer.subarray(offset, offset += buffer[${tempOffset}])`)
                    tempOffset++
                }
                
            }

            enums.forEach(({ valueName }) => {
                decodeCode.addLine(`let ${valueName}`)
            })
            enums.forEach(({ idName, valueName, cases }) => {
                encodeCode.addLine(`buffer[offset++] = ${idName}`)
                encodeCode.addLine(`switch (${idName}) {`)
                encodeCode.indent++
                decodeCode.addLine(`const ${idName} = buffer[offset++]`)
                decodeCode.addLine(`switch (${idName}) {`)
                decodeCode.indent++
                cases.forEach(({ id, type, size}) => {
                    encodeCode.addLine(`case ${id}: {`)
                    encodeCode.indent++
                    decodeCode.addLine(`case ${id}: {`)
                    decodeCode.indent++
                    switch (type) {
                        case INTERNAL_TYPES.INT: {
                            if (size === 1 || size === -1) {
                                encodeCode.addLine(`buffer[offset++] = ${valueName}`)
                                decodeCode.addLine(`${valueName} = buffer[offset++]`)
                            } else {
                                const methodType = intMethodFromSize(size)
                                encodeCode.addLine(`buffer.write${methodType}(${valueName}, offset)`)
                                encodeCode.addLine(`offset += ${Math.abs(size)}`)
                                decodeCode.addLine(`${valueName} = buffer.read${methodType}(offset)`)
                                decodeCode.addLine(`offset += ${Math.abs(size)}`)
                            }
                            break
                        }
                        case INTERNAL_TYPES.BOOL: {
                            encodeCode.addLine(`buffer[offset++] = ${valueName}`)
                            decodeCode.addLine(`${valueName} = !!buffer[offset++]`)
                            break
                        }
                        case INTERNAL_TYPES.BUF: {
                            encodeCode.addLine(`${valueName}.copy(buffer, offset)`)
                            encodeCode.addLine(`offset += ${size}`)
                            decodeCode.addLine(`${valueName} = buffer.subarray(offset, offset += ${size})`)
                            break
                        }
                        case INTERNAL_TYPES.VARBUF: {
                            if (size === 2) {
                                encodeCode.addLine(`buffer.writeUint16LE(${valueName}.length, offset)`)
                                encodeCode.addLine(`offset += 2`)
                                encodeCode.addLine(`${valueName}.copy(buffer, offset)`)
                                encodeCode.addLine(`offset += ${valueName}.length`)

                                decodeCode.addLine(`${valueName} = buffer.subarray(offset + 2, offset += 2 + buffer.readUint16LE(offset))`)
                            } else {
                                encodeCode.addLine(`buffer[offset++] = ${valueName}.length`)
                                encodeCode.addLine(`${valueName}.copy(buffer, offset)`)
                                encodeCode.addLine(`offset += ${valueName}.length`)

                                decodeCode.addLine(`${valueName} = buffer.subarray(offset + 1, offset += 1 + buffer[offset])`)
                            }
                            break
                        }
                        case INTERNAL_TYPES.CHAR: {
                            encodeCode.addLine(`buffer.write(${valueName}, offset)`)
                            encodeCode.addLine(`offset += ${size}`)
                            decodeCode.addLine(`${valueName} = buffer.toString('utf8', offset, offset += ${size})`)
                            break
                        }
                        case INTERNAL_TYPES.VARCHAR: {
                            if (size === 2) {
                                encodeCode.addLine(`buffer.writeUint16LE(${valueName}.length, offset)`)
                                encodeCode.addLine(`offset += 2`)
                                encodeCode.addLine(`buffer.write(${valueName}, offset)`)
                                encodeCode.addLine(`offset += ${valueName}.length`)

                                decodeCode.addLine(`${valueName} = buffer.toString('utf8', offset + 2, offset += 2 + buffer.readUint16LE(offset))`)
                            } else {
                                encodeCode.addLine(`buffer[offset++] = ${valueName}.length`)
                                encodeCode.addLine(`buffer.write(${valueName}, offset)`)
                                encodeCode.addLine(`offset += ${valueName}.length`)

                                decodeCode.addLine(`${valueName} = buffer.toString('utf8', offset + 1, offset += 1 + buffer[offset])`)
                            }
                            break
                        }
                        default: throw new Error(`Unknown type ${type}`)
                    }
                    encodeCode.addLine('break')
                    encodeCode.indent--
                    encodeCode.addLine('}\n')


                    decodeCode.addLine('break')
                    decodeCode.indent--
                    decodeCode.addLine('}\n')
                })
                encodeCode.indent--
                encodeCode.addLine('}')
                decodeCode.indent--
                decodeCode.addLine('}')
            })
            
        }
        encodeCode.addLine('return buffer')
        encodeCode.indent--
        encodeCode.addLine('})')

        if (objTemplate.length > 0) {
            decodeCode.addLine(`return {${objTemplate}}`)
        }
        decodeCode.indent--
        decodeCode.addLine('})')

        // console.log(encodeCode.toString())
        // console.log(decodeCode.toString())

        this.encode = encodeCode.compile()
        this.decode = decodeCode.compile()
    }

    channel: T['channel'] extends number ? T['channel'] : undefined

    readonly encode: T['allocateNew'] extends true ? (
            T['data'] extends DataDefintion ? EncodeFunction<T> : EncodeFuntionNoArg
        ) : (
            T['data'] extends DataDefintion ? EncodeFunctionNoAlloc<T> : EncodeFuntionNoArgNoAlloc
        )

    readonly decode: T['data'] extends DataDefintion ? DecodeFunction<T> : DecodeFunctionNoRet
}



type EncodeFunction<T extends Defintion> = (data: ProtoObject<T, true>) => Buffer
type EncodeFunctionNoAlloc<T extends Defintion> = (data: ProtoObject<T, true>) => ReadonlyBuffer
type EncodeFuntionNoArg = () => Buffer
type EncodeFuntionNoArgNoAlloc = () => ReadonlyBuffer

type DecodeFunction<T extends Defintion> = (buffer: Buffer) => ProtoObject<T, false>
type DecodeFunctionNoRet = (buffer: Buffer) => void

export { StaticEndpoint, Defintion }
