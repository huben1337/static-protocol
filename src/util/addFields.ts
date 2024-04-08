import { DefinitionInfo, INTERNAL_TYPES } from '../StaticEndpoint.js'
import Code from './Code.js'
import getObjectStructure from './getObjectStructure.js'

const intMethodFromSize = (size: number) => {
    const signed = size < 0
    return `${signed ? 'Int' : 'Uint'}${Math.abs(size) * 8}`
}

function addFieldsStatic (defInfo: DefinitionInfo, encodeCode: Code, decodeCode: Code, bufferOffset: number) {
    const { fields } = defInfo
    fields.int.forEach(({ varName, size }) => {
        if (size === 1 || size === -1) {
            encodeCode.add(`buffer.setUint8(${varName}, ${bufferOffset})`)
            decodeCode.add(`const ${varName} = buffer.getUint8(${bufferOffset})`)
        } else {
            const methodType = intMethodFromSize(size)
            encodeCode.add(`buffer.set${methodType}(${varName}, ${bufferOffset})`)
            decodeCode.add(`const ${varName} = buffer.get${methodType}(${bufferOffset})`)
        }
        bufferOffset += size
    })
    fields.buf.forEach(({ varName, size }) => {
        encodeCode.add(`buffer.set(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.subarray(${bufferOffset}, ${bufferOffset + size})`)
        bufferOffset += size
    })
    fields.char.forEach(({ varName, size }) => {
        encodeCode.add(`buffer.setString(${varName}, ${bufferOffset})`)
        decodeCode.add(`const ${varName} = buffer.getString(${bufferOffset}, ${bufferOffset + size})`)
        bufferOffset += size
    })
    for (let i = 0; i < fields.bool.length; i += 8) {
        const packedBools = fields.bool.slice(i, i + 8 > fields.bool.length ? fields.bool.length : i + 8).map(({ varName }) => varName)
        encodeCode.add(`buffer.setUint8(${packedBools.map((varName, index) => `${varName} << ${index}`).join(' | ')}, ${bufferOffset})`)
        packedBools.forEach((varName, index) => decodeCode.add(`const ${varName} = !!(buffer.getUint8(${bufferOffset}) >> ${index} & 1)`))
        bufferOffset++
    }
    if (fields.varchar.length > 0 || fields.varbuf.length > 0 || fields.enum.length > 0) {
        let tempOffset = bufferOffset
        for (let i = 0; i < fields.varchar.length; i++) {
            const { varName, size } = fields.varchar[i]
            if (size === 2) {
                encodeCode.add(`buffer.setUint16(${varName}.length, ${bufferOffset})`)
                bufferOffset += 2
            } else {
                encodeCode.add(`buffer.setUint8(${varName}.length, ${bufferOffset})`)
                bufferOffset++
            } 
            
        }
        for (let i = 0; i < fields.varbuf.length; i++) {
            const { varName, size } = fields.varbuf[i];
            if (size === 2) {
                encodeCode.add(`buffer.setUint16(${varName}.length, ${bufferOffset})`)
                bufferOffset += 2
            } else {
                encodeCode.add(`buffer.setUint8(${varName}.length, ${bufferOffset})`)
                bufferOffset++
            }
        }

        encodeCode.add(`let offset = ${bufferOffset}`)
        decodeCode.add(`let offset = ${bufferOffset}`)

        for (let i = 0; i < fields.varchar.length; i++) {
            const { varName, size } = fields.varchar[i];
            encodeCode.add(`buffer.setString(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)
            if (size === 2) {
                decodeCode.add(`const ${varName} = buffer.getString(offset, offset += buffer.getUint16(${tempOffset}))`)
                tempOffset += 2
            } else {
                decodeCode.add(`const ${varName} = buffer.getString(offset, offset += buffer.getUint8(${tempOffset}))`)
                tempOffset++
            }
            
        }
        for (let i = 0; i < fields.varbuf.length; i++) {
            const { varName, size } = fields.varbuf[i];
            encodeCode.add(`buffer.set(${varName}, offset)`)
            encodeCode.add(`offset += ${varName}.length`)
            if (size === 2) {
                decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += buffer.getUint16(${tempOffset}))`)
                tempOffset += 2
            } else {
                decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += buffer.getUint8(${tempOffset}))`)
                tempOffset++
            }
            
        }

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
            cases.forEach(({ id, idString, nested, def }) => {
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
                            if (size === 1 || size === -1) {
                                encodeCase.add(`buffer.setUint8(${valueName}, offset++)`)
                                decodeCase.add(`${valueName} = buffer.getUint8(offset++)`)
                            } else {
                                const methodType = intMethodFromSize(size)
                                encodeCase.add(`buffer.setString${methodType}(${valueName}, offset)`)
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
        })
        
    }
}

function addFieldsDynamic (defInfo: DefinitionInfo, encodeCode: Code, decodeCode: Code) {
    const { fields } = defInfo
    fields.int.forEach(({ varName, size }) => {
        if (size === 1 || size === -1) {
            encodeCode.add(`buffer.setUint8(${varName}, offset++)`)
            decodeCode.add(`const ${varName} = buffer.getUint8(offset++)`)
        } else {
            const methodType = intMethodFromSize(size)
            encodeCode.add(`buffer.setString${methodType}(${varName}, offset)`)
            encodeCode.add(`offset += ${Math.abs(size)}`)
            decodeCode.add(`const ${varName} = buffer.get${methodType}(offset)`)
            decodeCode.add(`offset += ${Math.abs(size)}`)
        }
    })
    fields.buf.forEach(({ varName, size }) => {
        encodeCode.add(`buffer.set(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.subarray(offset, offset += ${size})`)
    })
    fields.char.forEach(({ varName, size }) => {
        encodeCode.add(`buffer.setString(${varName}, offset)`)
        encodeCode.add(`offset += ${size}`)
        decodeCode.add(`const ${varName} = buffer.getString(offset, offset += ${size})`)
    })
    for (let i = 0; i < fields.bool.length; i += 8) {
        const packedBools = fields.bool.slice(i, i + 8 > fields.bool.length ? fields.bool.length : i + 8).map(({ varName }) => varName)
        encodeCode.add(`buffer.setUint8(${packedBools.map((varName, index) => `${varName} << ${index}`).join(' | ')}, offset++)`)
        packedBools.forEach((varName, index) => decodeCode.add(`const ${varName} = !!(buffer.getUint8(offset) >> ${index} & 1)`))
        decodeCode.add(`offset++`)
    }
    if (fields.varchar.length > 0 || fields.varbuf.length > 0 || fields.enum.length > 0) {
        // let tempOffset = bufferOffset
        for (let i = 0; i < fields.varchar.length; i++) {
            const { varName, size } = fields.varchar[i]
            if (size === 2) {
                encodeCode.add(`buffer.setUint16(${varName}.length, offset)`)
                encodeCode.add(`offset += 2`)
                encodeCode.add(`buffer.setString(${varName}, offset)`)
                encodeCode.add(`offset += ${varName}.length`)

                decodeCode.add(`const ${varName} = buffer.getString(offset + 2, offset  += 2 + buffer.getUint16(offset))`)
            } else {
                encodeCode.add(`buffer.setUint8(${varName}.length, offset++)`)
                encodeCode.add(`buffer.setString(${varName}, offset)`)
                encodeCode.add(`offset += ${varName}.length`)

                decodeCode.add(`const ${varName} = buffer.getString(offset + 1, offset  += 1 + buffer.getUint8(offset))`)
            } 
            
        }
        for (let i = 0; i < fields.varbuf.length; i++) {
            const { varName, size } = fields.varbuf[i];
            if (size === 2) {
                encodeCode.add(`buffer.setUint16(${varName}.length, offset)`),
                encodeCode.add(`offset += 2`)
                encodeCode.add(`buffer.set(${varName}, offset)`)
                encodeCode.add(`offset += ${varName}.length`)

                decodeCode.add(`const ${varName} = buffer.subarray(offset + 2, offset += 2 + buffer.getUint16(offset))`)
            } else {
                encodeCode.add(`buffer.setUint8(${varName}.length, offset++)`)
                encodeCode.add(`buffer.set(${varName}, offset)`)
                encodeCode.add(`offset += ${varName}.length`)

                decodeCode.add(`const ${varName} = buffer.subarray(offset + 1, offset += 1 + buffer.getUint8(offset))`)
            }
        }

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
                                encodeCase.add(`buffer.setString${methodType}(${valueName}, offset)`)
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
}

export { addFieldsStatic, addFieldsDynamic }