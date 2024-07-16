import { ExtendedFieldType } from "../types/definition.js"
import processType from "./processType.js"
import { INTERNAL_TYPES } from "./types.js"

class Args  {
    constructor (name = '') {
        this.name = name
    }
    name: string
    args = new Array<string | Args>()
    varArgs = new Array<string | Args>()
}

const FieldList = Array<{varName: string, size: number, validate: boolean}>

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
    nestedArray: {varName: string, def: DefinitionInfo, objectStructure: string, lenSize: number}[] = []
    enum: {idName: string, varName: string, cases: EnumCase[], usesMappedIds: boolean}[] = []
}

class DefinitionInfo {
    constructor (validate: boolean) {
        this.validate = validate
    }
    validators: Record<string, { test: ExtendedFieldType['test'], type: INTERNAL_TYPES }> = {}
    validate: boolean
    fields = new Fields()
    args = new Args()
    sizeCalc = new Array<string>()
    varuintSizeCalc = new Array<string>()
    fixedSize = 0
    state = {
        valueIndex: 0
    }
    getVarName () {
        return `_${this.state.valueIndex++}`
    }
    getBufferSize () {
        const fixedSize = this.fixedSize + ((this.fields.bool.length + 7) >>> 3)
        this.sizeCalc.push(`${fixedSize}`)
        return this.sizeCalc.join(' + ')
        /* if (this.sizeCalc.length > 0) {
            const sizeCalcString = this.sizeCalc.join(' + ')
            return fixedSize > 0 ? `${fixedSize} + ${sizeCalcString}` : sizeCalcString
        } else {
            return `${fixedSize}`
        } */
    }

    sub () {
        const sub = new DefinitionInfo(this.validate)
        sub.state = this.state
        // sub.varuintSizeCalc = this.varuintSizeCalc
        sub.validators = this.validators
        return sub
    }
}

export {
    Args,
    Fields,
    EnumCase,
    DefinitionInfo
}