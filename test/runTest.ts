import { cpus } from "os"
import { join } from "path"
import { Worker } from "worker_threads"

const CPU_COUNT = cpus().length

const TEST_THREADS = CPU_COUNT > 2 ? CPU_COUNT - 2 : 1



const iterationTracker = new SharedArrayBuffer(4)
const iterationTrackerView = new Uint32Array(iterationTracker)

for (let i = 0; i < TEST_THREADS; i++) {
    new Worker(join(import.meta.dirname, 'testWorker.js'), { workerData: iterationTracker })
}

await new Promise((r) => setTimeout(r, 1000))

console.log(`Running test with ${TEST_THREADS} threads...\nSuccessfully tested \nPress Ctrl+C to stop...\x1b[2A`)
const printStatus = () => {
    const i = iterationTrackerView[0]
    if (i >= 0x7fffffff) {
        process.exit(0)
    }
    process.stdout.write(`\x1b[21G${i} definitions`, (err) => {
        if (err) {
            throw err
        }
        setTimeout(printStatus, 5)
    })
}

printStatus()