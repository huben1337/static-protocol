import { StaticProtocol, Enum, List } from '../index.js'

const proto = StaticProtocol({
    user: {
        data: {
            name: {
                type: 'varchar',
                /**
                 * Test function - If it fails the decode will return null
                 */
                test: (value: string) => /[a-zA-Z]/.test(value)
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
})

export default proto