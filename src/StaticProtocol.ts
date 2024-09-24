import { EndpointValidators, StaticEndpoint, StaticEndpointType } from "./StaticEndpoint.js"
import { Definition } from "./types/definition.js"
import { Entries, ValueType } from "./types/helpers.js"

type ProtocolDefintion = {
    [endpoint: string]: Definition
}

type StaticProtocolType <T extends ProtocolDefintion, R> = true extends R ? {
    [name in keyof T]: StaticEndpointType<T[name]>
} : {
    [name in keyof T]: StaticEndpointType<T[name] & { channel: number }>
}

type ProtocolValidators<T extends ProtocolDefintion> =  {
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    [K in keyof T as EndpointValidators<T[K]> extends never ? never : K]: EndpointValidators<T[K]>
}

type ValidatorsArgs<T extends ProtocolDefintion> = keyof ProtocolValidators<T> extends never ? [] : [validators: ProtocolValidators<T>] 

/**
 * Creates a static protocol based on the provided definition.
 *
 * @param definition - The protocol definition.
 * @param raw - Raw protocols dont have add a channel id for each endpoint.
 * @returns The static protocol Object.
 */
const StaticProtocol = <T extends ProtocolDefintion, R extends boolean | undefined = false> (definition: T, raw?: R, ...args: ValidatorsArgs<T>) => {
    const entries = Object.entries(definition) as Entries<T>
    const [validators] = args
    type PropertyDescriptorEntry = [name: keyof T, descriptor: { value: StaticEndpointType<ValueType<T>>, enumerable: true }]
    let mapped
    if (raw) {
        // @ts-expect-error [1] We can always index into the validators object as we expect undefined on non validated endpoints
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        mapped = entries.map<PropertyDescriptorEntry>(([name, def]) => [name, { value: StaticEndpoint(def, validators ? validators[name] : undefined), enumerable: true }]) 
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
            // @ts-expect-error Same reason as [1]
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return [name, { value: StaticEndpoint(def, validators ? validators[name] : undefined), enumerable: true }]
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
