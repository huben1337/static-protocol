# StaticProtocol

## Overview
**StaticProtocol** is a small utility for Typescript/Javascript that aims to be a fast and efficient tool for serializing and deserializing data based on a schema definition. It can be used for standalone endpoints as well as whole protocols.


## Features
- Works in Node.js and the browser 
- Simple schema definition
- Fully typed encoding and decoding
- Generated and compiled code for fast performance
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
- Improve performance for enums

## Contributing
I appriciate any contributions! Just fork and submit a pull request. 😊