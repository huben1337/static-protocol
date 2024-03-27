import { ProtocolDefintion, StaticProtocol, RAW_PROTOCOL, StaticProtocolT } from "./StaticProtocol";
import {StaticEndpoint } from "./StaticEndpoint";
import Code from "./Code";


type EndpointHandlers<T> = {
    [endpoint in keyof T]?: T[endpoint] extends StaticEndpoint<infer _> ? (data: ReturnType<T[endpoint]['decode']>) => void : never
}



class ProtoHandler<T extends { [endpoint: string]: { channel: number } }> {
    constructor (proto: T, endpointHandlers: EndpointHandlers<T>) {
        const handleCode = new Code()
        const entries = Object.entries(endpointHandlers)
        for (let i = 0; i < entries.length; i++) {
            const [name, handler] = entries[i]
            handleCode.addLine(`const d${i} = this.p.${name}.decode`)
            handleCode.addLine(`const h${i} = this.h.${name}`)
        }
        handleCode.addLine('return (buf) => {')
        handleCode.indent++
        handleCode.addLine('switch (buf[0]) {')
        handleCode.indent++
        for (let i = 0; i < entries.length; i++) {
            const [name, handler] = entries[i]
            handleCode.addLine(`case ${proto[name].channel}: {`)
            handleCode.indent++
            handleCode.addLine(`h${i}(d${i}(buf))`)
            handleCode.addLine('break')
            handleCode.indent--
            handleCode.addLine('}')
        }
        handleCode.indent--
        handleCode.addLine('}')
        handleCode.indent--
        handleCode.addLine('}')
        this.handle = handleCode.compile({
            h: endpointHandlers,
            p: proto
        })
    }

    handle: (buf: Buffer) => void
}

export { ProtoHandler, EndpointHandlers }