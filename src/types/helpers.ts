import { StaticProtocolType } from "../StaticProtocol.js"

type Entries<T> = {
    [K in keyof T]: [K, T[K]]
}[keyof T][]

type InferedProtocolDefintion<T> = T extends StaticProtocolType<infer D, boolean> ? D : never

export { Entries, InferedProtocolDefintion }