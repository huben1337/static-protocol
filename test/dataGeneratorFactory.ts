import type { StaticEndpointType } from "../src/StaticEndpoint.js"
import type { ArrayDefintionInternal, DataDefintion, Definition, EnumDefintionInternal, ExtendedFieldType, FieldTypes, InputDataTypes, IntTypes } from "../src/types/definition.js"
import { DeepReadonly, InferedEndpointDefintion } from "../src/types/helpers.js"
import { extractType } from "../src/util/processType.js"
import encoding from "../src/util/text.js"

export const random = {
    between: (min: number, max: number) => Math.floor(Math.random() * (max - min) + min),
    arrayElement: <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)]
}

const varLegnth = (long: boolean) => long ? random.between(0, 270) : random.between(0, 30)


export const generators: {
    [K in keyof IntTypes]: () => IntTypes[K]
} & {
    bool: () => boolean
    char: (length: number) => string
    varchar: (long: boolean) => string
    buf: (length: number) => Uint8Array
    varbuf: (long: boolean) => Uint8Array
    array: <T>(long: boolean, gen: () => T) => T[]
    enum: (map: [id: number | string, gen: () => unknown][]) => {
        id: number | string
        value: unknown
    }
} = {
    uint8: () => (Math.random() * 0xff) >>> 0,
    int8: () => generators.uint8() - (1 << 7),
    uint16: () => (Math.random() * 0xffff) >>> 0,
    int16: () => generators.uint16() - (1 << 15),
    uint24: () => (Math.random() * 0xffffff) >>> 0,
    int24: () => generators.uint24() - ((1 << 23) >>> 0),
    uint32: () => (Math.random() * 0xffffffff) >>> 0,
    int32: () => generators.uint32() - ((1 << 31) >>> 0),
    uint64: () => BigInt(generators.uint32()) << 32n | BigInt(generators.uint32()),
    int64: () => generators.uint64() - (1n << 63n),
    bool: () => Math.random() > 0.5,
    char: (length: number) => {
        const buf = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
            buf[i] = (Math.random() * 128) >>> 0
        }
        return encoding.decode(buf)
    },
    varchar: (long: boolean) => generators.char(varLegnth(long)),
    buf: (length: number) => {
        const buf = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
            buf[i] = generators.uint8()
        }
        return buf
    },
    varbuf: (long: boolean) => generators.buf(varLegnth(long)),
    array: (long, gen) => Array.from({ length: varLegnth(long) }, () => gen()),
    enum: (map) => {
        const [id, gen] = random.arrayElement(map)
        return { id, value: gen() }
    }
}



const dataGeneratorFactory = <T extends StaticEndpointType<InferedEndpointDefintion<T>>>(endpoint: T) => {
    const dataDefinition = (endpoint.definition as DeepReadonly<Definition>).data
    if (!dataDefinition) return (() => undefined) as () => Parameters<T['encode']>[0]
    const code = `const { generators } = this\nreturn (() => ${addDataGenerator(dataDefinition)})`
    return Function.call(null, code).call({
        generators
    }) as () => Parameters<T['encode']>[0]
}


const getFieldGenerator = (defintion: keyof InputDataTypes | 'none') => {
    const { type, bytes } = extractType(defintion)
    switch (type) {
        case 'buf':
        case 'char': {
            const size = parseInt(bytes)
            return `generators.${type}(${size})`
        }
        case 'varbuf':
        case 'varchar': {
            if (bytes) {
                const maxSize = parseInt(bytes)
                return `generators.${type}(${maxSize > 255 ? 'true' : 'false'})`
            } else {
                return `generators.${type}(false)`
            }
        }
        case 'int':
        case 'uint':
            return `generators.${type}${bytes}()`

        case 'bool':
            return 'generators.bool()'
    }
    return 'undefined'
}

const getArrayGenerator = (defintion: ArrayDefintionInternal): string => {
    const { def, long } = defintion
    return `generators.array(${long}, () => ${processFieldType(def)})`
    /* if (typeof def === 'string') {
        return `${start}${getFieldGenerator(def)})`
    } else if ('test' in def && typeof def.test === 'function') {
        return `${start}${getFieldGenerator((def as ExtendedFieldType).type)})`
    } else if ('isArray' in def) {
        return `${start}(${getArrayGenerator(def as ArrayDefintionInternal)}))`
    } else {
        return `${start}${addDataGenerator(def as DataDefintion)})`
    } */
}

const getEnumGenerator = (defintion: EnumDefintionInternal) => {
    const map: string[] = []
    const { def } = defintion
    for (const [id, type] of Object.entries(def)) {
        if (/^[0-9]+$/.test(id)) {
            map.push(`[${id}, () => ${processFieldType(type)}]`)
        } else {
            map.push(`['${id}',() => ${processFieldType(type)}]`)
        }
    }
    return `generators.enum([${map.join(', ')}])`
}

const processFieldType = (def: FieldTypes | 'none') => {
    if (typeof def === 'string') {
        return getFieldGenerator(def)
    } else if ('test' in def && typeof def.test === 'function') {
        return getFieldGenerator((def as ExtendedFieldType).type)
    } else if ('isArray' in def) {
        return getArrayGenerator(def as ArrayDefintionInternal)
    } else if ('isEnum' in def) {
        return getEnumGenerator(def as EnumDefintionInternal)
    } else {
        return addDataGenerator(def as DataDefintion)
    }
}


const addDataGenerator = (defintion: DataDefintion): string | undefined => {
    const mapped = new Array<string>()
    Object.entries(defintion).forEach(([name, def]) => {
        const value = processFieldType(def)
        if (value) {
            mapped.push(`${name}: ${value}`)
        }
    })

    if (mapped.length === 0) return undefined
    return `({${mapped.join(', ')}})`
}

export default dataGeneratorFactory