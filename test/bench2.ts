import { List, StaticEndpoint } from "../src/StaticEndpoint.js"
import { generators } from "./dataGeneratorFactory.js"

const ep = StaticEndpoint( {
    data: {
        data: {
            body: {
                embeds: List('int32'),
                mentions: List({ fid: 'varbuf:16' }),
                cast_id: {
                    fid: 'varbuf:16',
                    hash: 'varbuf:16',
                },
                text: 'varchar:5000'
            },
            type: 'uint8',
            timestamp: 'uint32',
            fid: 'varbuf:16',
            network: 'uint8'
        },
        hash: 'varbuf:20',
        hash_scheme: 'uint8',
        signature: 'varbuf:64',
        signature_scheme: 'uint8',
        signer: 'varbuf:32'
    }
})


const picbuf = new Uint8Array(500)
for (let i = 0; i < 5000; i++) {
    picbuf[i] = Math.floor(Math.random() * 255)
}

declare const gc: () => void

const runTest = (label: string, cb: () => void) => {
    for (let i = 0; i < 10; i++) {
        const start = performance.now()
        cb()
        console.debug(label, performance.now() - start)
    }
}

const testData: Parameters<typeof ep.encode>[0] = {
    data: {
        body: {
            embeds: [],
            mentions: [],
            cast_id: {
                fid: generators.buf(4),
                hash: generators.buf(16),
            },
            text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        },
        type: 1,
        timestamp: 1673848001,
        fid: generators.buf(4),
        network: 1
    },
    hash: generators.buf(20),
    hash_scheme: 1,
    signature: generators.buf(64),
    signature_scheme: 1,
    signer: generators.buf(32)
}




// runTest('MyBuffer', () => {
//     const size = 1_000_000
//     const buffer = Buffer.alloc(size)

//     for (let i = 0; i < 100_000_000; i++) {
//         buffer.setUint32(5000, i % (size -3))
//     }
// })

// runTest('NodeBuffer', () => {
//     const size = 1_000_000
//     const buffer = new DataView(new ArrayBuffer(size))
//     for (let i = 0; i < 100_000_000; i++) {
//         buffer.setUint32(i % (size -3), 5000)
//     }
// })


const enc = ep.encode(testData)
console.log(enc.length)
const ITERS = 10_000_000

await new Promise(resolve => setTimeout(resolve, 1000))
gc()
await new Promise(resolve => setTimeout(resolve, 2000))

runTest('encode', () => {
    for (let i = 0; i < ITERS; i++) {
        ep.encode(testData)
    }
})

runTest('decode', () => {
    for (let i = 0; i < ITERS; i++) {
        ep.decode(enc)
        // const dec = ep.decode(enc)
    }
})

