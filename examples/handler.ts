import { StaticHandler } from "../src/StaticHandler.js"
import proto from "./protocol.js"

const handler = StaticHandler(proto, {
    note: ({ text }) => {
        console.log('\n', text)
    }
})

export default handler