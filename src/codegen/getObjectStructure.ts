import { Args } from "../util/structure.js"

const getObjectStructure = (args: Args['args']) => {
    let result = ''
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (typeof arg === 'string') {
            result += `${i === 0 ? '' : ', '}${arg}`
        } else {
            result += `${i === 0 ? '' : ', '}${arg.name}: {${getObjectStructure(arg.args)}}`
        }
    }
    return result
}

export default getObjectStructure