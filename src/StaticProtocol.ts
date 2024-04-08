import { StaticEndpoint, Defintion } from './StaticEndpoint.js'

type ProtocolDefintion = {
    [endpoint: string]: Defintion
}

type StaticProtocolType <T extends ProtocolDefintion, R, C extends boolean> = R extends true ? {
    [name in keyof T]: StaticEndpoint<T[name], C>
} : {
    [name in keyof T]: StaticEndpoint<T[name] & { channel: number }, C>
}

function StaticProtocol <T extends ProtocolDefintion, R extends boolean, C extends boolean> (definition: T, raw: R, noValidator: C): StaticProtocolType<T, R, C> {
    if (raw) {
        const mapped = Object.entries(definition).map(([name, def]) => [name, new StaticEndpoint(def, noValidator)])
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
            return [name, new StaticEndpoint(def, noValidator)]
        })
        return Object.fromEntries(mapped)
    }
}

export { StaticProtocol, ProtocolDefintion, StaticProtocolType }
