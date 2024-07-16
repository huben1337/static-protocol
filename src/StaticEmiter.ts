import { StaticProtocolType } from './StaticProtocol.js'
import { Entries } from './types/helpers.js'
import { FullyReadonlyBuffer } from './util/Buffer.js'

/**
 * Creates a static emitter for the given protocol and callback.
 *
 * @param proto - The static protocol object.
 * @param emiterCallback - The callback function to be called when emitting data.
 * @param mask - The list of endpoints to add to the emitter. If not provided, all endpoints will be added.
 * @return The static emitter object.
 */
const StaticEmiter = <T extends StaticProtocolType<D, boolean>, D extends (T extends StaticProtocolType<infer D, boolean> ? D : never), M extends (keyof T)[] | undefined> (proto: T, emiterCallback: (data: FullyReadonlyBuffer ) => void, mask?: M) => {
    const endpoints = mask === undefined ? (Object.entries(proto) as Entries<T>) : (Object.entries(proto) as Entries<T>).filter(([name]) => mask.includes(name))
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
        M extends (keyof T)[] ? {
            [key in keyof Pick<T, M[number]>]: ((data: ReturnType<T[key]['decode']>) => void)
        } : {
            [key in keyof T]: ((data: ReturnType<T[key]['decode']>) => void)
        }
    )
}

export { StaticEmiter }