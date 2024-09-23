import { workerData } from "worker_threads"
import { StaticEndpoint } from "../src/StaticEndpoint.js"
import { BufferLike } from "../src/util/Buffer.js"
import dataGeneratorFactory from "./dataGeneratorFactory.js"
import randomDefinitionFactory from "./randomDefinitionFactory.js"
import outputCheckerFactory from "./outputCheckerFactory.js"

const iterationTracker = new Uint32Array(workerData as SharedArrayBuffer)


const randomDefinition = randomDefinitionFactory({
    maxDepth: 2
})

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
while (true) {
    const def = randomDefinition()
    try {
        const ep = StaticEndpoint(def)
        const gen = dataGeneratorFactory(ep) as () => unknown
        const check = outputCheckerFactory(ep) as (data: unknown, output: unknown) => void
        
        for (let i = 0; i < 1; i++) {
            const data = gen()
            const en = (ep.encode as (data: unknown) => BufferLike)(data)
            const de = (ep.decode as (buffer: BufferLike) => unknown)(en) 
            check(de, data)
        }

        iterationTracker[0]++
    } catch (error) {
        // console.log(error)
        console.log('\n\n\n\nFailed!')
        process.exit(1)
    }
}