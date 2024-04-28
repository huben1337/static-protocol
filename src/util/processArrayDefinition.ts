import getObjectStructure from "../codegen/getObjectStructure.js";
import { ArrayDefintionInternal, DataDefintion, ExtendedFieldType } from "../types/definition.js";
import processDefinition from "./processDefinition.js";
import processType from "./processType.js";
import { Args, DefinitionInfo } from "./structure.js";
import { INTERNAL_TYPES } from "./types.js";

const processArrayDefinition = (definition: ArrayDefintionInternal, varName: string, defInfo: DefinitionInfo) => {
    const def = definition.def
    const lenSize = definition.long ? 2 : 1
    defInfo.fixedSize += lenSize
    const isSimpleField = typeof def === 'string'
    if (isSimpleField || (('test' in def) && typeof def.test === 'function')) {
        const typeInfo = processType(isSimpleField ? def : (def as ExtendedFieldType).type)
        const { type, size } = typeInfo
        let sizeCalc = type === INTERNAL_TYPES.BOOL ? `((${varName}.length + 7) >>> 3)` : `(${varName}.length * ${size})`
        if (type === INTERNAL_TYPES.VARBUF || type === INTERNAL_TYPES.VARCHAR) {
            sizeCalc += ` + ${varName}.reduce((a, b) => a + b.length, 0)`
        }
        defInfo.sizeCalc.push(sizeCalc)

        const validate = defInfo.validate && !isSimpleField
        if (validate) {
            defInfo.validators[varName] = {
                test: (def as ExtendedFieldType).test,
                type
            }
        }

        defInfo.fields.array.push({
            varName,
            def: typeInfo,
            lenSize,
            validate
        })
        
    } else {
        const child = new Args()
        const arrDefInfo = defInfo.sub()
        processDefinition(def as DataDefintion, child, arrDefInfo)
        let sizeCalc = `(${varName}.length * ${arrDefInfo.fixedSize})`
        const objectStructure = getObjectStructure(child.args)
        if (arrDefInfo.sizeCalc.length > 0) {
            sizeCalc += ` + ${varName}.reduce((a, {${objectStructure}}) => (a + ${arrDefInfo.sizeCalc.join(' + ')}), 0)`
        }
        defInfo.sizeCalc.push(sizeCalc)
        console.log(arrDefInfo, sizeCalc)
        defInfo.fields.nestedArray.push({
            varName,
            def: arrDefInfo,
            objectStructure,
            lenSize
        })
    }
}

export default processArrayDefinition