import { StaticEndpoint, Defintion } from "./StaticEndpoint"

const RAW_PROTOCOL = Symbol('RAW')
type ProtocolDefintion = {
    [endpoint: string]: Defintion
    [RAW_PROTOCOL]?: boolean
}

const CHANNELS_KEY = Symbol('channels')

type StaticProtocolT <T extends ProtocolDefintion> = T[typeof RAW_PROTOCOL] extends true ? ({
    [name in keyof T]: name extends string ? StaticEndpoint<T[name]> : T[name]
}) : ({
    [name in keyof T]: name extends string ? StaticEndpoint<T[name] & { channel: number }> : T[name]
} & {
    [CHANNELS_KEY]: {
        [key in keyof T]: T[key]['channel'] extends number ? T[key]['channel'] : number
    }
})

function StaticProtocol <T extends ProtocolDefintion> (definition: T): StaticProtocolT<T> {
    if (definition[RAW_PROTOCOL]) {
        const mapped = Object.entries(definition).map(([name, def]) => [name, new StaticEndpoint<typeof def>(def)])
        const endpoints = Object.fromEntries(mapped)
        return Object.assign({
            [RAW_PROTOCOL]: true
        }, endpoints)
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
            return [name, new StaticEndpoint<typeof def>(def)]
        })
        const endpoints = Object.fromEntries(mapped)
        return Object.assign({
            [RAW_PROTOCOL]: false,
            [CHANNELS_KEY]: Object.fromEntries(entries.map(([name, def]) => [name, def.channel]))
            // channelOf (buf: Buffer) {
            //     return buf[0]
            // }
        }, endpoints)
    }
}

export { StaticProtocol, ProtocolDefintion, RAW_PROTOCOL, CHANNELS_KEY, StaticProtocolT }
