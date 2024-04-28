import Code from '../util/Code.js'
import getObjectStructure from './getObjectStructure.js'
import { DefinitionInfo } from '../util/structure.js'
import { INTERNAL_TYPES } from '../util/types.js'

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
        encodeCode.add(`buffer.set${methodType}(${varName}.length, ${bufferOffset})`)
        decodeCode.add(`const ${varName}_length = buffer.get${methodType}(${bufferOffset})`)
        bufferOffset += lenSize
    })
    fields.nestedArray.forEach(({ varName, lenSize }) => {
        const methodType = `Uint${lenSize * 8}`
        encodeCode.add(`buffer.set${methodType}(${varName}.length, ${bufferOffset})`)
        decodeCode.add(`const ${varName}_length = buffer.get${methodType}(${bufferOffset})`)
        bufferOffset += lenSize
    })

    for (let i = 0; i < fields.bool.length; i += 8) {
        const packedBools = fields.bool.slice(i, i + 8 > fields.bool.length ? fields.bool.length : i + 8)
        encodeCode.add(`buffer.setUint8(${packedBools.map(({ varName }, index) => `${varName} << ${index}`).join(' | ')}, ${bufferOffset})`)
        packedBools.forEach(({ varName, validate }, index) => {
            decodeCode.add(`const ${varName} = !!(buffer.getUint8(${bufferOffset}) >>> ${index} & 1)`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        })
        bufferOffset++
    }
    if (defInfo.sizeCalc.length === 0 && fields.enum.length === 0) return
    
    let tempOffset = bufferOffset
    fields.varchar.forEach(({ varName, size, validate }) => {
        if (size === 2) {
            encodeCode.add(`buffer.setUint16(${varName}.length, ${bufferOffset})`)
            bufferOffset += 2
        } else {
            encodeCode.add(`buffer.setUint8(${varName}.length, ${bufferOffset})`)
            bufferOffset++
        } 
    })
    fields.varbuf.forEach(({ varName, size, validate }) => {
        if (size === 2) {
            encodeCode.add(`buffer.setUint16(${varName}.length, ${bufferOffset})`)
            bufferOffset += 2
        } else {
            encodeCode.add(`buffer.setUint8(${varName}.length, ${bufferOffset})`)
            bufferOffset++
        }
    })

    encodeCode.add(`let offset = ${bufferOffset}`)
    decodeCode.add(`let offset = ${bufferOffset}`)
    fields.varchar.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.setString(${varName}, offset)`)
        encodeCode.add(`offset += ${varName}.length`)
        if (size === 2) {
            decodeCode.add(`const ${varName} = buffer.getString(offset, offset += buffer.getUint16(${tempOffset}))`)
            tempOffset += 2
        } else {
            decodeCode.add(`const ${varName} = buffer.getString(offset, offset += buffer.getUint8(${tempOffset}))`)
            tempOffset++
        }
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        }
    })
    fields.varbuf.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.set(${varName}, offset)`)
        encodeCode.add(`offset += ${varName}.length`)
        if (size === 2) {
            decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += buffer.getUint16(${tempOffset}))`)
            tempOffset += 2
        } else {
            decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += buffer.getUint8(${tempOffset}))`)
            tempOffset++
        }
        if (validate) {
            decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
        } 
    })

    fields.array.forEach(({ varName, def: { type, size }, validate }) => {
        if (type === INTERNAL_TYPES.BOOL) {
            encodeCode.add(`let i = ${varName}.length - 1`)
            encodeCode.add(`for (; i >= 7; i -= 8) {`)
            encodeCode.indent++
            const packString = Array.from({ length: 8 }, (_, index) => `${varName}[i - ${index}] << ${index}`).join(' | ')
            encodeCode.add(`buffer.setUint8(${packString}, offset++)`)
            encodeCode.indent--
            encodeCode.add('}')
            encodeCode.add(`if (i >= 0) {`)
            encodeCode.indent++
            encodeCode.add(`let packed = 0`)
            encodeCode.add(`for (; i >= 0; i--) {`)
            encodeCode.indent++
            encodeCode.add(`packed |= ${varName}[i] << i`)
            encodeCode.indent--
            encodeCode.add('}')
            encodeCode.add(`buffer.setUint8(packed, offset++)`)
            encodeCode.indent--
            encodeCode.add('}')

            decodeCode.add(`const ${varName} = new Array(${varName}_length)`)
            decodeCode.add(`let i = ${varName}_length - 1`)
            decodeCode.add(`for (; i >= 7; i -= 8) {`)
            decodeCode.indent++
            decodeCode.add(`const packed = buffer.getUint8(offset++)`)
            decodeCode.add(`${varName}[i] = !!(packed & 1)`)        
            for (let i = 1; i < 8; i++) {
                decodeCode.add(`${varName}[i-${i}] = !!(packed >>> ${i} & 1)`)                
            }
            decodeCode.indent--
            decodeCode.add('}')
            decodeCode.add(`if (i >= 0) {`)
            decodeCode.indent++
            decodeCode.add(`const packed = buffer.getUint8(offset++)`)
            decodeCode.add(`for (; i >= 0; i--) {`)
            decodeCode.indent++
            decodeCode.add(`${varName}[i] = !!(packed >>> i & 1)`)
            decodeCode.indent--
            decodeCode.add('}')
            decodeCode.indent--
            decodeCode.add('}')
            return
        }

        encodeCode.add(`for (const entry of ${varName}) {`)
        encodeCode.indent++

        decodeCode.add(`const ${varName} = new Array(${varName}_length)`)
        decodeCode.add(`for (let i = 0; i < ${varName}_length; i++) {`)
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
    })

    fields.nestedArray.forEach(({ varName, def, objectStructure }) => {

        encodeCode.add(`for (const {${objectStructure}} of ${varName}) {`)
        encodeCode.indent++

        decodeCode.add(`const ${varName} = new Array(${varName}_length)`)
        decodeCode.add(`for (let i = 0; i < ${varName}_length; i++) {`)
        decodeCode.indent++

        console.log(def)

        addFieldsDynamic(def, encodeCode, decodeCode, validatorPrefix)

        decodeCode.add(`${varName}[i] = {${objectStructure}}`)

        encodeCode.indent--
        encodeCode.add(`}`)

        decodeCode.indent--
        decodeCode.add(`}`)
        // addFieldsDynamic(def, encodeCode, decodeCode, validatorPrefix)
    })

    fields.varuint.forEach(({ varName }) => {
        encodeCode.add(`buffer.setVarint(${varName}, offset, ${varName}_len)`)
        encodeCode.add(`offset += ${varName}_len`)
        
        decodeCode.add(`const ${varName}_res = buffer.getVarint(offset)`)
        decodeCode.add(`const ${varName} = ${varName}_res.value`)
        decodeCode.add(`offset = ${varName}_res.end`)
    })

    fields.enum.forEach(({ idName, varName, cases, mappedIds }) => {
        const allNested = cases.every(({ nested }) => nested)
        encodeCode.add(`buffer.setUint8(${varName}.id, offset++)`)
        const encodeSwitch = encodeCode.switch(`${varName}.id`)
        let switchKey: string
        if (mappedIds) {
            switchKey = 'buffer.getUint8(offset++)'
            decodeCode.add(`const ${varName} = { id: undefined, value: ${allNested ? 'null' : 'undefined' } }`)
        } else {
            switchKey = `${varName}.id`
            decodeCode.add(`const ${varName} = { id: buffer.getUint8(offset++), value: ${allNested ? 'null' : 'undefined' } }`)
            // switchKey = idName
            // decodeCode.add(`const ${idName} = buffer.getUint8(offset++)`)
            // decodeCode.add(`const ${varName} = { id: ${idName}, value: ${allNested ? 'null' : 'undefined' } }`)
        }
        const value = `${varName}.value`
        const decodeSwitch = decodeCode.switch(switchKey)
        cases.forEach(({ id, idString, nested, def, validate }) => {
            const encodeCase = encodeSwitch.case(`${idString ?? id}`)
            const decodeCase = decodeSwitch.case(`${id}`)
            if (mappedIds) {
                decodeCase.add(`${varName}.id = ${idString}`)
            }
            if (nested) {
                const objStructure = getObjectStructure(def.args.args)
                encodeCase.add(`const {${objStructure}} = ${varName}.value`)
                addFieldsDynamic(def, encodeCase, decodeCase, validatorPrefix)
                decodeCase.add(`${varName}.value = {${objStructure}}`)
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
                        if (size === 2) {
                            encodeCase.add(`buffer.setUint16(${value}.length, offset)`)
                            encodeCase.add(`offset += 2`)
                            encodeCase.add(`buffer.set(${value}, offset)`)
                            encodeCase.add(`offset += ${value}.length`)

                            decodeCase.add(`${value} = buffer.subarray(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                        } else {
                            encodeCase.add(`buffer.setUint8(${value}.length, offset++)`)
                            encodeCase.add(`buffer.set(${value}, offset)`)
                            encodeCase.add(`offset += ${value}.length`)

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
                        if (size === 2) {
                            encodeCase.add(`buffer.setUint16(${value}.length, offset)`)
                            encodeCase.add(`offset += 2`)
                            encodeCase.add(`buffer.setString(${value}, offset)`)
                            encodeCase.add(`offset += ${value}.length`)

                            decodeCase.add(`${value} = buffer.getString(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                        } else {
                            encodeCase.add(`buffer.setUint8(${value}.length, offset++)`)
                            encodeCase.add(`buffer.setString(${value}, offset)`)
                            encodeCase.add(`offset += ${value}.length`)

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
    })
}

function addFieldsDynamic (defInfo: DefinitionInfo, encodeCode: Code, decodeCode: Code, validatorPrefix: string) {
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
        encodeCode.add(`buffer.setUint8(${packedBools.map(({ varName }, index) => `${varName} << ${index}`).join(' | ')}, offset++)`)
        packedBools.forEach(({ varName, size, validate }, index) => {
            decodeCode.add(`const ${varName} = !!(buffer.getUint8(offset) >>> ${index} & 1)`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        })
        decodeCode.add(`offset++`)
    }
    if (defInfo.sizeCalc.length === 0 && fields.enum.length === 0) return
    fields.varchar.forEach(({ varName, size, validate }) => {
        console.log(varName, size, validate)
        if (size === 2) {
            encodeCode.add(`buffer.setUint16(${varName}.length, offset)`)
            encodeCode.add(`offset += 2`)
            encodeCode.add(`buffer.setString(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)

            decodeCode.add(`const ${varName} = buffer.getString(offset + 2, offset  += 2 + buffer.getUint16(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        } else {
            encodeCode.add(`buffer.setUint8(${varName}.length, offset++)`)
            encodeCode.add(`buffer.setString(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)

            decodeCode.add(`const ${varName} = buffer.getString(offset + 1, offset  += 1 + buffer.getUint8(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        }
    })
    fields.varbuf.forEach(({ varName, size, validate }) => {
        if (size === 2) {
            encodeCode.add(`buffer.setUint16(${varName}.length, offset)`),
            encodeCode.add(`offset += 2`)
            encodeCode.add(`buffer.set(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)

            decodeCode.add(`const ${varName} = buffer.subarray(offset + 2, offset += 2 + buffer.getUint16(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        } else {
            encodeCode.add(`buffer.setUint8(${varName}.length, offset++)`)
            encodeCode.add(`buffer.set(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)

            decodeCode.add(`const ${varName} = buffer.subarray(offset + 1, offset += 1 + buffer.getUint8(offset))`)
            if (validate) {
                decodeCode.add(`if (!${validatorPrefix}${varName}(${varName})) return null`)
            }
        }
    })
    fields.varuint.forEach(({ varName }) => {
        encodeCode.add(`buffer.setVarint(${varName}, offset, ${varName}_len)`)
        encodeCode.add(`offset += ${varName}_len`)
        
        decodeCode.add(`const ${varName}_res = buffer.getVarint(offset)`)
        decodeCode.add(`const ${varName} = ${varName}_res.value`)
        decodeCode.add(`offset = ${varName}_res.end`)
    })

    if (fields.enum.length > 0) throw new Error('Enums nested in enums are not supported. (yet)')
}

export { addFieldsStatic, addFieldsDynamic }