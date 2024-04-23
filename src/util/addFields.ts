import { DefinitionInfo, INTERNAL_TYPES } from '../StaticEndpoint.js'
import Code from './Code.js'
import getObjectStructure from './getObjectStructure.js'

const intMethodFromSize = (size: number) => {
    const signed = size < 0
    return `${signed ? 'Int' : 'Uint'}${Math.abs(size) * 8}`
}

function addFieldsStatic (defInfo: DefinitionInfo, encodeCode: Code, decodeCode: Code, bufferOffset: number) {
    const { fields } = defInfo
    fields.int.forEach(({ varName, size, validate }) => {
        const methodType = intMethodFromSize(size)
        encodeCode.add(`buffer.set${methodType}(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.get${methodType}(${bufferOffset})`)
        if (validate) {
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
        }
        bufferOffset += Math.abs(size)
    })
    fields.buf.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.set(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.subarray(${bufferOffset}, ${bufferOffset + size})`)
        if (validate) {
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
        }
        bufferOffset += size
    })
    fields.char.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.setString(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.getString(${bufferOffset}, ${bufferOffset + size})`)
        if (validate) {
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
        }
        bufferOffset += size
    })
    for (let i = 0; i < fields.bool.length; i += 8) {
        const packedBools = fields.bool.slice(i, i + 8 > fields.bool.length ? fields.bool.length : i + 8)
        encodeCode.add(`buffer.setUint8(${packedBools.map(({ varName }, index) => `${varName} << ${index}`).join(' | ')}, ${bufferOffset})`)
        packedBools.forEach(({ varName, validate }, index) => {
            decodeCode.add(`const ${varName} = !!(buffer.getUint8(${bufferOffset}) >>> ${index} & 1)`)
            if (validate) {
                decodeCode.add(`if (!vd${varName}(${varName})) return null`)
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
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
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
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
        } 
    })
    fields.varuint.forEach(({ varName }) => {
        encodeCode.add(`buffer.setVarint(${varName}, offset, ${varName}_len)`)
        encodeCode.add(`offset += ${varName}_len`)
        
        decodeCode.add(`const ${varName}_res = buffer.getVarint(offset)`)
        decodeCode.add(`const ${varName} = ${varName}_res.value`)
        decodeCode.add(`offset = ${varName}_res.end`)
    })

    fields.enum.forEach(({ valueName }) => {
        decodeCode.add(`let ${valueName}`)
    })
    fields.enum.forEach(({ idName, valueName, cases, mappedIds }) => {
        encodeCode.add(`buffer.setUint8(${idName}, offset++)`)
        const encodeSwitch = encodeCode.switch(idName)
        let switchKey: string
        if (mappedIds) {
            switchKey = 'buffer.getUint8(offset++)'
            decodeCode.add(`let ${idName}`)
        } else {
            switchKey = idName
            decodeCode.add(`const ${idName} = buffer.getUint8(offset++)`)
        }
        const decodeSwitch = decodeCode.switch(switchKey)
        cases.forEach(({ id, idString, nested, def, validate }) => {
            const encodeCase = encodeSwitch.case(`${idString ?? id}`)
            const decodeCase = decodeSwitch.case(`${id}`)
            if (mappedIds) {
                decodeCase.add(`${idName} = ${idString}`)
            }
            if (nested) {
                const objStructure = getObjectStructure(def.args.args)
                encodeCase.add(`const {${objStructure}} = ${valueName}`)
                addFieldsDynamic(def, encodeCase, decodeCase)
                decodeCase.add(`${valueName} = {${objStructure}}`)
            } else {
                const { type, size } = def
                switch (type) {
                    case INTERNAL_TYPES.INT: {
                        const methodType = intMethodFromSize(size)
                        if (size === 1 || size === -1) {
                            encodeCase.add(`buffer.set${methodType}(${valueName}, offset++)`)
                            decodeCase.add(`${valueName} = buffer.get${methodType}(offset++)`)
                        } else {
                            const methodType = intMethodFromSize(size)
                            encodeCase.add(`buffer.set${methodType}(${valueName}, offset)`)
                            encodeCase.add(`offset += ${Math.abs(size)}`)
                            decodeCase.add(`${valueName} = buffer.get${methodType}(offset)`)
                            decodeCase.add(`offset += ${Math.abs(size)}`)
                        }
                        break
                    }
                    case INTERNAL_TYPES.BOOL: {
                        encodeCase.add(`buffer.setUint8(${valueName}, offset++)`)
                        decodeCase.add(`${valueName} = !!buffer.getUint8(offset++)`)
                        break
                    }
                    case INTERNAL_TYPES.NONE: {
                        break
                    }
                    case INTERNAL_TYPES.BUF: {
                        encodeCase.add(`buffer.set(${valueName}, offset)`)
                        encodeCase.add(`offset += ${size}`)
                        decodeCase.add(`${valueName} = buffer.subarray(offset, offset += ${size})`)
                        break
                    }
                    case INTERNAL_TYPES.VARBUF: {
                        if (size === 2) {
                            encodeCase.add(`buffer.setUint16(${valueName}.length, offset)`)
                            encodeCase.add(`offset += 2`)
                            encodeCase.add(`buffer.set(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.subarray(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                        } else {
                            encodeCase.add(`buffer.setUint8(${valueName}.length, offset++)`)
                            encodeCase.add(`buffer.set(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.subarray(offset + 1, offset += 1 + buffer.getUint8(offset))`)
                        }
                        break
                    }
                    case INTERNAL_TYPES.CHAR: {
                        encodeCase.add(`buffer.setString(${valueName}, offset)`)
                        encodeCase.add(`offset += ${size}`)
                        decodeCase.add(`${valueName} = buffer.getString(offset, offset += ${size})`)
                        break
                    }
                    case INTERNAL_TYPES.VARCHAR: {
                        if (size === 2) {
                            encodeCase.add(`buffer.setUint16(${valueName}.length, offset)`)
                            encodeCase.add(`offset += 2`)
                            encodeCase.add(`buffer.setString(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.getString(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                        } else {
                            encodeCase.add(`buffer.setUint8(${valueName}.length, offset++)`)
                            encodeCase.add(`buffer.setString(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.getString(offset + 1, offset += 1 + buffer.getUint8(offset))`)
                        }
                        break
                    }
                    default: throw new Error(`Unknown type ${type}`)
                }
                if (validate) {
                    decodeCase.add(`if (!vd${valueName}(${valueName})) return null`)
                }
            }
            encodeCase.add('break')
            decodeCase.add('break')
        })
    })
}

function addFieldsDynamic (defInfo: DefinitionInfo, encodeCode: Code, decodeCode: Code) {
    const { fields } = defInfo
    fields.int.forEach(({ varName, size, validate }) => {
        const methodType = intMethodFromSize(size)
        encodeCode.add(`buffer.set${methodType}(${varName}, offset)`)
        encodeCode.add(`offset += ${Math.abs(size)}`)
        decodeCode.add(`const ${varName} = buffer.get${methodType}(offset)`)
        decodeCode.add(`offset += ${Math.abs(size)}`)
        if (validate) {
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
        }
    })
    fields.buf.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.set(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += ${size})`)
        if (validate) {
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
        }
    })
    fields.char.forEach(({ varName, size, validate }) => {
        encodeCode.add(`buffer.setString(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.getString(offset, offset += ${size})`)
        if (validate) {
            decodeCode.add(`if (!vd${varName}(${varName})) return null`)
        }
    })
    for (let i = 0; i < fields.bool.length; i += 8) {
        const packedBools = fields.bool.slice(i, i + 8 > fields.bool.length ? fields.bool.length : i + 8)
        encodeCode.add(`buffer.setUint8(${packedBools.map(({ varName }, index) => `${varName} << ${index}`).join(' | ')}, offset++)`)
        packedBools.forEach(({ varName, size, validate }, index) => {
            decodeCode.add(`const ${varName} = !!(buffer.getUint8(offset) >>> ${index} & 1)`)
            if (validate) {
                decodeCode.add(`if (!vd${varName}(${varName})) return null`)
            }
        })
        decodeCode.add(`offset++`)
    }
    if (defInfo.sizeCalc.length === 0 && fields.enum.length === 0) return
    fields.varchar.forEach(({ varName, size, validate }) => {
        if (size === 2) {
            encodeCode.add(`buffer.setUint16(${varName}.length, offset)`)
            encodeCode.add(`offset += 2`)
            encodeCode.add(`buffer.setString(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)

            decodeCode.add(`const ${varName} = buffer.getString(offset + 2, offset  += 2 + buffer.getUint16(offset))`)
            if (validate) {
                decodeCode.add(`if (!vd${varName}(${varName})) return null`)
            }
        } else {
            encodeCode.add(`buffer.setUint8(${varName}.length, offset++)`)
            encodeCode.add(`buffer.setString(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)

            decodeCode.add(`const ${varName} = buffer.getString(offset + 1, offset  += 1 + buffer.getUint8(offset))`)
            if (validate) {
                decodeCode.add(`if (!vd${varName}(${varName})) return null`)
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
                decodeCode.add(`if (!vd${varName}(${varName})) return null`)
            }
        } else {
            encodeCode.add(`buffer.setUint8(${varName}.length, offset++)`)
            encodeCode.add(`buffer.set(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)

            decodeCode.add(`const ${varName} = buffer.subarray(offset + 1, offset += 1 + buffer.getUint8(offset))`)
            if (validate) {
                decodeCode.add(`if (!vd${varName}(${varName})) return null`)
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

    /* fields.enum.forEach(({ valueName }) => {
        decodeCode.add(`let ${valueName}`)
    })
    fields.enum.forEach(({ idName, valueName, cases }) => {
        encodeCode.add(`buffer.setUint8(${idName}, offset++)`)
        const encodeSwitch = encodeCode.switch(idName)
        decodeCode.add(`const ${idName} = buffer.getUint8(offset++)`)
        const decodeSwitch = decodeCode.switch(idName)
        cases.forEach(({ id, nested, def }) => {
            const encodeCase = encodeSwitch.case(`${id}`)
            const decodeCase = decodeSwitch.case(`${id}`)
            if (nested) {
                const destructureCode = getObjectStructure(def.args.args)
                encodeCase.add(`const {${destructureCode}} = ${valueName}`)
                addFieldsDynamic(def, encodeCase, decodeCase)
            } else {
                const { type, size } = def
                switch (type) {
                    case INTERNAL_TYPES.INT: {
                        if (size === 1 || size === -1) {
                            encodeCase.add(`buffer.setUint8(${valueName}, offset++)`)
                            decodeCase.add(`${valueName} = buffer.getUint8(offset++)`)
                        } else {
                            const methodType = intMethodFromSize(size)
                            encodeCase.add(`buffer.set${methodType}(${valueName}, offset)`)
                            encodeCase.add(`offset += ${Math.abs(size)}`)
                            decodeCase.add(`${valueName} = buffer.get${methodType}(offset)`)
                            decodeCase.add(`offset += ${Math.abs(size)}`)
                        }
                        break
                    }
                    case INTERNAL_TYPES.BOOL: {
                        encodeCase.add(`buffer.setUint8(${valueName}, offset++)`)
                        decodeCase.add(`${valueName} = !!buffer.getUint8(offset++)`)
                        break
                    }
                    case INTERNAL_TYPES.BUF: {
                        encodeCase.add(`buffer.set(${valueName}, offset)`)
                        encodeCase.add(`offset += ${size}`)
                        decodeCase.add(`${valueName} = buffer.subarray(offset, offset += ${size})`)
                        break
                    }
                    case INTERNAL_TYPES.VARBUF: {
                        if (size === 2) {
                            encodeCase.add(`buffer.setUint16(${valueName}.length, offset)`)
                            encodeCase.add(`offset += 2`)
                            encodeCase.add(`buffer.set(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.subarray(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                        } else {
                            encodeCase.add(`buffer.setUint8(${valueName}.length, offset++)`)
                            encodeCase.add(`buffer.set(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.subarray(offset + 1, offset += 1 + buffer.getUint8(offset))`)
                        }
                        break
                    }
                    case INTERNAL_TYPES.CHAR: {
                        encodeCase.add(`buffer.setString(${valueName}, offset)`)
                        encodeCase.add(`offset += ${size}`)
                        decodeCase.add(`${valueName} = buffer.getString(offset, offset += ${size})`)
                        break
                    }
                    case INTERNAL_TYPES.VARCHAR: {
                        if (size === 2) {
                            encodeCase.add(`buffer.setUint16(${valueName}.length, offset)`)
                            encodeCase.add(`offset += 2`)
                            encodeCase.add(`buffer.setString(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.getString(offset + 2, offset += 2 + buffer.getUint16(offset))`)
                        } else {
                            encodeCase.add(`buffer.setUint8(${valueName}.length, offset++)`)
                            encodeCase.add(`buffer.setString(${valueName}, offset)`)
                            encodeCase.add(`offset += ${valueName}.length`)

                            decodeCase.add(`${valueName} = buffer.getString(offset + 1, offset += 1 + buffer.getUint8(offset))`)
                        }
                        break
                    }
                    default: throw new Error(`Unknown type ${type}`)
                }
            }
            encodeCase.add('break')
            decodeCase.add('break')
        })
    }) */
}

export { addFieldsStatic, addFieldsDynamic }