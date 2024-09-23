import { ArrayDefintionInternal, DataDefintion, EnumDefintionInternal, ExtendedFieldType } from "../types/definition.js"
import processArrayDefinition from "./processArrayDefinition.js"
import processEnumDefinition from "./processEnumDefinition.js"
import processField from "./processField.js"
import { DefinitionInfo } from "./structure.js"

const processDataDefinition = (dataDef: DataDefintion, defInfo: DefinitionInfo, parent = defInfo.args) => {
    for (const [name, sub] of Object.entries(dataDef)) {
        if (typeof sub === 'string') {
            processField(sub, name, parent, defInfo, null)
        } else if (('test' in sub) && typeof sub.test === 'function') {
            processField((sub as ExtendedFieldType).type, name, parent, defInfo, sub.test)
        } else if (('isArray' in sub) && sub.isArray === true) {
            const varName = processArrayDefinition((sub as ArrayDefintionInternal), defInfo)
            parent.addVar(name, varName)
        } else if (('isEnum' in sub) && sub.isEnum === true) {
            const varName = processEnumDefinition((sub as EnumDefintionInternal), defInfo)
            parent.add(name, varName)
        } else {
            const child = parent.sub(name)
            processDataDefinition(sub as DataDefintion, defInfo, child)
        }
    }
}

export default processDataDefinition