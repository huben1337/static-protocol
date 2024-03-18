import { StaticProtocol, Defintion } from "../src/StaticProtocol"

const schema = {
    data: {
        name: 'varchar',
        age: { 
            /* enum: input can be one of the defined types
            [case: number]: type */
            0: 'uint8',
            1: 'char:3',
        },
        test: 'bool',
        num: 'uint16',
    }
} as const satisfies Defintion

const proto = new StaticProtocol<typeof schema>(schema)
const buffer = proto.encode({ name: 'test', age: { id: 1, value: '015' }, test: true, num: 1234 })
const decoded = proto.decode(buffer)
console.log(decoded)