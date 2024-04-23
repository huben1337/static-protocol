import { StaticEndpoint, Defintion } from './StaticEndpoint.js'

type ProtocolDefintion = {
    [endpoint: string]: Defintion
}

type StaticProtocolType <T extends ProtocolDefintion, R> = R extends true ? {
    [name in keyof T]: StaticEndpoint<T[name]>
} : {
    [name in keyof T]: StaticEndpoint<T[name] & { channel: number }>
}


/**
 * Creates a static protocol based on the provided definition.
 *
 * @param definition - The protocol definition.
 * @param raw - Raw protocols dont have add a channel id for each endpoint.
 * @returns The static protocol Object.
 */
function StaticProtocol <T extends ProtocolDefintion, R extends boolean = false> (definition: T, raw?: R): StaticProtocolType<T, R> {
    if (raw) {
        const mapped = Object.entries(definition).map(([name, def]) => [name, new StaticEndpoint(def)])
        return Object.fromEntries(mapped)
    } else {
        const usedChannels = new Set<number>()
        let channelId = 0
        const entries = Object.entries(definition)
        const mapped = entries.map(([name, def]) => {
            if (def.channel) {
                if (usedChannels.has(def.channel)) throw new Error('Duplicate channel')
                usedChannels.add(def.channel)
            } else {
                while (usedChannels.has(channelId)) channelId++
                if (channelId > 255) throw new Error('Too many channels')
                usedChannels.add(channelId)
                def.channel = channelId
            }
            return [name, new StaticEndpoint(def)]
        })
        return Object.fromEntries(mapped)
    }
}

export { StaticProtocol, ProtocolDefintion, StaticProtocolType }
