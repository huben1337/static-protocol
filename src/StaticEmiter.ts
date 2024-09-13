import { StaticProtocolType } from './StaticProtocol.js'
import { Entries, InferedProtocolDefintion, NumberKeyToString } from './types/helpers.js'
import { FullyReadonlyBuffer } from './util/Buffer.js'


/**
 * Creates a static emitter for the given protocol and callback.
 *
 * @param proto - The static protocol object.
 * @param emiterCallback - The callback function to be called when emitting data.
 * @param mask - The list of endpoints to add to the emitter. If not provided, all endpoints will be added.
 * @return The static emitter object.
 */
const StaticEmiter = <T extends StaticProtocolType<InferedProtocolDefintion<T>, boolean>, M extends NumberKeyToString<keyof T>[] | undefined> (proto: T, emiterCallback: (data: FullyReadonlyBuffer) => void, mask?: M) => {
    let endpoints = Object.entries(proto) as Entries<T>
    if (mask) {
        endpoints = endpoints.filter(([name]) => mask.includes(name))
    }
    const mapped = endpoints.map(([name, endpoint]) => {
        if (endpoint.encode.length === 0) {
            return [name, () => {
                emiterCallback((endpoint.encode as () => FullyReadonlyBuffer)())
            }] as const
        } else {
            return [name, (data: unknown) => {
                emiterCallback((endpoint.encode as (data: unknown) => FullyReadonlyBuffer)(data))
            }] as const
        }
    })
    return Object.fromEntries(mapped) as (
        M extends NumberKeyToString<keyof T>[] ? {
            [K in M[number]]: (data: ReturnType<T[K]['decode']>) => void
        } : {
            [K in keyof T]: (data: ReturnType<T[K]['decode']>) => void
        }
    )
}

export { StaticEmiter }