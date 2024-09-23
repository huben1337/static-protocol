const CODE_INDENT_SPACES = 4
const CODE_INDENT = ' '.repeat(CODE_INDENT_SPACES)

type CodeLike = Switch | ObjectDeclaration | Code | string

class Code {
    constructor (intitialValue: CodeLike = '', end: CodeLike = '') {
        this.lines.push({value: intitialValue, indent: this.indent})
        this.end = end
    }

    private lines = new Array<{value: CodeLike | string, indent: number}>()
    private readonly end: CodeLike

    indent = 0

    get length () {
        return this.lines.length
    }

    insert (code: Code | string, index: number) {
        this.lines.splice(index, 0, {
            value: code,
            indent: this.lines[index].indent
        })
    }

    add (code: CodeLike) {
        this.lines.push({
            value: code,
            indent: this.indent
        })
    }

    switch (key: string) {
        const switchCode = new Switch(key)
        this.add(switchCode)
        return switchCode
    }

    if (condition: string) {
        const ifCode = new If(condition)
        this.add(ifCode)
        return ifCode
    }

    toString (blockIndent = 0, newLine = '\n'): string {
        const  v = this.lines.map(line => {
            if (typeof line.value === 'string') {
                return `${CODE_INDENT.repeat(line.indent + blockIndent)}${line.value}`
            } else {
                return line.value.toString(line.indent + blockIndent)
            }
        }).join(newLine) + `${newLine}${CODE_INDENT.repeat(blockIndent)}${this.end.toString()}`
        return v
    }
}

class Switch {
    constructor (key: string) {
        this.code = new Code(`switch (${key}) {`, '}')
        this.code.indent++
    }
    code: Code
    case (value: string, scoped = true) {
        const caseCode = scoped ? new Code(`case ${value}: {`, '}') : new Code(`case ${value}:`)
        caseCode.indent++
        this.code.add(caseCode)
        return caseCode
    }
    toString (blockIndent = 0, ) {
        return this.code.toString(blockIndent)
    }
}

class If extends Code {
    constructor (condition: string) {
        super(`if (${condition}) {`, '}')
        this.indent++
    }
    elseIf (condition: string) {
        this.indent--
        this.add(`} else if (${condition}) {`)
        this.indent++
        return this
    }
    else () {
        this.add('} else {')
        this.indent++
        return this
    }
}

class ObjectDeclaration {
    constructor (private readonly assignment = '') {}

    private readonly props = new Array<[string, CodeLike]>()
    private readonly getters = new Array<[string, CodeLike]>()

    addProperty (key: string, value: CodeLike) {
        this.props.push([key, value])
    }

    addGetter (key: string, getterCode: CodeLike) {
        this.getters.push([key, getterCode])
    }

    toString (blockIndent = 0): string {
        const blockIndentString = CODE_INDENT.repeat(blockIndent)

        const propIndentString = CODE_INDENT.repeat(blockIndent + 1)

        const props = this.props.map(([key, value]) => {
            const valueString = typeof value === 'string'
            ? value
            : value.toString(blockIndent + 1).slice((blockIndent + 1) * CODE_INDENT_SPACES)
            return `${propIndentString}${key}: ${valueString}`
        }).join(`,\n`)

        const getters = this.getters.map(([key, getter]) => {
            const getterString = typeof getter === 'string'
            ? `${CODE_INDENT.repeat(blockIndent + 2)}${getter}`
            : getter.toString(blockIndent + 2)

            return `${propIndentString}get ${key} () {\n${getterString}\n${propIndentString}}`
        }).join(`,\n`)

        return `${blockIndentString}${this.assignment}{\n${props}${this.getters.length > 0 ? `,\n${getters}` : ''}\n${blockIndentString}}`
    }

}

export const compile = <T>(code: Code, context = {}) => {
    // console.log(code.toString())
    return Function.call(null, code.toString()).call(context) as T
}



export default Code