import { StaticEndpoint } from "../src/StaticEndpoint.js";

const endpoint = new StaticEndpoint({
    data: {
        picture: 'varbuf:5000',
        info: {
            date: 'uint32',
            description: 'varchar'
        }
    },
})

export default endpoint