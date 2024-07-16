import { Definition } from "../types/definition.js"
import Code from "./Code.js"
import { DefinitionInfo } from "../util/structure.js"
import { INTERNAL_TYPES } from "../util/types.js"
import { addFieldsStatic } from "./addFields.js"
import getObjectStructure from "./getObjectStructure.js"

const addEnumSizeCalc = (defInfo: DefinitionInfo, encodeCode: Code) => {
    defInfo.fields.enum.forEach(({ varName, cases }) => {
        const encodeSwitch = encodeCode.switch(`${varName}.id`)
        cases.forEach(({ id, idString, nested, def }) => {
            const encodeCase = encodeSwitch.case(idString ?? `${id}`)
            if (nested) {
                if (def.args.varArgs.length > 0) {
                    const objectStructure = getObjectStructure(def.args.varArgs)
                    encodeCase.add(`const ${objectStructure} = ${varName}.value`)
                }
                encodeCase.add(`bufferLength += ${def.getBufferSize()}`)
            } else {
                const { type, size } = def
                switch (type) {
                    case INTERNAL_TYPES.INT:
                    case INTERNAL_TYPES.UINT: {
                        encodeCase.add(`bufferLength += ${size}`)
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
                        encodeCase.add(`bufferLength += ${varName}.value.length + ${size}`)
                        break
                    }
                    default: throw new Error(`Unknown type ${type}`)
                }
            }
            encodeCase.add('break')
        })
    })
}

const addEncodeDecode = <T extends Definition> (defInfo: DefinitionInfo, channel: T['channel'], allocateNew: T['allocateNew'], encodeCode: Code, decodeCode: Code, assignStatement = '', validatorPrefix: string) => {
    const objTemplate = getObjectStructure(defInfo.args.args)

    encodeCode.add(`${assignStatement} ((${objTemplate.length > 4 ? objTemplate : ''}) => {`)

    encodeCode.indent++
    for (const calc of defInfo.varuintSizeCalc) {
        encodeCode.add(calc)
    }

    decodeCode.add(`${assignStatement} ((input) => {`)
    
    decodeCode.indent++
    
    decodeCode.add('const buffer = ArrayBuffer.isView(input) ? ReadonlyBuffer.wrap(input) : input')
    
    if (channel !== undefined) {
        defInfo.fixedSize++
    }

    const bufferSize = defInfo.getBufferSize()
    let bufferOffset = 0
    if (defInfo.fields.enum.length > 0 || defInfo.fields.nestedArray.some(({ def }) => def.fields.enum.length > 0)) {
        // Determine buffer length if length is dependent on enum
        encodeCode.add(`let bufferLength = ${bufferSize}`)
        addEnumSizeCalc(defInfo, encodeCode)
        defInfo.fields.nestedArray.forEach(({ def, varName, objectStructure }) => {
            encodeCode.add(`for (const ${objectStructure} of ${varName}) {`)
            encodeCode.indent++
            addEnumSizeCalc(def, encodeCode)
            encodeCode.indent--
            encodeCode.add('}')
        })
        encodeCode.add('const buffer = Buffer.alloc(bufferLength)')
        if (channel !== undefined) {
            encodeCode.add(`buffer.setUint8(${channel}, ${bufferOffset++})`)
        }

    } else {
        if (defInfo.sizeCalc.length > 0 || allocateNew === true) {
            encodeCode.add(`const buffer = Buffer.alloc(${bufferSize})`)
            if (channel !== undefined) {
                encodeCode.add(`buffer.setUint8(${channel}, ${bufferOffset++})`)
            }
        } else {
            encodeCode.insert(`const buffer = Buffer.alloc(${bufferSize})`, 1)
            if (channel !== undefined) {
                encodeCode.insert(`buffer.setUint8(${channel}, ${bufferOffset++})`, 2)
            }
        }  
    }
    
    

    addFieldsStatic(defInfo, encodeCode, decodeCode, bufferOffset, validatorPrefix)
    
    encodeCode.add('return buffer')
    encodeCode.indent--
    encodeCode.add('})')

    if (objTemplate.length > 4) {
        decodeCode.add(`return ${objTemplate}`)
    }
    decodeCode.indent--
    decodeCode.add('})')

    return { encodeCode, decodeCode }
}


export default addEncodeDecode