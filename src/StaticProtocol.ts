import { StaticEndpoint, StaticEndpointType } from "./StaticEndpoint.js"
import { Definition } from "./types/definition.js"
import { Entries } from "./types/helpers.js"

type ProtocolDefintion = {
    [endpoint: string]: Definition
}

type StaticProtocolType <T extends ProtocolDefintion, R> = R extends true ? {
    [name in keyof T]: StaticEndpointType<T[name]>
} : {
    [name in keyof T]: StaticEndpointType<T[name] & { channel: number }>
}

/**
 * Creates a static protocol based on the provided definition.
 *
 * @param definition - The protocol definition.
 * @param raw - Raw protocols dont have add a channel id for each endpoint.
 * @returns The static protocol Object.
 */
const StaticProtocol = <T extends ProtocolDefintion, R extends boolean = false> (definition: T, raw?: R): StaticProtocolType<T, R> => {
    const entries = Object.entries(definition) as Entries<T>
    type PropertyDescriptorEntry = [name: keyof T, descriptor: { value: StaticEndpointType<T[keyof T]>, enumerable: true }]
    let mapped
    if (raw) {
        mapped = entries.map<PropertyDescriptorEntry>(([name, def]) => [name, { value: StaticEndpoint(def), enumerable: true }]) 
    } else {
        const usedChannels = new Set<number>()
        let channelId = 0  
        mapped = entries.map<PropertyDescriptorEntry>(([name, def]) => {
            if (def.channel) {
                if (usedChannels.has(def.channel)) throw new Error('Duplicate channel')
                usedChannels.add(def.channel)
            } else {
                while (usedChannels.has(channelId)) channelId++
                if (channelId > 255) throw new Error('Too many channels')
                usedChannels.add(channelId)
                def.channel = channelId
            }
            return [name, { value: StaticEndpoint(def), enumerable: true }]
        })
        
    }
    const propertyDescriptor = Object.fromEntries(mapped) as {
        [key in keyof T]: {
            value: StaticEndpointType<T[keyof T]>
            enumerable: true
        }
    }
    return Object.seal(Object.defineProperties(Object.create(null), propertyDescriptor)) as StaticProtocolType<T, R>
}

export { StaticProtocol, ProtocolDefintion, StaticProtocolType }
