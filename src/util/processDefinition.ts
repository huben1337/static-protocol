import { ArrayDefintionInternal, DataDefintion, EnumDefintionInternal, ExtendedFieldType } from "../types/definition.js"
import processArrayDefinition from "./processArrayDefinition.js"
import processEnumDefinition from "./processEnumDefinition.js"
import processField from "./processField.js"
import { Args, DefinitionInfo } from "./structure.js"

const processDefinition = (def: DataDefintion, parent: Args, defInfo: DefinitionInfo) => {
    for (const name in def) {
        const sub = def[name]
        if (typeof sub === 'string') {
            processField(sub, name, parent, defInfo, null)
        } else if (('test' in sub) && typeof sub.test === 'function') {
            processField((sub as ExtendedFieldType).type, name, parent, defInfo, sub.test)
        } else if (('isArray' in sub) && sub.isArray === true) {
            processArrayDefinition((sub as ArrayDefintionInternal), name, parent, defInfo)
        } else if (('isEnum' in sub) && sub.isEnum === true) {
            processEnumDefinition((sub as EnumDefintionInternal), name, parent, defInfo)
        } else {
            const child = new Args(name)
            processDefinition(sub as DataDefintion, child, defInfo)
            parent.args.push(child)
            parent.varArgs.push(child)
        }
    }
}

export default processDefinition