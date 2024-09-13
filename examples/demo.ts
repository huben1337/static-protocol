import emiter from "./emiter.js"
import endpoint from "./endpoint.js"
import handler from "./handler.js"
import echo from "./helpers/echo.js"
import proto from "./protocol.js"

/* Example endpoint usage */
{

const buffer = endpoint.encode({
    picture: new Uint8Array(5000),
    info: {
        date: Date.now() / 1000,
        description: 'A very nice picture'
    }
})

const decoded = endpoint.decode(buffer)

console.log('\nDecoded data from endpoint:', decoded)

}

/* Example protocol usage */
{

const buffer = proto.user.encode({ name: 'test', age: { id: 0, value: 123 }, ageVerified: true, userId: 1234, tags: ['cringe', 'funny', 'silly'] })

const decoded = proto.user.decode(buffer)

console.log('\nDecoded data from protocol:', decoded)

}

/* Emiter and handler usage */

echo.onData = handler

emiter.note({ text: 'Hello world!' })