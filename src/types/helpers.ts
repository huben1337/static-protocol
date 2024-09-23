import type { StaticEndpointType } from "../StaticEndpoint.js"
import type { StaticProtocolType } from "../StaticProtocol.js"

type NumberKeyToString<T extends PropertyKey> = T extends string ? T : (
    T extends number ? `${T}` : never
)

type ValueType<T> = T[keyof T]

type Entries<T> = {
    [K in keyof T]: [NumberKeyToString<K>, T[K]]
}[keyof T][]

type InferedProtocolDefintion<T> = T extends StaticProtocolType<infer D, boolean> ? D : never
type InferedEndpointDefintion<T> = T extends StaticEndpointType<infer D> ? D : never

type DeepReadonly<T> = {
    readonly [K in keyof T]: DeepReadonly<T[K]>
}

export { ValueType, NumberKeyToString, Entries, InferedProtocolDefintion, InferedEndpointDefintion, DeepReadonly }