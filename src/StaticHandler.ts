
import Code from './util/Code.js'
import {  StaticProtocolType } from './StaticProtocol.js'
import { BufferLike } from './util/Buffer.js'

/**
 * Creates a function to handle the endpoints of the static protocol.
 * 
 * @param proto - The static protocol Object .
 * @param endpointHandlers - Handler functions for the different endpoints.
 * @return The handler function.
 */
const StaticHandler = <T extends StaticProtocolType<any, boolean>> (proto: T, endpointHandlers: { [endpoint in keyof T]?: (data: ReturnType<T[endpoint]['decode']>) => void }) => {
    const handleCode = new Code()
    const entries = Object.entries(endpointHandlers)
    for (let i = 0; i < entries.length; i++) {
        const name = entries[i][0]
        handleCode.add(`const d${i} = this.p['${name}'].decode`)
        handleCode.add(`const h${i} = this.h['${name}']`)
    }
    handleCode.add('return (buf) => {')
    handleCode.indent++
    handleCode.add('switch (buf[0]) {')
    handleCode.indent++
    for (let i = 0; i < entries.length; i++) {
        const name = entries[i][0]
        handleCode.add(`case ${proto[name].channel}: {`)
        handleCode.indent++
        handleCode.add(`h${i}(d${i}(buf))`)
        handleCode.add('break')
        handleCode.indent--
        handleCode.add('}')
    }
    handleCode.indent--
    handleCode.add('}')
    handleCode.indent--
    handleCode.add('}')
    return handleCode.compile({
        h: endpointHandlers,
        p: proto
    }) as (buf: BufferLike) => void
}

export { StaticHandler }