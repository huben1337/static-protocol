import { ValueType } from "./helpers.js"
import ReadonlyUint8Array from "./ReadonlyUint8Array.js"

type IntTypes = {
    uint8: number
    int8: number
    uint16: number
    int16: number
    uint24: number
    int24: number
    uint32: number
    int32: number
    uint64: bigint
    int64: bigint
    // varuint: number
}

type BaseDataTypes = {
    [x: `char:${number}`]: string
    [x: `varchar:${number}`]: string
    varchar: string
    bool: boolean
} & IntTypes

type InputDataTypes = {
    [x: `buf:${number}`]: Uint8Array | ReadonlyUint8Array
    [x: `varbuf:${number}`]: Uint8Array | ReadonlyUint8Array
    varbuf: Uint8Array | ReadonlyUint8Array
} & BaseDataTypes

type OutputDataTypes = {
    [x: `buf:${number}`]: ReadonlyUint8Array
    [x: `varbuf:${number}`]: ReadonlyUint8Array
    varbuf: ReadonlyUint8Array
} & BaseDataTypes

type Definition = {
    channel?: number
    data?: DataDefintion
    validate?: boolean
    allocateNew?: boolean
}

type ExtendedFieldType = {
    type: keyof InputDataTypes
    validate: true
}

type BaseFieldTypes = keyof InputDataTypes | DataDefintion | ExtendedFieldType | ArrayDefintionInternal

type FieldTypes = BaseFieldTypes | EnumDefintionInternal

type DataDefintion = { 
    [field: string]: FieldTypes
}

type EnumFieldTypes = BaseFieldTypes | 'none'

type EnumDefintion = {
    /** Maps id to type */
    [id: number | string]: EnumFieldTypes
}

type EnumDefintionInternal = {
    def: EnumDefintion
    isEnum: true
}

type ArrayFieldTypes = BaseFieldTypes | EnumDefintionInternal

type ArrayDefintionInternal = {
    def: ArrayFieldTypes
    long: boolean
    isArray: true
}


type SubInput<T> = T extends FieldTypes ? DefinedTypeInput<T> : never
type SubOutput<T> = T extends FieldTypes ? DefinedTypeOutput<T> : never

type HasData<T extends FieldTypes> = keyof T extends never ? false : ValueType<{
    [K in keyof T as (
        T[K] extends FieldTypes ? (
            HasData<T[K]> extends false ? never : K
        ) : never
    )]: true
}> extends never ? false : true


type DefinedTypeInput<T extends FieldTypes> = T extends keyof InputDataTypes ? InputDataTypes[T] : (
    T extends ExtendedFieldType ? InputDataTypes[T['type']] : (
        T extends ArrayDefintionInternal ? DefinedTypeInput<T['def']>[] : (
            T extends EnumDefintionInternal ? EnumTypeInput<T['def']> : (
                T extends DataDefintion ? {
                    [K in keyof T as HasData<T[K]> extends false ? never : K]: DefinedTypeInput<T[K]>
                } : never
            )
        )
    )
)

type DefinedTypeOutput<T extends FieldTypes> = T extends keyof OutputDataTypes ? OutputDataTypes[T] : (
    T extends ExtendedFieldType ? OutputDataTypes[T['type']] : (
        T extends ArrayDefintionInternal ? ArrayTypeOutput<T['def']> : (
            T extends EnumDefintionInternal ? EnumTypeOutput<T['def']> : (
                T extends DataDefintion ? {
                    [K in keyof T as HasData<T[K]> extends false ? never : K]: DefinedTypeOutput<T[K]>
                } : never
            )
        )
    )
)

type HasValidators<T extends DataDefintion> = ValueType<{
    [K in keyof T as (
        T[K] extends ExtendedFieldType
        ? K
        : (
            T[K] extends DataDefintion
            ? HasValidators<T[K]> extends true ? K : never
            : never
        )
    )]: true
}> extends never ? false : true

type Validators<T extends FieldTypes> = T extends ExtendedFieldType
? (value: InputDataTypes[T['type']]) => boolean
: (
    T extends DataDefintion
    ? (
        HasValidators<T> extends true
        ? {
            readonly [K in keyof T as (
                T[K] extends ExtendedFieldType
                ? K
                : (
                    T[K] extends DataDefintion
                        ? HasValidators<T[K]> extends true ? K : never
                        : never
                )
            )]: Validators<T[K]>
        }
        : never
    )
    : never
)


type ArrayTypeOutput<T extends ArrayFieldTypes> = (
    T extends 'int8' ? Int8Array
    : T extends 'uint8' ? Uint8Array
    : T extends 'int16' ? Int16Array
    : T extends 'uint16' ? Uint16Array
    : T extends 'int32' ? Int32Array
    : T extends 'uint32' ? Uint32Array
    : T extends 'int64' ? BigInt64Array
    : T extends 'uint64' ? BigUint64Array
    : T[]
)

type EnumTypeInput<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: T[key] extends 'none' ? {
        id: key extends `${infer num extends number}` ? num : key
    } : {
        id: key extends `${infer num extends number}` ? num : key
        value: SubInput<T[key]>
    }
}>

type EnumTypeOutput<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: T[key] extends 'none' ? {
        id: key extends `${infer num extends number}` ? num : key
    } : {
        id: key extends `${infer num extends number}` ? num : key
        value: SubOutput<T[key]>
    }
}>

type HasExtended<T extends FieldTypes> = T extends keyof InputDataTypes ? never : (
    T extends ExtendedFieldType ? true : (
        T extends EnumDefintionInternal ? EnumHasExtended<T['def']> : ValueType<{
            [key in keyof T]: T[key] extends FieldTypes ? HasExtended<T[key]> : never
        }>
    )
)

type EnumHasExtended<T extends EnumDefintion> = ValueType<{
    [key in keyof T]: T[key] extends FieldTypes ? HasExtended<T[key]> : never
}>

export type {
    IntTypes,
    InputDataTypes,
    OutputDataTypes,
    Definition,
    FieldTypes,
    ExtendedFieldType,
    Validators,
    HasValidators,
    DataDefintion,
    HasData,
    EnumDefintion,
    DefinedTypeInput,
    DefinedTypeOutput,
    EnumDefintionInternal,
    EnumFieldTypes,
    EnumTypeInput,
    EnumTypeOutput,
    HasExtended,
    EnumHasExtended,
    ArrayDefintionInternal,
    ArrayFieldTypes,
    BaseFieldTypes
}