import { StaticEndpoint } from "../src/StaticEndpoint.js"
import { BufferLike } from "../src/util/Buffer.js"
import dataGeneratorFactory from "./dataGeneratorFactory.js"
import randomDataDefinition from "./generateDataDefintion.js"
import deepEqual from "deep-equal"

let i = 0
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
while (true) {
    const def = randomDataDefinition(4)
    try {
        const ep = StaticEndpoint({
            data: def,
            channel: 1,
            validate: false,
        })
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