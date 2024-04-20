import { StaticProtocolType } from './StaticProtocol.js'
import { FullyReadonlyBuffer } from './util/Buffer.js';


/**
 * Creates a static emitter for the given protocol and callback.
 *
 * @param proto - The static protocol object.
 * @param emiterCallback - The callback function to be called when emitting data.
 * @param mask - The list of endpoints to add to the emitter. If not provided, all endpoints will be added.
 * @return The static emitter object.
 */
function StaticEmiter <T extends StaticProtocolType<any, boolean>, M extends Array<keyof T> | undefined> (proto: T, emiterCallback: (data: FullyReadonlyBuffer) => any, mask?: M) {
    const endpoints = mask === undefined ? Object.entries(proto) : Object.entries(proto).filter(([name]) => mask.includes(name))
    const mapped = endpoints.map(([name, endpoint]) => {
        if (endpoint.encode.length === 0) {
            return [name, () => {
                emiterCallback((endpoint.encode as () => FullyReadonlyBuffer)())
            }] as const
        } else {
            return [name, (data: any) => {
                emiterCallback((endpoint.encode as (data: any) => FullyReadonlyBuffer)(data))
            }] as const
        }
    })
    return Object.fromEntries(mapped) as (
        M extends Array<keyof T> ? {
            [key in keyof Pick<T, M[number]>]: ((data: ReturnType<T[key]['decode']>) => void)
        } : {
            [key in keyof T]: ((data: ReturnType<T[key]['decode']>) => void)
        }
    )
}

export { StaticEmiter }