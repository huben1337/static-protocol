import { Definition } from "../types/definition.js"
import processDataDefinition from "./processDataDefinition.js"
import { DefinitionInfo } from "./structure.js"

const processDefinition = (definition: Definition) => {
    const defInfo = new DefinitionInfo(definition.validate !== false)
    if (definition.data) {
        processDataDefinition(definition.data, defInfo.args, defInfo)
    }
    return defInfo
}
export default processDefinition