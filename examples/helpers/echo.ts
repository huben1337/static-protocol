import { ReadonlyUint8Array } from "../../src/util/Buffer.js"

export default {
    send (data: ReadonlyUint8Array) {
        if (this.onData) {
            this.onData(data)
        }
    },

    onData: null as ((data: ReadonlyUint8Array) => void) | null
}