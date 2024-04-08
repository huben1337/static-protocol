import { StaticProtocolType } from './StaticProtocol.js'
import { FullyReadonlyBuffer } from './util/Buffer.js';


function StaticEmiter <T extends StaticProtocolType<any, boolean, boolean>> (proto: T, emiterCallback: (data: FullyReadonlyBuffer) => any) {

    const mapped = Object.entries(proto).map(([name, endpoint]) => {
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
    return Object.fromEntries(mapped) as {
        [key in keyof T]: ((data: ReturnType<T[key]['decode']>) => void)
    }
}

export { StaticEmiter }