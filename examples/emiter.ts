import { StaticEmiter } from "../src/StaticEmiter.js"
import echo from "./helpers/echo.js"
import proto from "./protocol.js"

const emiter = StaticEmiter(proto, ({ buffer }) => {
    echo.send(buffer)
}, ['note'])

export default emiter