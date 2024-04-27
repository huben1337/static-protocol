# StaticProtocol

## Overview
**StaticProtocol** is a small utility for Typescript/Javascript that aims to be a fast and efficient tool for serializing and deserializing data based on a schema definition. It can be used for standalone endpoints as well as whole protocols.


## Features
- Works in Node.js and the browser 
- Simple schema definition
- Fully typed encoding and decoding
- Optional validation of data during decoding
- Zero build steps required
- Code generated at runtime for fast performance
- Packed bools

## Installation
```
npm install static-protocol
```

## Usage

A comprehensive overview of the usage can be found in the examples folder. You can run the demo as follows:
```
npm run demo
```

### Schema
A schema for a single endpoint can look something like this:
```ts
const endpointSchema = {
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
    },
    allocateNew: true,
    validate: false,
    channel: 1
}

/* Create enpoint using the schema */
const endpoint = StaticEndpoint(endpointSchema)
```

The `data` property defines the structure of the data to be encoded and decoded. Fields can be specified to be on of the available datatypes an enum or a nested schema. For defining enums its recommended to use the Enum function wrapper. The ids for enums can be either numbers or strings. But performance will be better if they are numbers.

The `channel` property defines the channel to be used for the endpoint. If the endpoint is used within a protocol and the channel is not defined, the channel will be generated automatically, otherwise no channel will be used. The value must be an integer between 0 and 255.

The `allocateNew` property defines if the endpoint should allocate a new buffer each time data is encoded. This is useful if you want to modify the data after it has been encoded.

If `validate` is set to false the validation functions will be skipped during decoding.

A schema for a whole protocol can look something like this:
```ts
const protocolSchema = {
    user: endpointSchema,
    note: {
        data: {
            text: 'varchar:5000'
        }
    }
}

/* Create protocol using the schema */
const protocol = StaticProtocol(protocolSchema)
```
The definition is simply a record of endpoint names and definitions.

The second argument to `StaticProtocol` is optional and indicates if the protocol is raw. Raw protocols dont require a channel for each endpoint.

### Datatypes

| Datatype         | Type in Javascript | Description                |
| ---------------- | ------------------ | -------------------------- |
| `uintX` / `intX` | `number`           | Simple integer types       |
| `bool`           | `boolean`          | Simple boolean type        |
| `char`           | `string`           | Fixed length string        |
| `varchar`        | `string`           | Variable length string     |
| `buf`            | `Uint8Array`       | Fixed length buffer        |
| `varbuf`         | `Uint8Array`       | Variable length buffer     |

## To-Do
- Add support for varints
- Add a way to validate fields with respect to values ​​of other fields.

## Contributing
I appriciate any contributions! Just fork and submit a pull request. 😊