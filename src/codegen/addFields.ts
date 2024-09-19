import Code from './Code.js'
import { DefinitionInfo, EnumCase } from '../util/structure.js'
import { INTERNAL_TYPES } from '../util/types.js'
import config from '../config.js'

const addArrayField = ( varName: string, type: INTERNAL_TYPES, size: number, validate: boolean, encodeCode: Code, decodeCode: Code, validatorPrefix: string, lengthVar: string, first: boolean) => {
    if (type === INTERNAL_TYPES.BOOL) {
        const jDeclaration = first ? 'let ' : ''
        encodeCode.add(`${jDeclaration}j = ${lengthVar} - 1`)
        encodeCode.add(`for (; j >= 7; j -= 8) {`)
        encodeCode.indent++
        const packString = Array.from({ length: 8 }, (_, index) => `${varName}[j - ${index}] << ${index}`).join(' | ')
        encodeCode.add(`buffer.setUint8(${packString}, offset++)`)
        encodeCode.indent--
        encodeCode.add('}')
        encodeCode.add(`if (j >= 0) {`)
        encodeCode.indent++
        encodeCode.add(`let packed = 0`)
        encodeCode.add(`for (; j >= 0; j--) {`)
        encodeCode.indent++
        encodeCode.add(`packed |= ${varName}[j] << j`)
        encodeCode.indent--
        encodeCode.add('}')
        encodeCode.add(`buffer.setUint8(packed, offset++)`)
        encodeCode.indent--
        encodeCode.add('}')

        decodeCode.add(`const ${varName} = new Array(${lengthVar})`)
        decodeCode.add(`${jDeclaration}j = ${lengthVar} - 1`)
        decodeCode.add(`for (; j >= 7; j -= 8) {`)
        decodeCode.indent++
        decodeCode.add(`const packed = buffer.getUint8(offset++)`)
        for (let i = 0; i < 8; i++) {
            decodeCode.add(`${varName}[j-${i}] = !!(packed & ${1 << i})`)                
        }
        decodeCode.indent--
        decodeCode.add('}')
        decodeCode.add(`if (j >= 0) {`)
        decodeCode.indent++
        decodeCode.add(`const packed = buffer.getUint8(offset++)`)
        decodeCode.add(`for (; j >= 0; j--) {`)
        decodeCode.indent++
        decodeCode.add(`${varName}[j] = !!(packed & (1 << j))`)
        decodeCode.indent--
        decodeCode.add('}')
        decodeCode.indent--
        decodeCode.add('}')
        return
    }

    if (config.INT_ARRAYS && (type === INTERNAL_TYPES.INT || type === INTERNAL_TYPES.UINT)) {
        const methodSize = `${size * 8}`
        encodeCode.add(`if (offset % ${size} !== 0) offset += ${size} - (offset % ${size})`)
        encodeCode.add(`for (const entry of ${varName}) {`)
        encodeCode.indent++
        encodeCode.add(`buffer.setUint${methodSize}(entry, offset)`)
        encodeCode.add(`offset += ${size}`)
        encodeCode.indent--
        encodeCode.add(`}`)

        decodeCode.add(`if (offset % ${size} !== 0) offset += ${size} - (offset % ${size})`)
        decodeCode.add(`const ${varName} = new ${size === 8 ? 'Big' : ''}${type === INTERNAL_TYPES.UINT ? 'Uint' : 'Int'}${methodSize}Array(buffer.buffer, offset, ${lengthVar})`)
        decodeCode.add(`offset += ${lengthVar} * ${size}`)
        return
    }
    encodeCode.add(`for (const entry of ${varName}) {`)
    encodeCode.indent++

    decodeCode.add(`const ${varName} = new Array(${lengthVar})`)
    decodeCode.add(`for (let i = 0; i < ${lengthVar}; i++) {`)
    decodeCode.indent++
    switch (type) {
        case INTERNAL_TYPES.UINT:
        case INTERNAL_TYPES.INT: {
            const methodType = `${type === INTERNAL_TYPES.UINT ? 'Uint' : 'Int'}${size * 8}`

            encodeCode.add(`buffer.set${methodType}(entry, offset)`)
            encodeCode.add(`offset += ${size}`)

            decodeCode.add(`const entry = buffer.get${methodType}(offset)`)
            decodeCode.add(`offset += ${size}`)
            break
        }
        case INTERNAL_TYPES.BUF: {
            encodeCode.add(`buffer.set(entry, offset)`)
            encodeCode.add(`offset += ${size}`)

            decodeCode.add(`const entry = buffer.subarray(offset, offset += ${size})`)
            break
        }
        case INTERNAL_TYPES.CHAR: {
            encodeCode.add(`buffer.setString(entry, offset)`)
            encodeCode.add(`offset += ${size}`)

            decodeCode.add(`const entry = buffer.getString(offset, offset += ${size})`)
            break
        }
        case INTERNAL_TYPES.VARBUF: {
            const methodType = `Uint${size * 8}`

            encodeCode.add(`buffer.set${methodType}(entry.length, offset)`)
            encodeCode.add(`offset += ${size}`)
            encodeCode.add(`buffer.set(entry, offset)`)
            encodeCode.add(`offset += entry.length`)

            decodeCode.add(`const itemLen = buffer.get${methodType}(offset)`)
            decodeCode.add(`offset += ${size}`)
            decodeCode.add(`const entry = buffer.subarray(offset, offset += itemLen)`)
            break
        }
        case INTERNAL_TYPES.VARCHAR: {
            const methodType = `Uint${size * 8}`

            encodeCode.add(`buffer.set${methodType}(entry.length, offset)`)
            encodeCode.add(`offset += ${size}`)
            encodeCode.add(`buffer.setString(entry, offset)`)
            encodeCode.add(`offset += entry.length`)

            decodeCode.add(`const itemLen = buffer.get${methodType}(offset)`)
            decodeCode.add(`offset += ${size}`)
            decodeCode.add(`const entry = buffer.getString(offset, offset += itemLen)`)
            break
        }
    }
    if (validate) {
        decodeCode.add(`if (!${validatorPrefix}${varName}(entry)) return null`)
    }
    decodeCode.add(`${varName}[i] = entry`)

    encodeCode.indent--
    encodeCode.add(`}`)
    decodeCode.indent--
    decodeCode.add(`}`)
}

