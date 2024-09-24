import { StaticProtocol, Enum, List } from '../index.js'

const proto = StaticProtocol({
    user: {
        data: {
            name: {
                type: 'varchar',
                validate: true
            },
            age: Enum({ 
                /* [case: number | string]: type */
                0: 'uint8',
                1: 'char:3',
            }),
            ageVerified: 'bool',
            userId: 'uint16',
            tags: List('varchar'),
        }
    },
    note: {
        data: {
            text: 'varchar:5000'
        }
    }
}, undefined, {
    user: {
        name: (v) => /[a-zA-Z]/.test(v)
    }
})

export default proto