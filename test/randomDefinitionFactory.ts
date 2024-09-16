import { Enum, List } from '../src/StaticEndpoint.js'
import { random } from './dataGeneratorFactory.js'
import { DataDefintion, Definition, EnumDefintion, InputDataTypes, IntTypes } from '../src/types/definition.js'


type VarSizedInputFieldTypes = [`char:${number}`, `buf:${number}`, `varbuf:${number}`, `varchar:${number}`]

type FixedSizeInputFieldTypes = ['uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'uint64', 'int64', 'bool']

const allFixedSizeFieldTypes: FixedSizeInputFieldTypes = ['uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'uint64', 'int64', 'bool']

type MappedToFunctionTuple<I extends unknown[], O extends unknown[] = []> = I extends [infer F, ...infer R] ? MappedToFunctionTuple<R, [() => F, ...O]> : O

const allVarSizeFieldTypes: MappedToFunctionTuple<VarSizedInputFieldTypes> = [
    () => `varchar:${random.between(250, 270)}`,
    () => `varbuf:${random.between(250, 270)}`,
    () => `buf:${random.between(10, 270)}`,
    () => `char:${random.between(10, 270)}`
]



const randomFieldTypeFactory = (fieldTypesConfig: FieldTypeConfiguration) => {
    const fixedSizeFieldTypes: (keyof InputDataTypes)[] = []
    const varSizeFieldTypes: (() => (keyof InputDataTypes))[] = []
    for (const type of allFixedSizeFieldTypes) {
        const enabled = fieldTypesConfig[type] ?? true
        if (!enabled) continue
        fixedSizeFieldTypes.push(type)
    }
    for (const type of ['buf', 'char'] as const) {
        const typeConfig = fieldTypesConfig[type]
        if (Array.isArray(typeConfig)) {
            const [min, max] = typeConfig
            varSizeFieldTypes.push(() => `${type}:${random.between(min, max)}`)
        } else if (typeConfig !== false) {
            varSizeFieldTypes.push(() => `${type}:${random.between(10, 270)}`)
        }
    }
    for (const type of ['varbuf','varchar'] as const) {
        const typeConfig = fieldTypesConfig[type]
        if (Array.isArray(typeConfig)) {
            const [min, max] = typeConfig
            varSizeFieldTypes.push(() => `${type}:${random.between(min, max)}`)
        } else if (typeConfig !== false) {
            varSizeFieldTypes.push(() => `${type}:${random.between(250, 270)}`)
        }
    }
    return (): keyof InputDataTypes => {
        const max = fixedSizeFieldTypes.length + varSizeFieldTypes.length
        const rand = random.between(0, max)
        if (rand < fixedSizeFieldTypes.length) {
            return fixedSizeFieldTypes[rand]
        } else {
            return varSizeFieldTypes[rand - fixedSizeFieldTypes.length]()
        }
    }
}

const randomEnumFactory = (options: RandomDefinitionOptions, randomFieldType: () => keyof InputDataTypes) => {
    const randomEnumDataDefinition = randomEnumDataDefinitionFactory(options, randomFieldType)
    return (maxDepth: number): EnumDefintion => {
        const numEnums = random.between(4, 10)
        const enumDef: EnumDefintion = {}
        for (let i = 0; i < numEnums; i++) {
            const rand = Math.random()
            const id = Math.random() > 0.5 ? `e${i}` : i
            if (maxDepth < 1 || rand < 0.5) {
                enumDef[id] = randomFieldType()
            } else if (rand < 0.8) {
                enumDef[id] = randomEnumDataDefinition(--maxDepth)
            } else {
                enumDef[id] = List(Math.random() < 0.5 ? randomEnumDataDefinition(--maxDepth) : randomFieldType())
            }
        }
    
        return enumDef
    }
}

const randomEnumDataDefinitionFactory = (options: RandomDefinitionOptions, randomFieldType: () => keyof InputDataTypes) => {
    const allowArrays = options.allowArrays ?? true
    // const allowEnums = options.allowEnums ?? true
    const randomEnumDataDefinition = (maxDepth: number): DataDefintion => {
        // Doesnt nest enums
        const fields: DataDefintion = {}
        const numFields = random.between(maxDepth, maxDepth + 4)
        for (let i = 0; i < numFields; i++) {
            const rand = Math.random()
            if (maxDepth < 1) {
                fields[`f${i}`] = randomFieldType()
            } else if (rand < 0.35) {
                fields[`f${i}`] = randomEnumDataDefinition(--maxDepth)
            } else if (allowArrays && rand < 0.45) {
                fields[`f${i}`] = List(Math.random() < 0.5 ? randomEnumDataDefinition(--maxDepth) : randomFieldType())
            } else {
                fields[`f${i}`] = randomFieldType()
            }
        }
      
        return fields
    }

    return randomEnumDataDefinition
}

const randomDataDefinitionFactory = (options: RandomDefinitionOptions) => {
    const randomFieldType = randomFieldTypeFactory(options.fieldTypesConfig ?? {})
    const randomEnum = randomEnumFactory(options, randomFieldType)
    const allowArrays = options.allowArrays ?? true
    const allowEnums = options.allowEnums ?? true
    const randomDataDefinition = (maxDepth: number): DataDefintion => {
        const fields: DataDefintion = {}
        const numFields = random.between(maxDepth, maxDepth + 4)
        for (let i = 0; i < numFields; i++) {
            const rand = Math.random()
            if (maxDepth < 1) {
                fields[`f${i}`] = randomFieldType()
            } else if (rand < 0.3) {
                fields[`f${i}`] = randomDataDefinition(--maxDepth)
            } else if (allowArrays && rand < 0.4) {
                fields[`f${i}`] = List(Math.random() < 0.5 ? randomDataDefinition(--maxDepth) : randomFieldType())
            } else if (allowEnums && rand < 0.5) {
                fields[`f${i}`] = Enum(randomEnum(--maxDepth))
            } else {
                fields[`f${i}`] = randomFieldType()
            }
        }
      
        return fields
    }

    return randomDataDefinition
}

type FieldTypeConfiguration = {
    [K in keyof IntTypes]?: boolean
} & {
    bool?: boolean
    varchar?: boolean | [min: number, max: number]
    varbuf?: boolean | [min: number, max: number]
    char?: boolean |  [min: number, max: number]
    buf?: boolean | [min: number, max: number]
}

type RandomDefinitionOptions = {
    maxDepth?: number
    validate?: boolean
    hasChannel?: boolean
    allocateNew?: boolean
    allowEnums?: boolean
    allowArrays?: boolean
    fieldTypesConfig?: FieldTypeConfiguration
}

const randomDefintionFactory = (options: RandomDefinitionOptions = {}) => {
    const randomDataDefinition = randomDataDefinitionFactory(options)
    const maxDepth = options.maxDepth ?? 3
    const { allocateNew, validate, hasChannel } = options
    return (): Definition => ({
        data: randomDataDefinition(maxDepth),
        channel: hasChannel ? Math.floor(Math.random() * 256) : undefined,
        allocateNew,
        validate,
    })
}


export default randomDefintionFactory

const _randomFieldType = (): keyof InputDataTypes => {
    const max = allFixedSizeFieldTypes.length + allVarSizeFieldTypes.length
    const rand = random.between(0, max)
    if (rand < allFixedSizeFieldTypes.length) {
        return allFixedSizeFieldTypes[rand]
    } else {
        return allVarSizeFieldTypes[rand - allFixedSizeFieldTypes.length]()
    }
}

const _randomEnumDataDefinition = (maxDepth: number): DataDefintion => {
    // Doesnt nest enums
    const fields: DataDefintion = {}
    const numFields = random.between(maxDepth, maxDepth + 4)
    for (let i = 0; i < numFields; i++) {
        const rand = Math.random()
        if (maxDepth < 1 || rand < 0.5) {
            fields[`f${i}`] = _randomFieldType()
        } else if (rand < 0.85) {
            fields[`f${i}`] = _randomEnumDataDefinition(--maxDepth)
        } else {
            fields[`f${i}`] = List(Math.random() < 0.5 ? _randomEnumDataDefinition(--maxDepth) : _randomFieldType())
        }
    }
  
    return fields
}

const _randomEnum = (maxDepth: number): EnumDefintion => {
    const numEnums = random.between(4, 10)
    const enumDef: EnumDefintion = {}
    for (let i = 0; i < numEnums; i++) {
        const rand = Math.random()
        const id = Math.random() > 0.5 ? `e${i}` : i
        if (maxDepth < 1 || rand < 0.5) {
            enumDef[id] = _randomFieldType()
        } else if (rand < 0.8) {
            enumDef[id] = _randomEnumDataDefinition(--maxDepth)
        } else {
            enumDef[id] = List(Math.random() < 0.5 ? _randomEnumDataDefinition(--maxDepth) : _randomFieldType())
        }
    }

    return enumDef
}

const _randomDataDefinition = (maxDepth: number): DataDefintion => {
    const fields: DataDefintion = {}
    const numFields = random.between(maxDepth, maxDepth + 4)
    for (let i = 0; i < numFields; i++) {
        const rand = Math.random()
        if (maxDepth < 1 || rand < 0.5) {
            fields[`f${i}`] = _randomFieldType()
        } else if (rand < 0.8) {
            fields[`f${i}`] = _randomDataDefinition(--maxDepth)
        } else if (rand < 0.9) {
            fields[`f${i}`] = List(Math.random() < 0.5 ? _randomDataDefinition(--maxDepth) : _randomFieldType())
        } else {
            fields[`f${i}`] = Enum(_randomEnum(--maxDepth))
        }
    }
  
    return fields
}

export {
    _randomDataDefinition
}