const addEnumField = (cases: EnumCase[], varName: string, encodeCode: Code, decodeCode: Code, usesMappedIds: boolean, defineId: boolean, validatorPrefix: string) => {
    const allNested = cases.every(({ nested }) => nested)
        
    let decodeSwitchKey: string
    let encodeSwitchKey: string
    if (usesMappedIds) {
        encodeSwitchKey = `${varName}.id`
        decodeSwitchKey = 'buffer.getUint8(offset++)'
        decodeCode.add(`const ${varName} = { id: undefined, value: ${allNested ? 'null' : 'undefined' } }`)
    } else {
        const idName = `${varName}_id`
        encodeSwitchKey = idName
        if (defineId) {
            encodeCode.add(`const ${idName} = ${varName}.id`)
        }
        decodeSwitchKey = idName
        encodeCode.add(`buffer.setUint8(${encodeSwitchKey}, offset++)`)
        decodeCode.add(`const ${decodeSwitchKey} = buffer.getUint8(offset++)`)
        decodeCode.add(`const ${varName} = { id: ${decodeSwitchKey}, value: ${allNested ? 'null' : 'undefined' } }`)
        // switchKey = idName
        // decodeCode.add(`const ${idName} = buffer.getUint8(offset++)`)
        // decodeCode.add(`const ${varName} = { id: ${idName}, value: ${allNested ? 'null' : 'undefined' } }`)
    }
    const value = `${varName}.value`
    const encodeSwitch = encodeCode.switch(encodeSwitchKey)
    const decodeSwitch = decodeCode.switch(decodeSwitchKey)
    cases.forEach(({ id, idString, nested, def, validate }) => {
        const encodeCase = encodeSwitch.case(idString ?? `${id}`)
        const decodeCase = decodeSwitch.case(`${id}`)
        if (usesMappedIds) {
            encodeCase.add(`buffer.setUint8(${id}, offset++)`)
            decodeCase.add(`${varName}.id = ${idString}`)
        }
        if (nested) {
            const objStructure = def.args.toString()
            if (objStructure) {
                encodeCase.add(`const ${objStructure} = ${value}`)
            }
            addFieldsDynamic(def, encodeCase, decodeCase, true, validatorPrefix)
            if (objStructure) {
                decodeCase.add(`${value} = ${objStructure}`)
            }
        } else {
            const { type, size } = def
            switch (type) {
                case INTERNAL_TYPES.INT:
                case INTERNAL_TYPES.UINT: {
                    const methodType = `${type === INTERNAL_TYPES.INT ? 'Int' : 'Uint'}${size * 8}`
                    if (size === 1) {
                        encodeCase.add(`buffer.set${methodType}(${value}, offset++)`)
                        decodeCase.add(`${value} = buffer.get${methodType}(offset++)`)
                    } else {
                        encodeCase.add(`buffer.set${methodType}(${value}, offset)`)
                        encodeCase.add(`offset += ${size}`)
                        decodeCase.add(`${value} = buffer.get${methodType}(offset)`)
                        decodeCase.add(`offset += ${size}`)
                    }
                    break
                }
                case INTERNAL_TYPES.BOOL: {
                    encodeCase.add(`buffer.setUint8(${value}, offset++)`)
                    decodeCase.add(`${value} = !!buffer.getUint8(offset++)`)
                    break
                }
                case INTERNAL_TYPES.NONE: {
                    break
                }
                case INTERNAL_TYPES.BUF: {
                    encodeCase.add(`buffer.set(${value}, offset)`)
                    encodeCase.add(`offset += ${size}`)
                    decodeCase.add(`${value} = buffer.subarray(offset, offset += ${size})`)
                    break
                }
                case INTERNAL_TYPES.VARBUF: {
                    const lengthVar = `${varName}_value_length`
                    encodeCase.add(`const ${lengthVar} = ${value}.length`)
                    if (size === 2) {
                        encodeCase.add(`buffer.setUint16(${lengthVar}, offset)`)
                        encodeCase.add(`offset += 2`)
                        encodeCase.add(`buffer.set(${value}, offset)`)
                        encodeCase.add(`offset += ${lengthVar}`)

                        decodeCase.add(`${value} = buffer.subarray(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                    } else {
                        encodeCase.add(`buffer.setUint8(${lengthVar}, offset++)`)
                        encodeCase.add(`buffer.set(${value}, offset)`)
                        encodeCase.add(`offset += ${lengthVar}`)

                        decodeCase.add(`${value} = buffer.subarray(offset + 1, offset += 1 + buffer.getUint8(offset))`)
                    }
                    break
                }
                case INTERNAL_TYPES.CHAR: {
                    encodeCase.add(`buffer.setString(${value}, offset)`)
                    encodeCase.add(`offset += ${size}`)
                    decodeCase.add(`${value} = buffer.getString(offset, offset += ${size})`)
                    break
                }
                case INTERNAL_TYPES.VARCHAR: {
                    const lengthVar =  `${varName}_value_length`
                    encodeCase.add(`const ${lengthVar} = ${value}.length`)
                    if (size === 2) {
                        encodeCase.add(`buffer.setUint16(${lengthVar}, offset)`)
                        encodeCase.add(`offset += 2`)
                        encodeCase.add(`buffer.setString(${value}, offset)`)
                        encodeCase.add(`offset += ${lengthVar}`)

                        decodeCase.add(`${value} = buffer.getString(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                    } else {
                        encodeCase.add(`buffer.setUint8(${lengthVar}, offset++)`)
                        encodeCase.add(`buffer.setString(${value}, offset)`)
                        encodeCase.add(`offset += ${lengthVar}`)

                        decodeCase.add(`${value} = buffer.getString(offset + 1, offset += 1 + buffer.getUint8(offset))`)
                    }
                    break
                }
                default: throw new Error(`Unknown type ${type}`)
            }
            if (validate) {
                decodeCase.add(`if (!${validatorPrefix}${value}(${value})) return null`)
            }
        }
        encodeCase.add('break')
        decodeCase.add('break')
    })
}

// When a validate function fails null is returned. This is actually slower then throwing an error but may be faster when used in actual code.

function addFieldsStatic (defInfo: DefinitionInfo, encodeCode: Code, decodeCode: Code, bufferOffset: number, validatorPrefix: string) {
    const { fields } = defInfo
    fields.uint.forEach(({ varName, size, validate }) => {
        const methodType = `Uint${size * 8}`
        encodeCode.add(`buffer.set${methodType}(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.get${methodType}(${bufferOffset})`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
        bufferOffset += size
    })
    fields.int.forEach(({ varName, size, validate }) => {
        const methodType = `Int${size * 8}`
        encodeCode.add(`buffer.set${methodType}(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.get${methodType}(${bufferOffset})`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
        bufferOffset += size
    })
    fields.buf.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.set(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.subarray(${bufferOffset}, ${bufferOffset + size})`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
        bufferOffset += size
    })
    fields.char.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.setString(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.getString(${bufferOffset}, ${bufferOffset + size})`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
        bufferOffset += size
    })

    fields.array.forEach(({ varName, lenSize }) => {
        const methodType = `Uint${lenSize * 8}`
        encodeCode.add(`buffer.set${methodType}(${varName}_length, ${bufferOffset})`)
        decodeCode.add(`const ${varName}_length = buffer.get${methodType}(${bufferOffset})`)
        bufferOffset += lenSize
    })
    fields.nestedArray.forEach(({ varName, lenSize }) => {
        const methodType = `Uint${lenSize * 8}`
        encodeCode.add(`buffer.set${methodType}(${varName}_length, ${bufferOffset})`)
        decodeCode.add(`const ${varName}_length = buffer.get${methodType}(${bufferOffset})`)
        bufferOffset += lenSize
    })

    for (let i = 0; i < fields.bool.length; i += 8) {
        const packedBools = fields.bool.slice(i, i + 8 > fields.bool.length ? fields.bool.length : i + 8)
        encodeCode.add(`buffer.setUint8(${packedBools.map(({ varName }, index) => `${varName}${index > 0 ? ` << ${index}` : ''}`).join(' | ')}, ${bufferOffset})`)
        packedBools.forEach(({ varName, validate }, index) => {
            decodeCode.add(`const ${varName} = !!(buffer.getUint8(${bufferOffset}) & ${1 << index})`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        })
        bufferOffset++
    }
    if (defInfo.computedSize.length === 0 && fields.enum.length === 0) return
    
    let tempOffset = bufferOffset
    fields.varchar.forEach(({ varName, size }) => {
        encodeCode.add(`buffer.setUint${size * 8}(${varName}_length, ${bufferOffset})`)
        bufferOffset += size
    })
    fields.varbuf.forEach(({ varName, size }) => {
        encodeCode.add(`buffer.setUint${size * 8}(${varName}_length, ${bufferOffset})`)
            bufferOffset += size
    })

    encodeCode.add(`let offset = ${bufferOffset}`)
    decodeCode.add(`let offset = ${bufferOffset}`)
    fields.varchar.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.setString(${varName}, offset)`)
        encodeCode.add(`offset += ${varName}_length`)
        decodeCode.add(`const ${varName} = buffer.getString(offset, offset += buffer.getUint${size * 8}(${tempOffset}))`)
        tempOffset += size
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
    })
    fields.varbuf.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.set(${varName}, offset)`)
        encodeCode.add(`offset += ${varName}_length`)
        decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += buffer.getUint${size * 8}(${tempOffset}))`)
        tempOffset += size
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        } 
    })

    fields.array.forEach(({ varName, def: { type, size }, validate }, i) => {
        addArrayField(varName, type, size, validate, encodeCode, decodeCode, validatorPrefix, `${varName}_length`, i === 0)
    })

    fields.nestedArray.forEach(({ varName, def, objectStructure }) => {

        encodeCode.add(`for (const ${objectStructure} of ${varName}) {`)
        encodeCode.indent++

        decodeCode.add(`const ${varName} = new Array(${varName}_length)`)
        decodeCode.add(`for (let i = 0; i < ${varName}_length; i++) {`)
        decodeCode.indent++

        addFieldsDynamic(def, encodeCode, decodeCode, false, validatorPrefix)

        decodeCode.add(`${varName}[i] = ${objectStructure}`)

        encodeCode.indent--
        encodeCode.add(`}`)

        decodeCode.indent--
        decodeCode.add(`}`)
    })

    fields.varuint.forEach(({ varName }) => {
        encodeCode.add(`buffer.setVarint(${varName}, offset, ${varName}_len)`)
        encodeCode.add(`offset += ${varName}_len`)
        
        decodeCode.add(`const ${varName}_res = buffer.getVarint(offset)`)
        decodeCode.add(`const ${varName} = ${varName}_res.value`)
        decodeCode.add(`offset = ${varName}_res.end`)
    })

    fields.enum.forEach(({ varName, cases, usesMappedIds }) => {
        addEnumField(cases, varName, encodeCode, decodeCode, usesMappedIds, false, validatorPrefix)
    })
}

function addFieldsDynamic (defInfo: DefinitionInfo, encodeCode: Code, decodeCode: Code, inEnum: boolean, validatorPrefix: string) {
    const { fields } = defInfo
    fields.uint.forEach(({ varName, size, validate }) => {
        const methodType = `Uint${size * 8}`
        encodeCode.add(`buffer.set${methodType}(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.get${methodType}(offset)`)
        decodeCode.add(`offset += ${size}`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
    })
    fields.int.forEach(({ varName, size, validate }) => {
        const methodType = `Int${size * 8}`
        encodeCode.add(`buffer.set${methodType}(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.get${methodType}(offset)`)
        decodeCode.add(`offset += ${size}`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
    })
    fields.buf.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.set(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += ${size})`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
    })
    fields.char.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.setString(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.getString(offset, offset += ${size})`)
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
    })
    for (let i = 0; i < fields.bool.length; i += 8) {
        const packedBools = fields.bool.slice(i, i + 8 > fields.bool.length ? fields.bool.length : i + 8)
        encodeCode.add(`buffer.setUint8(${packedBools.map(({ varName }, index) => `${varName}${index > 0 ? ` << ${index}` : ''}`).join(' | ')}, offset++)`)
        packedBools.forEach(({ varName, validate }, index) => {
            decodeCode.add(`const ${varName} = !!(buffer.getUint8(offset) & ${1 << index})`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        })
        decodeCode.add(`offset++`)
    }
    if (defInfo.computedSize.length === 0 && fields.enum.length === 0) return
    fields.varchar.forEach(({ varName, size, validate }) => {
        const lengthVar = `${varName}_length`
        encodeCode.add(`const ${lengthVar} = ${varName}.length`)
        if (size === 2) {
            encodeCode.add(`buffer.setUint16(${lengthVar}, offset)`)
            encodeCode.add(`offset += 2`)
            encodeCode.add(`buffer.setString(${varName}, offset)`)
            encodeCode.add(`offset += ${lengthVar}`)

            decodeCode.add(`const ${varName} = buffer.getString(offset + 2, offset  += 2 + buffer.getUint16(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        } else {
            encodeCode.add(`buffer.setUint8(${lengthVar}, offset++)`)
            encodeCode.add(`buffer.setString(${varName}, offset)`)
            encodeCode.add(`offset += ${lengthVar}`)

            decodeCode.add(`const ${varName} = buffer.getString(offset + 1, offset  += 1 + buffer.getUint8(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        }
    })
    fields.varbuf.forEach(({ varName, size, validate }) => {
        const lengthVar = `${varName}_length`
        encodeCode.add(`const ${lengthVar} = ${varName}.length`)
        if (size === 2) {
            encodeCode.add(`buffer.setUint16(${lengthVar}, offset)`)
            encodeCode.add(`offset += 2`)
            encodeCode.add(`buffer.set(${varName}, offset)`)
            encodeCode.add(`offset += ${lengthVar}`)

            decodeCode.add(`const ${varName} = buffer.subarray(offset + 2, offset += 2 + buffer.getUint16(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        } else {
            encodeCode.add(`buffer.setUint8(${lengthVar}, offset++)`)
            encodeCode.add(`buffer.set(${varName}, offset)`)
            encodeCode.add(`offset += ${lengthVar}`)

            decodeCode.add(`const ${varName} = buffer.subarray(offset + 1, offset += 1 + buffer.getUint8(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        }
    })
    fields.array.forEach(({ varName, lenSize, def: { type, size }, validate }, i) => {
        const methodType = `Uint${lenSize * 8}`
        let arrayVar: string
        if (inEnum) {
            arrayVar = `array_${i}`
            encodeCode.add(`const ${arrayVar} = ${varName}`)
        } else {
            arrayVar = varName
        }
        const lengthVar = `${arrayVar}_length`
        encodeCode.add(`const ${lengthVar} = ${arrayVar}.length`)
        encodeCode.add(`buffer.set${methodType}(${lengthVar}, offset)`)
        encodeCode.add(`offset += ${lenSize}`)
        
        decodeCode.add(`const ${lengthVar} = buffer.get${methodType}(offset)`)
        decodeCode.add(`offset += ${lenSize}`)
        addArrayField(arrayVar, type, size, validate, encodeCode, decodeCode, validatorPrefix, lengthVar, i === 0)
        if (inEnum) {
            decodeCode.add(`${varName} = ${arrayVar}`)
        }
    })
    fields.nestedArray.forEach(({ varName, def, objectStructure, lenSize }, i) => {
        const methodType = `Uint${lenSize * 8}`
        let arrayVar: string
        if (inEnum) {
            arrayVar = `array_${i + fields.array.length}`
            encodeCode.add(`const ${arrayVar} = ${varName}`)
        } else {
            arrayVar = varName
        }
        const lengthVar = `${arrayVar}_length`
        encodeCode.add(`const ${lengthVar} = ${arrayVar}.length`)
        encodeCode.add(`buffer.set${methodType}(${lengthVar}, offset)`)
        encodeCode.add(`offset += ${lenSize}`)
        decodeCode.add(`const ${lengthVar} = buffer.get${methodType}(offset)`)
        decodeCode.add(`offset += ${lenSize}`)

        encodeCode.add(`for (const ${objectStructure} of ${arrayVar}) {`)
        encodeCode.indent++

        // decodeCode.add(`const array = new Array(${lengthVar})`)
        decodeCode.add(`${arrayVar} = new Array(${lengthVar})`)
        decodeCode.add(`for (let i = 0; i < ${lengthVar}; i++) {`)
        decodeCode.indent++

        addFieldsDynamic(def, encodeCode, decodeCode, false, validatorPrefix)

        decodeCode.add(`${arrayVar}[i] = ${objectStructure}`)

        encodeCode.indent--
        encodeCode.add(`}`)

        decodeCode.indent--
        decodeCode.add(`}`)

        if (inEnum) {
            decodeCode.add(`${varName} = ${arrayVar}`)
        }
    })
    fields.varuint.forEach(({ varName }) => {
        encodeCode.add(`buffer.setVarint(${varName}, offset, ${varName}_len)`)
        encodeCode.add(`offset += ${varName}_len`)
        
        decodeCode.add(`const ${varName}_res = buffer.getVarint(offset)`)
        decodeCode.add(`const ${varName} = ${varName}_res.value`)
        decodeCode.add(`offset = ${varName}_res.end`)
    })

    if (fields.enum.length > 0 && inEnum) throw new Error('Nested Enums are not supported. (yet?)')

    fields.enum.forEach(({ varName, cases, usesMappedIds }) => {
        addEnumField(cases, varName, encodeCode, decodeCode, usesMappedIds, true, validatorPrefix)
    })
    
}

export { addFieldsStatic, addFieldsDynamic }