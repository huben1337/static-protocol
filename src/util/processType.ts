import { InputDataTypes } from "../types/definition.js"
import { INTERNAL_TYPES } from "./types.js"

const extractType = (def: keyof InputDataTypes | 'none') => {
    const defMatch = /^([a-zA-Z]+):?([0-9]+)?$/.exec(def)
    if (defMatch === null) throw new Error(`Invalid type: ${def.toString()}`)
    const [,type, bytes] = defMatch
    return { type, bytes }
}

const processType = (def: keyof InputDataTypes | 'none') => {
    const { type, bytes } = extractType(def)
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
                if (maxSize >= 1 << 16) throw new Error('Max string length is 65535')
                if (maxSize >= 1 << 8) {
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
                type: type === 'int' ? INTERNAL_TYPES.INT : INTERNAL_TYPES.UINT,
                size
            }
        }
        default: {
            throw new Error(`Unknown type ${type}`)            
        }
    }
}

export default processType
export { extractType }