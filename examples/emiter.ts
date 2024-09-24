import { StaticEmiter } from "../src/StaticEmiter.js"
import echo from "./helpers/echo.js"
import proto from "./protocol.js"

const emiter = StaticEmiter(proto, ({ view }) => {
    echo.send(view)
}, ['note'])

export default emiter