import { workerData } from "worker_threads"
import { StaticEndpoint } from "../src/StaticEndpoint.js"
import { BufferLike } from "../src/util/Buffer.js"
import dataGeneratorFactory from "./dataGeneratorFactory.js"
import randomDefinitionFactory from "./randomDefinitionFactory.js"
import deepEqual from "deep-equal"


const iterationTracker = new Uint32Array(workerData as SharedArrayBuffer)


const randomDefinition = randomDefinitionFactory({
    maxDepth: 4
})

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
while (true) {
    const def = randomDefinition()
    try {
        const ep = StaticEndpoint(def)
        const gen = dataGeneratorFactory(ep) as () => unknown
        
        for (let i = 0; i < 1; i++) {
            const data = gen()
            const en = (ep.encode as (data: unknown) => BufferLike)(data)
            const de = (ep.decode as (buffer: BufferLike) => unknown)(en) 
            if(!deepEqual(de, data)) throw new Error('Not equal')
        }

        const i = iterationTracker[0]++
        if (i >= 0x7fffffff) {
            process.exit(0)
        }
        await new Promise<void>((resolve, reject) => {
            process.stdout.write(`\x1b[21G${i} definitions`, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })
    } catch (error) {
        // console.log(error)
        console.log('\nFailed with definition:')
        console.dir(def, { depth: null })
        process.exit(1)
    }
}