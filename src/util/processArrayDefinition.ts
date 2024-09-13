import { ArrayDefintionInternal, DataDefintion, EnumDefintionInternal, ExtendedFieldType } from "../types/definition.js";
import processDataDefinition from "./processDataDefinition.js";
import processEnumDefinition from "./processEnumDefinition.js";
import processType from "./processType.js";
import { ArgsObject, DefinitionInfo } from "./structure.js";
import { INTERNAL_TYPES } from "./types.js";

const processArrayDefinition = (definition: ArrayDefintionInternal, varName: string, defInfo: DefinitionInfo) => {
    const def = definition.def
    const lenSize = definition.long ? 2 : 1
    defInfo.baseSize += lenSize
    const lengthIdentifier = `${varName}${defInfo.topLevel ? '_' : '.'}length`
    const isSimpleField = typeof def === 'string'
    if (isSimpleField || (('test' in def) && typeof def.test === 'function')) {
        const typeInfo = processType(isSimpleField ? def : (def as ExtendedFieldType).type)
        const { type, size } = typeInfo
        const sizeCalc = type === INTERNAL_TYPES.BOOL
        ? `((${lengthIdentifier} + 7) >>> 3)`
        : `(${lengthIdentifier} * ${size})${
            type === INTERNAL_TYPES.VARBUF || type === INTERNAL_TYPES.VARCHAR
            ? ` + ${varName}.reduce((a, b) => a + b.length, 0)`
            : ''
        }`
        defInfo.computedSize.push(sizeCalc)

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
        
    } else if (('isArray' in def) && def.isArray === true) {
        const subDefInfo = defInfo.sub()
        const entryVar = subDefInfo.getVarName()
        processArrayDefinition((def as ArrayDefintionInternal), entryVar, subDefInfo)
        let sizeCalc = `(${lengthIdentifier} * ${subDefInfo.baseSize})`
        if (subDefInfo.computedSize.length > 0) {
            sizeCalc += ` + ${varName}.reduce((a, ${entryVar}) => (a + ${subDefInfo.computedSize.join(' + ')}), 0)`
        }
        defInfo.computedSize.push(sizeCalc)
        defInfo.fields.nestedArray.push({
            varName,
            def: subDefInfo,
            objectStructure: entryVar,
            lenSize
        })
    } else if (('isEnum' in def) && def.isEnum === true) {
        const subDefInfo = defInfo.sub()
        const entryVar = subDefInfo.getVarName()
        processEnumDefinition((def as EnumDefintionInternal), entryVar, subDefInfo)
        let sizeCalc = `(${lengthIdentifier} * ${subDefInfo.baseSize})`
        if (subDefInfo.computedSize.length > 0) {
            sizeCalc += ` + ${varName}.reduce((a, ${entryVar}) => (a + ${subDefInfo.computedSize.join(' + ')}), 0)`
        }
        defInfo.computedSize.push(sizeCalc)
        defInfo.fields.nestedArray.push({
            varName,
            def: subDefInfo,
            objectStructure: entryVar,
            lenSize
        })
    } else {
        const child = new ArgsObject()
        const arrDefInfo = defInfo.sub()
        processDataDefinition(def as DataDefintion, child, arrDefInfo)
        let sizeCalc = `(${lengthIdentifier} * ${arrDefInfo.getBaseSize()})`
        const objectStructure = child.toString()
        if (arrDefInfo.computedSize.length > 0) {
            // objectStructure is alwys a string since when computedSize isnt empty there exists at least one field
            sizeCalc += ` + ${varName}.reduce((a, ${objectStructure}) => (a + ${arrDefInfo.computedSize.join(' + ')}), 0)`
        }
        defInfo.computedSize.push(sizeCalc)
        defInfo.fields.nestedArray.push({
            varName,
            def: arrDefInfo,
            objectStructure,
            lenSize
        })
    }
}

export default processArrayDefinition