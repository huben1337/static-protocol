export default {
    send (data: ArrayBuffer) {
        if (this.onData) {
            this.onData(new Uint8Array(data))
        }
    },

    onData: null as ((data: Uint8Array) => void) | null
}