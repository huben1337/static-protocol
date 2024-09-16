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

### Endpoint Schema
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
        tags: List('varchar'),
    },
    allocateNew: true,
    validate: false,
    channel: 1
}

/* Create enpoint using the schema */
const endpoint = StaticEndpoint(endpointSchema)
```
#### `data`
The `data` property defines the structure of the data to be encoded and decoded. Fields can be specified to be on of the available datatypes a nested schema, an array or an enum.

For defining enums the Enum wrapper function is used. The ids for enums can be either numbers or strings. But performance will be better if they are numbers. The values can be defined like `data` but nested enums are not supported.

For defining Arrays the List wrapper function is used. The item type can be defined like `data`.

#### `channel`
The `channel` property defines the channel to be used for the endpoint. If the endpoint is used within a protocol and the channel is not defined, the channel will be generated automatically, otherwise no channel will be used. The value must be an integer between 0 and 255.

#### `allocateNew`
The `allocateNew` property defines if the endpoint should allocate a new buffer each time data is encoded. This is useful if you want to modify the data after it has been encoded.

#### `validate`
If `validate` is set to false the validation functions will be skipped during decoding.

### Protocol Schema
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

## Benchmarks
 
Run `npm run bench` to run the benchmark.

Use `--inject-graph` to output a graph into this readme.

<style>
    .graph-container {
        position: relative;
        width: fit-content;
        --bar-top-padding: 2px;
        --bar-height: 20rem;
        font-size: 0.85rem;
        margin: auto;
    }
    .graph {
        display: flex;
        align-items: end;
    }
    .entry {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin: 0 8px;
    }
    .bar {
        padding: var(--bar-top-padding) 5px 0px 5px;
        border-radius: 3px 3px 0 0;
        width: fit-content;
    }
    .line-container {
        height: var(--bar-height);
        width: 100%;
        position: absolute;
    }
    .line {
        position: absolute;
        height: 1px;
        width: 100%;
        background-color: #474747;
        z-index: -1;
    }
    .y-text {
        position: absolute;
        writing-mode: vertical-rl;
        transform: translate(-1.7rem, calc(-50% + var(--bar-height) / 2)) rotate(180deg);
    }
</style>

<div class="graph-container">
    <div class="y-text">
        Operations per Second
    </div>
    <div class="line-container">
        <div class="line" style="top: 0"></div>
        <div class="line" style="top: 25%"></div>
        <div class="line" style="top: 50%"></div>
        <div class="line" style="top: 75%"></div>
        <div class="line" style="top: 100%"></div>
    </div>
    <div class="graph">    
        <div class="entry">
            <div class="bar" style="height: calc(var(--bar-height) * 0.248 - var(--bar-top-padding)); background-color: #731ae8;">90&thinsp;555</div>
            <div class="label">json-encode</div>
        </div>
        <div class="entry">
            <div class="bar" style="height: calc(var(--bar-height) * 1.000 - var(--bar-top-padding)); background-color: #aa1ae8;">365&thinsp;304</div>
            <div class="label">static-protocol-encode</div>
        </div>
        <div class="entry">
            <div class="bar" style="height: calc(var(--bar-height) * 0.207 - var(--bar-top-padding)); background-color: #701ae8;">75&thinsp;655</div>
            <div class="label">json-decode</div>
        </div>
        <div class="entry">
            <div class="bar" style="height: calc(var(--bar-height) * 0.653 - var(--bar-top-padding)); background-color: #901ae8;">238&thinsp;409</div>
            <div class="label">static-protocol-decode</div>
        </div>
    </div>
</div>

## To-Do
- Add support for varints
- Add a way to validate fields with respect to values ​​of other fields.

## Contributing
I appriciate any contributions! Just fork and submit a pull request. 😊