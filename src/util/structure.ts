import { ExtendedFieldType } from "../types/definition.js"
import processType from "./processType.js"
import { INTERNAL_TYPES } from "./types.js"

export type ObjectStrcture = { name: string, value: string | ArgsObject }[]

class ArgsObject {
    private readonly args: ObjectStrcture = []
    private readonly varArgs: ObjectStrcture = []

    toString () {
        return ArgsObject.getObjectStructure(this.args)
    }

    varArgsToString () {
        return ArgsObject.getObjectStructure(this.varArgs)
    }

    private static getObjectStructure (args: ObjectStrcture) {
        const mapped = new Array<string>()
        args.forEach(({ name, value }) => {
            if (typeof value === 'string') {
                mapped.push(`${name}: ${value}`)
            } else {
                const objectStructure = this.getObjectStructure(value.args)
                if (objectStructure) {
                    mapped.push(`${name}: ${objectStructure}`)
                }
            }
        })
        if (mapped.length === 0) return undefined
        return `{ ${mapped.join(', ')} }`
    }

    add (name: string, value: string | ArgsObject) {
        this.args.push({ name, value })
    }

    addVar (name: string, value: string | ArgsObject) {
        const prop = { name, value }
        this.args.push(prop)
        this.varArgs.push(prop)
    }
}

export type Field = { varName: string, size: number, validate: boolean }

const FieldList = Array<Field>

type EnumCase = { 
    id: number,
    idString?: string,
    nested: true,
    def: DefinitionInfo
    validate: boolean
} | { 
    id: number,
    idString?: string,
    nested: false,
    def: ReturnType<typeof processType>
    validate: boolean
}

const EnumFieldList = Array<{idName: string, varName: string, cases: EnumCase[], usesMappedIds: boolean}>

class Fields {
    buf = new FieldList()
    varbuf = new FieldList()
    char = new FieldList()
    varchar = new FieldList()
    uint = new FieldList()
    int = new FieldList()
    varuint = new FieldList()
    bool = new FieldList()
    none = new FieldList()
    array: {varName: string, def: ReturnType<typeof processType>, lenSize: number, validate: boolean}[] = []
    nestedArray: {varName: string, def: DefinitionInfo, objectStructure: string | undefined, lenSize: number}[] = []
    enum = new EnumFieldList()
}


class DefinitionInfo {
    constructor (validate: boolean, topLevel = false) {
        this.validate = validate
        this.topLevel = topLevel
    }
    
    readonly topLevel: boolean
    validators: Record<string, { test: ExtendedFieldType['test'], type: INTERNAL_TYPES }> = {}
    validate: boolean
    fields = new Fields()
    args = new ArgsObject()
    varuintSizeCalc = new Array<string>()


    state = {
        valueIndex: 0
    }

    getVarName () {
        return `_${this.state.valueIndex++}`
    }


    baseSize = 0
    computedSize = new Array<string>()
    addLegnth (varname: string) {
        this.computedSize.push(`${varname}${this.topLevel ? '_' : '.'}length`)
    }
    hasSizeCalc () {
        return this.computedSize.length > 0 || this.getBaseSize() > 0
    }

    getBaseSize () {
        return this.baseSize + ((this.fields.bool.length + 7) >>> 3)
    }
    getSizeCalc () {
        const baseSize = this.getBaseSize()
        if (this.computedSize.length > 0) {
            return `${this.computedSize.join(' + ')}${baseSize > 0 ? ` + ${baseSize}` : ''}`
        } else {
            return `${baseSize}`
        }
    }

    sub () {
        const sub = new DefinitionInfo(this.validate)
        sub.state = this.state
        sub.validators = this.validators
        return sub
    }
}

export {
    ArgsObject,
    Fields,
    EnumCase,
    DefinitionInfo
}