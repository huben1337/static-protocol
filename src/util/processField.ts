import { ExtendedFieldType, InputDataTypes } from "../types/definition.js"
import processType from "./processType.js"
import { ArgsObject, DefinitionInfo } from "./structure.js"
import { INTERNAL_TYPES } from "./types.js"

const processField = (sub: keyof InputDataTypes, name: string, parent: ArgsObject, defInfo: DefinitionInfo, test: ExtendedFieldType['test'] | null) => {
    const varName = defInfo.getVarName()
    const { type, size } = processType(sub)
    if (type === INTERNAL_TYPES.VARBUF || type === INTERNAL_TYPES.VARCHAR || type === INTERNAL_TYPES.VARUINT) {
        parent.addVar(name, varName)
    } else {
        parent.add(name, varName)
    }
    const validate = defInfo.validate && test !== null
    if (validate) {
        defInfo.validators[varName] = {
            test: test,
            type: type
        }
    }
    const field = {
        varName,
        size,
        validate
    }
    defInfo.baseSize += size
    const { fields } = defInfo
    switch (type) {
        case INTERNAL_TYPES.UINT: {
            fields.uint.push(field)
            break
        }
        case INTERNAL_TYPES.INT: {
            fields.int.push(field)
            break
        }
        case INTERNAL_TYPES.BOOL: {
            fields.bool.push(field)
            break
        }
        case INTERNAL_TYPES.NONE: {
            fields.none.push(field)
            break
        }
        case INTERNAL_TYPES.BUF: {
            fields.buf.push(field)
            break
        }
        case INTERNAL_TYPES.VARBUF: {
            defInfo.addLegnth(varName)
            fields.varbuf.push(field)
            break
        }
        case INTERNAL_TYPES.CHAR: {
            fields.char.push(field)
            break
        }
        case INTERNAL_TYPES.VARCHAR: {
            defInfo.addLegnth(varName)
            fields.varchar.push(field)
            break
        }
        case INTERNAL_TYPES.VARUINT: {
            const sizeVarName = `${varName}_len`
            defInfo.varuintSizeCalc.push(`const ${sizeVarName} = getViLen(${varName})`)
            defInfo.computedSize.push(sizeVarName)
            fields.varuint.push(field)
            break
        }
    }
}

export default processField