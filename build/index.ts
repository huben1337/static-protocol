import { ProtocolDefintion } from "../src/StaticProtocol.js"
import addEncodeDecode from "../src/codegen/addEncodeDecode.js"
import { DataDefintion, Definition, EnumDefintion, ExtendedFieldType, InputDataTypes } from "../src/types/definition.js"
import Code from "../src/codegen/Code.js"
import processDefinition from "../src/util/processDefinition.js"
import processDataDefinition from "../src/util/processDataDefinition.js"
import { DefinitionInfo } from "../src/util/structure.js"
import { INTERNAL_TYPES } from "../src/util/types.js"
import fs from 'fs'

import * as esbuild from 'esbuild'



const typeMap = {
    'bool': ['boolean', 'boolean'],
    'uint': ['number', 'number'],
    'int': ['number', 'number'],
    'char': ['string', 'string'],
    'varchar': ['string', 'string'],
    'buf': ['Uint8Array | ReadonlyUint8Array', 'ReadonlyUint8Array'],
    'varbuf': ['Uint8Array | ReadonlyUint8Array', 'ReadonlyUint8Array'],
}

const testValues = {
    [INTERNAL_TYPES.BOOL]: false,
    [INTERNAL_TYPES.INT]: -1,
    [INTERNAL_TYPES.UINT]: 1,
    [INTERNAL_TYPES.CHAR]: 'abc',
    [INTERNAL_TYPES.VARCHAR]: 'abc',
    [INTERNAL_TYPES.BUF]: new Uint8Array([1, 2, 3]),
    [INTERNAL_TYPES.VARBUF]: new Uint8Array([1, 2, 3])

}

const buildsDir = `${import.meta.dirname}../../../../.builds`
    if (!fs.existsSync(buildsDir)){
        fs.mkdirSync(buildsDir)
    }

const getType = (fieldType: keyof InputDataTypes, readonly: boolean) => {
    const type = /^([a-zA-Z]+):?(?:[0-9]+)?$/.exec(fieldType)![1] as keyof typeof typeMap
    return typeMap[type][readonly ? 1 : 0]
}

const getTypeDefinition = <T extends DataDefintion> (dataDef: T, readonly: boolean) => {
    const props = new Array<string>()
    for (const [name, fieldDef] of Object.entries(dataDef)) {
        if (typeof fieldDef === 'string') {
            props.push(`${name}: ${getType(fieldDef, readonly)}`)
        } else if ('test' in fieldDef && typeof fieldDef.test === 'function') {
            props.push(`${name}: ${getType((fieldDef as ExtendedFieldType).type, readonly)}`)
        } else if ('isEnum' in fieldDef && fieldDef.isEnum === true) {
            const enumCases = new Array<string>()
            for (const [name, enumFieldDef] of Object.entries(fieldDef.def as EnumDefintion)) {
                if (typeof enumFieldDef === 'string') {
                    if (enumFieldDef === 'none') {
                        enumCases.push(`{ id: ${name} }`)
                    } else {
                        enumCases.push(`{ id: ${name}, value: ${getType(enumFieldDef, readonly)} }`)
                    }
                } else {
                    enumCases.push(`{ id: ${name}, value: ${getTypeDefinition(enumFieldDef as DataDefintion, readonly)} }`)
                }
            }
            props.push(`name: ${enumCases.join(' | ')}`)
        } else {
            props.push(`${name}: ${getTypeDefinition(fieldDef as DataDefintion, readonly)}`)
        }
    }
    return `{ ${props.join(', ')} }`
}

const modulepath = import.meta.url.match(/^file:\/\/\/?(.+)\/.+\/.+\/.+\/.+\.js$/)![1]
console.log(import.meta.url)
const addEndpointDeclaration = <T extends Definition> (definition: T, declarationCode: Code, assignStatement: string, encodeBufferType: string) => {
    declarationCode.add(`${assignStatement} {`)
    declarationCode.indent++
    declarationCode.add(`readonly channel: ${typeof definition.channel},`)
    declarationCode.add(`readonly encode: (data: ${getTypeDefinition(definition.data!, false)}) => ${encodeBufferType},`)
    declarationCode.add(`readonly decode: (buffer: BufferLike) => ${getTypeDefinition(definition.data!, true)}`)
    declarationCode.indent--
    declarationCode.add(`}`)
    return declarationCode
}

const buildEnpointObject = (endpointCode: Code, encodeCode: Code, decodeCode: Code, channel: string, assignStatement: string, end = '') => {
    endpointCode.add(`${assignStatement} Object.seal(Object.defineProperties(Object.create(null), {`)
    endpointCode.indent++
    endpointCode.add(`channel: {`)
    endpointCode.indent++
    endpointCode.add(`value: ${channel}`)
    endpointCode.indent--
    endpointCode.add(`},`)
    endpointCode.add(`encode: {`)
    endpointCode.indent++
    endpointCode.add(encodeCode)
    endpointCode.indent--
    endpointCode.add(`},`)
    endpointCode.add(`encode: {`)
    endpointCode.indent++
    endpointCode.add(decodeCode)
    endpointCode.indent--
    endpointCode.add(`}`)
    endpointCode.indent--
    endpointCode.add(`}))${end}`)
}

