import { StaticProtocol, ProtocolDefintion } from "../index"
import { ProtoHandler, EndpointHandlers } from "../src/ProtoHandler"
const protoDef = {
    test: {
        data: {
            name: 'varchar',
            age: { 
                /* enum: input can be one of the defined types
                [case: number]: type */
                0: 'uint8',
                1: 'buf:3',
            },
            test: 'bool',
            num: 'uint16',
        }
    }
} satisfies ProtocolDefintion

const proto = StaticProtocol<typeof protoDef>(protoDef)
const start = performance.now()
for (let i = 0; i < 10000000; i++) {
    const buffer = proto.test.encode({ name: 'test', age: { id: 1, value: Buffer.from('abc') }, test: true, num: 1234 })
    const decoded = proto.test.decode(buffer)
}
console.log(performance.now() - start)

//console.log(decoded) 


/*const handler = new ProtoHandler(proto, {
    test: ({ name }) => {
        console.log(name)
    }
})

handler.handle(buffer)*/