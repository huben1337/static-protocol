import { Definition } from "../../types/definition.js"
import Code from "../Code.js"
import { DefinitionInfo, Fields } from "../../util/structure.js"
import { INTERNAL_TYPES } from "../../util/types.js"
import { addFieldsStatic } from "./addFields.js"
const addEnumSizeCalc = (enumFields: Fields['enum'], encodeCode: Code) => {
    enumFields.forEach(({ varName, cases }) => {
        encodeCode.add(`const ${varName}_id = ${varName}.id`)
        const encodeSwitch = encodeCode.switch(`${varName}_id`)
        cases.forEach(({ id, idString, nested, def }) => {
            if (!nested) {
                const encodeCase = encodeSwitch.case(idString ?? `${id}`)
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
                encodeCase.add('break')
            } else if (def.hasSizeCalc()) {
                const encodeCase = encodeSwitch.case(idString ?? `${id}`)
                const objectStructure = def.args.varArgsToString()
                if (objectStructure) {
                    encodeCase.add(`const ${objectStructure} = ${varName}.value`)
                }
                encodeCase.add(`bufferLength += ${def.getSizeCalc()}`)
                encodeCase.add('break')
            }
        })
    })
}

const addLengthIdentifiers = (fields: Fields, encodeCode: Code) => {
    fields.array.forEach(({ varName }) => {
        encodeCode.add(`const ${varName}_length = ${varName}.length`)
    })
    fields.nestedArray.forEach(({ varName }) => {
        encodeCode.add(`const ${varName}_length = ${varName}.length`)
    })
    fields.varchar.forEach(({ varName }) => {
        encodeCode.add(`const ${varName}_length = ${varName}.length`)
    })
    fields.varbuf.forEach(({ varName }) => {
        encodeCode.add(`const ${varName}_length = ${varName}.length`)
    })
}

const hasEnums = (fields: Fields): boolean => {
    return fields.enum.length > 0 || fields.nestedArray.some(({ def: { fields } }) => hasEnums(fields))
}

const addEnumSizeCalcDeep = (fields: Fields, encodeCode: Code) => {
    if (fields.enum.length > 0) {
        addEnumSizeCalc(fields.enum, encodeCode)
    }
    fields.nestedArray.forEach(({ def, varName, objectStructure }) => {
        if (!objectStructure) return
        encodeCode.add(`for (const ${objectStructure} of ${varName}) {`)
        encodeCode.indent++
        addEnumSizeCalcDeep(def.fields, encodeCode)
        encodeCode.indent--
        encodeCode.add('}')
    })
}

const addEncodeDecode = <T extends Definition> (defInfo: DefinitionInfo, channel: T['channel'], allocateNew: T['allocateNew'], encodeCode: Code, decodeCode: Code, assignStatement = '', validatorPrefix: string) => {
    const objTemplate = defInfo.args.toString()

    encodeCode.add(`${assignStatement} ((${objTemplate ?? ''}) => {`)

    encodeCode.indent++
    for (const calc of defInfo.varuintSizeCalc) {
        encodeCode.add(calc)
    }

    decodeCode.add(`${assignStatement} ((buffer) => {`)
    
    
    if (objTemplate) {
        decodeCode.indent++
        // decodeCode.add('const buffer = ArrayBuffer.isView(input) ? ReadonlyBuffer.wrap(input) : input')
    }
    
    
    if (channel !== undefined) {
        defInfo.baseSize++
    }

    const sizeCalc = defInfo.getSizeCalc()
    let bufferOffset = 0
    if (hasEnums(defInfo.fields)) {
        addLengthIdentifiers(defInfo.fields, encodeCode)
        // Determine buffer length if length is dependent on enum
        encodeCode.add(`let bufferLength = ${sizeCalc}`)
        addEnumSizeCalcDeep(defInfo.fields, encodeCode)
        encodeCode.insert(`const buffer = Buffer.alloc(1, 0xffffffff)`, 1)
        if (channel !== undefined) {
            encodeCode.insert(`buffer.setInt8(${channel}, ${bufferOffset++})`, 2)
        }
        encodeCode.add('buffer.resize(bufferLength)')

    } else if (defInfo.computedSize.length > 0) {
        addLengthIdentifiers(defInfo.fields, encodeCode)
        encodeCode.insert(`const buffer = Buffer.alloc(1, 0xffffffff)`, 1)
        if (channel !== undefined) {
            encodeCode.insert(`buffer.setInt8(${channel}, ${bufferOffset++})`, 2)
        }
        encodeCode.add(`buffer.resize(${sizeCalc})`)
    } else {
        encodeCode.insert(`const buffer = Buffer.alloc(${sizeCalc})`, 1)
        if (channel !== undefined) {
            encodeCode.insert(`buffer.setInt8(${channel}, ${bufferOffset++})`, 2)
        }
    }
    
    

    addFieldsStatic(defInfo, encodeCode, decodeCode, bufferOffset, validatorPrefix)
    
    encodeCode.add('return buffer')
    encodeCode.indent--
    encodeCode.add('})')

    if (objTemplate) {
        decodeCode.add(`return ${objTemplate}`)
        decodeCode.indent--
    }
    
    decodeCode.add('})')

    return { encodeCode, decodeCode }
}


export default addEncodeDecode