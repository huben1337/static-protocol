# StaticProtocol

## Overview
StaticProtocol is a small utility for specifying a schema and creating an instance that provides encode and decode methods. It is still a work in progress and aims to be a fast and efficient tool for encoding and decoding data.

## Features
- Schema specification
- Typed encoding and decoding
- Generated and compiled code for fast performance
- Packed bools

## Datatypes
- int/uint 8, 16, 32, 64
- bool
- 'char:length' for fixed size strings
- 'varchar:maxlength' for variable length strings (maxlength can be omitted)

## Basic Usage
```ts
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
```

## To-Do
- Add support for varints
- Enable packing of bools from enums