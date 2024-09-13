
import Code, { compile } from './codegen/Code.js'
import { StaticEndpointType } from './StaticEndpoint.js'
import { StaticProtocolType } from './StaticProtocol.js'
import { Definition } from './types/definition.js'
import { InferedProtocolDefintion } from './types/helpers.js'
import { BufferLike } from './util/Buffer.js'

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
type EnpointHandler<T extends StaticEndpointType<Definition>['decode']> = ReturnType<T> extends void ? () => void : (data: ReturnType<T>) => void

/**
 * Creates a function to handle the endpoints of the static protocol.
 * 
 * @param proto - The static protocol Object .
 * @param endpointHandlers - Handler functions for the different endpoints.
 * @return The handler function.
 */
const StaticHandler = <T extends StaticProtocolType<InferedProtocolDefintion<T>, boolean>> (
    proto: T,
    endpointHandlers: {
        [endpoint in keyof T]?: EnpointHandler<T[endpoint]['decode']>
    }
) => {
    const handleCode = new Code()
    const entries = Object.entries(endpointHandlers)
    for (let i = 0; i < entries.length; i++) {
        const name = entries[i][0]
        const propertyAccessor = name.match(/^[0-9]$/) ? `['${name}']` : `.${name}`
        handleCode.add(`const d${i} = this.p${propertyAccessor}.decode`)
        handleCode.add(`const h${i} = this.h${propertyAccessor}`)
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
    return compile<(buf: BufferLike) => void>(handleCode, {
        h: endpointHandlers,
        p: proto
    })
}

export { StaticHandler }