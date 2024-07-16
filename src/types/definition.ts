import ReadonlyUint8Array from "./ReadonlyUint8Array.js"

type ValueType<T> = T[keyof T]

type IntTypes = {
    uint8: number
    int8: number
    uint16: number
    int16: number
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

type ExtendedFieldType = ValueType<{
    [T in keyof InputDataTypes]: {
        type: T
        test: (value: InputDataTypes[T]) => boolean
    }
}>

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

type DefinedTypeInput<T extends FieldTypes> = T extends keyof InputDataTypes ? InputDataTypes[T] : (
    T extends ExtendedFieldType ? InputDataTypes[T['type']] : (
        T extends ArrayDefintionInternal ? DefinedTypeInput<T['def']>[] : (
            T extends EnumDefintionInternal ? EnumTypeInput<T['def']> : (
                {
                    [key in keyof T]: SubInput<T[key]>
                }
            )
        )
    )
)

type DefinedTypeOutput<T extends FieldTypes> = T extends keyof OutputDataTypes ? OutputDataTypes[T] : (
    T extends ExtendedFieldType ? OutputDataTypes[T['type']] : (
        T extends ArrayDefintionInternal ? DefinedTypeOutput<T['def']>[] : (
            T extends EnumDefintionInternal ? EnumTypeOutput<T['def']> : (
                {
                    [key in keyof T]: SubOutput<T[key]>
                }
            )
        )
    )
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

export type { InputDataTypes, OutputDataTypes, Definition, FieldTypes, ExtendedFieldType, DataDefintion, EnumDefintion, DefinedTypeInput, DefinedTypeOutput, EnumDefintionInternal, EnumFieldTypes, EnumTypeInput, EnumTypeOutput, HasExtended, EnumHasExtended, ArrayDefintionInternal, ArrayFieldTypes, BaseFieldTypes }