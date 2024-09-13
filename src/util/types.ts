export const enum INTERNAL_TYPES {
    BUF,
    VARBUF,
    CHAR,
    VARCHAR,
    BOOL,
    NONE,
    UINT,
    INT,
    VARUINT
}

export type DeepReadonly<T> = {
    readonly [K in keyof T]: DeepReadonly<T[K]>
}