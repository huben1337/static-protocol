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
- varuint for unsigned varints
- bool
- 'buf:length' for fixed size buffers
- 'char:length' for fixed size strings
- 'varchar:maxlength' for variable size strings
- 'varbuf:maxlength' for variable size buffers

## To-Do
- Add support for varuints
- Enable packing of bools from enums
- Improve performance for enums