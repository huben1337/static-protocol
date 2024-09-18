import Code from "../src/codegen/Code.js"
import { StaticEndpointType } from "../src/StaticEndpoint.js"
import { InferedEndpointDefintion } from "../src/types/helpers.js"
import processDefinition from "../src/util/processDefinition.js"
import { DefinitionInfo, Field } from "../src/util/structure.js"
import { INTERNAL_TYPES } from "../src/util/types.js"

type OutpuChecker<T extends StaticEndpointType<InferedEndpointDefintion<T>>> = (actual: ReturnType<T['decode']>, expected: Parameters<T['encode']>[0]) => void

const outputCheckerFactory = <T extends StaticEndpointType<InferedEndpointDefintion<T>>>(endpoint: T): OutpuChecker<T> => {
    
    const defInfo = processDefinition(endpoint.definition)
    const objectStructure = defInfo.args.toString()
    if (!objectStructure) {
        return (() => {
            // no-op
        }) 
    }
    const code = new Code(`return ((${objectStructure.replaceAll('_', 'a_')}, ${objectStructure.replaceAll('_', 'e_')}) => {`, '})')
    code.indent++
    addDataChecker(defInfo, code)
    return Function.call(null, code.toString()).call(null) as OutpuChecker<T>
}


const addBufferCheckCode = function (this: Code, { varName }: { varName: string }) {
    this.add(`if (a${varName}.length !== e${varName}.length) throw new Error('Buffer length mismatch: ${varName}')`)
    this.add(`for (let i = 0; i < a${varName}.length; i++) {`)
    this.indent++
    this.add(`if (a${varName}[i] !== e${varName}[i]) throw new Error('Buffer element mismatch: \${${varName}[i]}')`)
    this.indent--
    this.add('}')
}

const addDataChecker = (defInfo: DefinitionInfo, code: Code) => {
    const addSimpleCheckCode = ({ varName }: Field) => {
        code.add(`if (a${varName} !== e${varName}) throw new Error('Incorrect value: ${varName}')`)
    }
    defInfo.fields.bool.forEach(addSimpleCheckCode)
    defInfo.fields.int.forEach(addSimpleCheckCode)
    defInfo.fields.uint.forEach(addSimpleCheckCode)
    defInfo.fields.varuint.forEach(addSimpleCheckCode)
    defInfo.fields.char.forEach(addSimpleCheckCode)
    defInfo.fields.varchar.forEach(addSimpleCheckCode)
    
    defInfo.fields.buf.forEach(addBufferCheckCode, code)
    defInfo.fields.varbuf.forEach(addBufferCheckCode, code)
    defInfo.fields.array.forEach(({ varName, def }) => {
        code.add(`if (a${varName}.length !== e${varName}.length) throw new Error('Array length mismatch: ${varName}')`)
        code.add(`for (let i = 0; i < a${varName}.length; i++) {`)
        code.indent++
        switch (def.type) {
            case INTERNAL_TYPES.BUF:
            case INTERNAL_TYPES.VARBUF:
                const elementName = `_el`
                code.add(`const a${elementName} = a${varName}[i]`)
                code.add(`const e${elementName} = e${varName}[i]`)
                addBufferCheckCode.call(code, { varName: elementName })
                break
            default:
                code.add(`if (a${varName}[i] !== e${varName}[i]) throw new Error('Array element mismatch: \${${varName}[i]}')`)
        }
        code.indent--
        code.add('}')
    }, code)
    defInfo.fields.nestedArray.forEach(({ varName, objectStructure, def }) => {
        code.add(`if (a${varName}.length !== e${varName}.length) throw new Error('Array length mismatch: ${varName}')`)
        code.add(`for (let i = 0; i < a${varName}.length; i++) {`)
        code.indent++
        if (objectStructure) {
            code.add(`const ${objectStructure.replaceAll('_', 'a_')} = a${varName}[i]`)
            code.add(`const ${objectStructure.replaceAll('_', 'e_')} = e${varName}[i]`)
        }
        const comapreCode = new Code()
        addDataChecker(def, comapreCode)
        code.add(comapreCode)
        code.indent--
        code.add('}')
    })
    defInfo.fields.enum.forEach(({ varName, cases, idName }) => {
        code.add(`const a${idName} = a${varName}.id`)
        code.add(`const e${idName} = e${varName}.id`)
        code.add(`if (a${idName} !== e${idName}) throw new Error('Enum id mismatch: ${varName}')`)
        const valueName = `${varName}_v`
        code.add(`const a${valueName} = a${varName}.value`)
        code.add(`const e${valueName} = e${varName}.value`)
        const switchCode = code.switch(`a${idName}`)
        cases.forEach(({ id, idString, nested, def }) => {
            const caseCode = switchCode.case(idString ?? `${id}`)
            if (nested) {
                const objectStructure = def.args.toString()
                if (objectStructure) {
                    caseCode.add(`const ${objectStructure.replaceAll('_', 'a_')} = a${valueName}`)
                    caseCode.add(`const ${objectStructure.replaceAll('_', 'e_')} = e${valueName}`)
                }
                addDataChecker(def, caseCode)
            } else {
                switch (def.type) {
                    case INTERNAL_TYPES.BUF:
                    case INTERNAL_TYPES.VARBUF:
                        addBufferCheckCode.call(caseCode, { varName: valueName })
                        break
                    default:
                        caseCode.add(`if (a${valueName} !== e${valueName}) throw new Error(\`Enum value mismatch: ${varName}, \${a${idName}}\`)`)
                }
            }
            caseCode.add('break')
        })
    })
}


export default outputCheckerFactory