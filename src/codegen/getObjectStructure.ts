import { Args } from "../util/structure.js"

const getObjectStructure = (args: Args['args']) => {
    return `{ ${args.map((arg): string => {
        if (typeof arg === 'string') {
            return arg
        } else {
            return `${arg.name}: ${getObjectStructure(arg.args)}`
        }
    }).join(', ')} }`
}

export default getObjectStructure