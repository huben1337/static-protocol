import { StaticEndpoint } from "../src/StaticEndpoint.js"
import { BufferLike } from "../src/util/Buffer.js"
import dataGeneratorFactory from "./dataGeneratorFactory.js"
import randomDefintionFactory from "./randomDefinitionFactory.js"
import deepEqual from "deep-equal"

let i = 0

const randomDefinition = randomDefintionFactory({
    maxDepth: 3,
})

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
while (true) {
    const def = randomDefinition()
    try {
        const ep = StaticEndpoint(def)
        const gen = dataGeneratorFactory(ep) as () => unknown
        
        for (let i = 0; i < 5; i++) {
            const data = gen()
            const en = (ep.encode as (data: unknown) => BufferLike)(data)
            const de = (ep.decode as (buffer: BufferLike) => unknown)(en) 
            if(!deepEqual(de, data)) {
                
                console.dir(data, { depth: null })
                console.dir(de, { depth: null })

                throw new Error('Not equal')
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