type Context = Record<keyof any, any>

const buildEndpoint = <T extends Definition> (definition: T, name: string, transformOptions?: esbuild.TransformOptions, contextPath?: string) => {
    const defInfo = processDefinition(definition)

    const endpointCode = new Code(`import { Buffer, ReadonlyBuffer } from 'static-protocol'`)

    for (const [fieldName, { test, type }] of Object.entries(defInfo.validators)) {
        const testCode = test.toString()
        const scopedTest = Function(`return (${testCode})`)() as (value: Parameters<typeof test>[0]) => boolean
        try {
            scopedTest(testValues[type as keyof typeof testValues])
        } catch (error) {
            throw new Error(`When building endpoints, a validators can not access values outside its scope. Validator ${fieldName} failed with ${error}.`)
        }
        endpointCode.add(`const vd${fieldName} = (${testCode})`)
    }
    
    // Generate declarations - We want to replace this by using the TypeScript API at some point
    const encodeBufferType = `${definition.allocateNew === true ? 'Buffer' : 'FullyReadonlyBuffer'}`
    const declarationCode = new Code(`import { ${encodeBufferType}, BufferLike } from '${modulepath}/src/util/Buffer.js'`)
    addEndpointDeclaration(definition, declarationCode, 'declare const endpoint:', encodeBufferType)
    declarationCode.add(`export default endpoint`)
    
    const encodeCode = new Code()
    const decodeCode = new Code()

    addEncodeDecode(defInfo, definition.channel, definition.allocateNew, encodeCode, decodeCode, 'value:', 'vd')
    buildEnpointObject(endpointCode, encodeCode, decodeCode, `${definition.channel}`, 'export default')

    const source = endpointCode.toString()

    const result = esbuild.transformSync(source, Object.assign({
        platform: 'neutral',
    }, transformOptions))
    
    fs.writeFileSync(`${buildsDir}/${name}.js`, result.code)
    fs.writeFileSync(`${buildsDir}/${name}.d.ts`, declarationCode.toString())

}

const buildProtocol = <T extends ProtocolDefintion, R extends boolean = false> (definition: T, name: string, raw?: R)=> {
    const protoCode = new Code()
    const protoDeclaration = new Code()

    protoDeclaration.add(`declare const proto: {`)
    protoDeclaration.indent++
    let usesBuffer = false
    let usesReadonlyBuffer = false

    const enpointsInfos = Object.entries(definition).map(([name, endpoint]) => {
        const readonlyBuffer = endpoint.allocateNew !== true
        usesBuffer ||= !readonlyBuffer
        usesReadonlyBuffer ||= readonlyBuffer
        const encodeBufferType = `${readonlyBuffer ? 'FullyReadonlyBuffer' : 'Buffer'}` 
        addEndpointDeclaration(endpoint, protoDeclaration, `readonly ${name}: `, encodeBufferType)

        const defInfo = new DefinitionInfo(endpoint.validate !== false)
        if (endpoint.data) {
            processDataDefinition(endpoint.data, defInfo)
        }

        for (const [fieldName, { test, type }] of Object.entries(defInfo.validators)) {
            const testCode = test.toString()
            const scopedTest = Function(`return (${testCode})`)() as (value: Parameters<typeof test>[0]) => boolean
            try {
                scopedTest(testValues[type as keyof typeof testValues])
            } catch (error) {
                throw new Error(`When building endpoints, a validators can not access values outside its scope. Validator ${fieldName} failed with ${error}.`)
            }
            protoCode.add(`const vd_${name}${fieldName} = (${testCode})`)
        }
        return {
            name,
            endpoint,
            defInfo
        }
    })

    protoCode.add(`export default Object.seal(Object.defineProperties(Object.create(null), {`)
    protoCode.indent++

    for (const { name, endpoint, defInfo } of enpointsInfos) {

        protoCode.add(`${name}: {`)
        protoCode.indent++

        const encodeCode = new Code()
        const decodeCode = new Code()

        addEncodeDecode(defInfo, endpoint.channel, endpoint.allocateNew, encodeCode, decodeCode, 'value:', `vd_${name}`)

        buildEnpointObject(protoCode, encodeCode, decodeCode, `${definition.channel}`, 'value:', ',')
        protoCode.add(`enumerable: true,`)

        protoCode.indent--
        protoCode.add(`},`)
    }

    protoCode.indent--
    protoCode.add(`}))`)

    protoDeclaration.indent--
    protoDeclaration.add(`}`)
    protoDeclaration.add(`export default proto`)
    protoDeclaration.insert(`import { ${usesBuffer ? (usesReadonlyBuffer ? 'Buffer, FullyReadonlyBuffer' : 'Buffer') : 'FullyReadonlyBuffer'}, BufferLike } from '${modulepath}/src/util/Buffer.js'`, 0)

    fs.writeFileSync(`${buildsDir}/${name}.js`, protoCode.toString())
    fs.writeFileSync(`${buildsDir}/${name}.d.ts`, protoDeclaration.toString())

}

export { buildEndpoint, buildProtocol }