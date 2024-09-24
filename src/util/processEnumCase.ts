import { ArrayDefintionInternal, DataDefintion, EnumFieldTypes, ExtendedFieldType } from "../types/definition.js"
import processArrayDefinition from "./processArrayDefinition.js"
import processDataDefinition from "./processDataDefinition.js"
import processType from "./processType.js"
import { DefinitionInfo, EnumCase } from "./structure.js"

export default (typeDef: EnumFieldTypes, id: number, defInfo: DefinitionInfo, idString: string, valueName: string): EnumCase => {
    if (typeof typeDef === 'string') { // throw new Error('Enum can onbly specify type as string')
        return {
            id,
            idString,
            nested: false,
            def: processType(typeDef),
            validate: false
        }
    } else if (('validate' in typeDef) && typeDef.validate === true) {
        const typeInfo = processType((typeDef as ExtendedFieldType).type)
        const validate = defInfo.validate
        if (validate) {
            defInfo.fieldsToValidate.push(valueName)
        }
        return {
            id,
            idString,
            nested: false,
            def: typeInfo,
            validate
        }
    } else if (('isArray' in typeDef) && typeDef.isArray === true) {
        const subDefInfo = defInfo.sub()
        processArrayDefinition((typeDef as ArrayDefintionInternal), subDefInfo, `${valueName}.value`)
        return {
            id,
            idString,
            nested: true,
            def: subDefInfo,
            validate: false
        }
    } else {
        const subDefInfo = defInfo.sub()
        processDataDefinition(typeDef as DataDefintion, subDefInfo)
        return {
            id,
            idString,
            nested: true,
            def: subDefInfo,
            validate: false
        }
    }
}