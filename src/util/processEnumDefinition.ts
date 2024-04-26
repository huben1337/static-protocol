import { EnumDefintion } from "../types/definition.js"
import processEnumCase from "./processEnumCase.js"
import { Args, DefinitionInfo, EnumCase } from "./structure.js"

const processEnumDefinition = (def: EnumDefintion, name: string, parent: Args, defInfo: DefinitionInfo) => {
    const subFields = Object.entries(def)
    // if (subFields.some((value) => value.match(/^[^0-9]+$/))) throw new Error('Enum can only contain numbers as ids')
    const usedIds = new Set<number>()
    const cases = new Array<EnumCase>(subFields.length)
    const idName = defInfo.getVarName()
    const varName = defInfo.getVarName()
    let mappedId = 0
    for (let i = 0; i < subFields.length; i++) {
        const [idString, sub] = subFields[i]
        if (/^[0-9]{1,3}$/.test(idString)) {
            const id = parseInt(idString)
            if (id > 255) throw new Error('Enum indecies must be between 0 and 255')
            if (usedIds.has(id)) throw new Error('Enum indecies must be unique')
            usedIds.add(id)
            cases[i] = processEnumCase(sub, id, defInfo, idString, varName)
        } else {
            while (usedIds.has(mappedId)) {
                mappedId++
                if (mappedId > 255) throw new Error('Ran out of enum indecies for mapping')
            }
            cases[i] = processEnumCase(sub, mappedId, defInfo, `'${idString}'`, varName)
        }
    }
    parent.args.push(`${name}: ${varName}`) // {id: ${idName}, value: ${valueName}}
    defInfo.fields.enum.push({
        idName,
        varName,
        cases,
        mappedIds: mappedId > 0
    })
    defInfo.fixedSize++
}

export default processEnumDefinition