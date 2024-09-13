import { cpus } from "os"
import { join } from "path"
import { Worker } from "worker_threads"

const TEST_THREADS = cpus().length - 1

console.log(`Running test with ${TEST_THREADS} threads...\nSuccessfully tested \nPress Ctrl+C to stop...\x1b[2A`)

const iterationTracker = new SharedArrayBuffer(4)

for (let i = 0; i < TEST_THREADS; i++) {
    new Worker(join(import.meta.dirname, 'testWorker.js'), { workerData: iterationTracker })
}
