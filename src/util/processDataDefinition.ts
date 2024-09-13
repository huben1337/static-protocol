import { ArrayDefintionInternal, DataDefintion, EnumDefintionInternal, ExtendedFieldType } from "../types/definition.js"
import processArrayDefinition from "./processArrayDefinition.js"
import processEnumDefinition from "./processEnumDefinition.js"
import processField from "./processField.js"
import { ArgsObject, DefinitionInfo } from "./structure.js"

const processDataDefinition = (dataDef: DataDefintion, parent: ArgsObject, defInfo: DefinitionInfo) => {
    for (const [name, sub] of Object.entries(dataDef)) {
        if (typeof sub === 'string') {
            processField(sub, name, parent, defInfo, null)
        } else if (('test' in sub) && typeof sub.test === 'function') {
            processField((sub as ExtendedFieldType).type, name, parent, defInfo, sub.test)
        } else if (('isArray' in sub) && sub.isArray === true) {
            const varName = defInfo.getVarName()
            parent.addVar(name, varName)
            processArrayDefinition((sub as ArrayDefintionInternal), varName, defInfo)
        } else if (('isEnum' in sub) && sub.isEnum === true) {
            const varName = defInfo.getVarName()
            parent.add(name, varName)
            processEnumDefinition((sub as EnumDefintionInternal), varName, defInfo)
        } else {
            const child = new ArgsObject()
            processDataDefinition(sub as DataDefintion, child, defInfo)
            parent.addVar(name, child)
        }
    }
}

export default processDataDefinition