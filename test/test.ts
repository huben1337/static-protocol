import { StaticEndpoint } from "../src/StaticEndpoint.js"
import { BufferLike } from "../src/util/Buffer.js"
import dataGeneratorFactory from "./dataGeneratorFactory.js"
import outputCheckerFactory from "./outputCheckerFactory.js"
import randomDefintionFactory from "./randomDefinitionFactory.js"

let i = 0

const randomDefinition = randomDefintionFactory({
    maxDepth: 4,
})

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
while (true) {
    const def = randomDefinition()
    try {
        const ep = StaticEndpoint(def)
        const gen = dataGeneratorFactory(ep) as () => unknown
        const check = outputCheckerFactory(ep) as (data: unknown, output: unknown) => void
        for (let i = 0; i < 5; i++) {
            const data = gen()
            const en = (ep.encode as (data: unknown) => BufferLike)(data)
            const de = (ep.decode as (buffer: BufferLike) => unknown)(en) 
            try {
                check(de, data)
            } catch (error) {
                console.dir(data, { depth: null })
                console.dir(de, { depth: null })
                throw error
            }
        }

        process.stdout.write(`\rSuccess with definition: ${i++}`)
    } catch (error) {
        console.log(error)
        console.log('\nFailed with definition:')
        console.dir(def, { depth: null })
        
        break
    }
}