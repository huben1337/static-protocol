const CODE_INDENT_SPACES = 4
const CODE_INDENT = ' '.repeat(CODE_INDENT_SPACES)

function compile (code: string) {
    return eval(`(() => { ${code} })`)()
}

type CodeLike = Switch | Code | string

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
    toString (blockIndent = 0) {
        return this.code.toString(blockIndent)
    }
}



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

    toString (blockIndent = 0): string {
        const  v = this.lines.map(line => {
            if (typeof line.value === 'string') {
                return `${CODE_INDENT.repeat(line.indent + blockIndent)}${line.value}`
            } else {
                return line.value.toString(line.indent + blockIndent)
            }
        }).join('\n') + `\n${CODE_INDENT.repeat(blockIndent)}${this.end}`
        return v
    }

    compile (context = {}) {
        console.log(this.toString())
        return compile.call(context, this.toString())
    }
}


export default Code