import { StaticEndpoint } from "../src/StaticEndpoint.js"

const endpoint = StaticEndpoint({
    data: {
        picture: 'varbuf:5000',
        info: {
            date: {
                type: 'uint32',
                validate: true
            },
            description: 'varchar'
        }
    },
}, {
    info: {
        date: (v) => v > 1000000,
    }
})

export default endpoint