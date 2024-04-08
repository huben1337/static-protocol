import { StaticProtocol, ProtocolDefintion, Enum } from '../index.js'

const protoDef = {
    test: {
        data: {
            name: 'varchar',
            age: Enum({ 
                /* enum: input can be one of the defined types
                [case: number]: type */
                0: 'uint8',
                1: 'char:3',
            }),
            test: 'bool',
            num: 'uint16',
        }
    }
} satisfies ProtocolDefintion

const proto = StaticProtocol(protoDef, false, false)
const buffer = proto.test.encode({ name: 'test', age: { id: 0, value: 0 }, test: true, num: 1234 })
const decoded = proto.test.decode(buffer)

console.log(decoded)