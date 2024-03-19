
type DisallowedMethods = `write${string}` | 'set' | 'fill' | `swap${string}` | 'copyWithin'

type ReadonlyBuffer = {
    subarray(start?: number, end?: number): ReadonlyBuffer
    slice(start?: number, end?: number): ReadonlyBuffer
} & {
    [P in keyof Buffer]: P extends DisallowedMethods ? never : Buffer[P]
} & Buffer
export default ReadonlyBuffer