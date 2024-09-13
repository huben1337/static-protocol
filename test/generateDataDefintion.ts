import { Enum, List } from "../src/StaticEndpoint.js"
import { random } from "./dataGeneratorFactory.js"
import { DataDefintion, EnumDefintion, InputDataTypes } from "../src/types/definition.js"



const fieldTypes: Exclude<keyof InputDataTypes, `char:${number}` | `buf:${number}`>[] = ['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64', 'bool', 'varchar', 'varbuf']

const randomFieldType = (): keyof InputDataTypes => {
    const max = fieldTypes.length + 1
    const rand = random.between(0, max)
    if (rand < fieldTypes.length) {
        return fieldTypes[rand]
    }
    const div = 1 / max
    if (rand > (1 - div)) {
        return `char:${random.between(100, 270)}`
    }
    return `buf:${random.between(100, 270)}`
}

function randomEnum (maxDepth: number): EnumDefintion {
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

function randomEnumDataDefinition(maxDepth: number): DataDefintion {
    // Doesnt nest enums
    const fields: DataDefintion = {}
    const numFields = random.between(maxDepth, maxDepth + 4)
    for (let i = 0; i < numFields; i++) {
        const rand = Math.random()
        if (maxDepth < 1 || rand < 0.5) {
            fields[`f${i}`] = randomFieldType()
        } else if (rand < 0.85) {
            fields[`f${i}`] = randomEnumDataDefinition(--maxDepth)
        } else {
            fields[`f${i}`] = List(Math.random() < 0.5 ? randomEnumDataDefinition(--maxDepth) : randomFieldType())
        }
    }
  
    return fields
}

function randomDataDefinition(maxDepth: number): DataDefintion {
    const fields: DataDefintion = {}
    const numFields = random.between(maxDepth, maxDepth + 4)
    for (let i = 0; i < numFields; i++) {
        const rand = Math.random()
        if (maxDepth < 1 || rand < 0.5) {
            fields[`f${i}`] = randomFieldType()
        } else if (rand < 0.8) {
            fields[`f${i}`] = randomDataDefinition(--maxDepth)
        } else if (rand < 0.9) {
            fields[`f${i}`] = List(Math.random() < 0.5 ? randomDataDefinition(--maxDepth) : randomFieldType())
        } else {
            fields[`f${i}`] = Enum(randomEnum(--maxDepth))
        }
    }
  
    return fields
}

export default randomDataDefinition