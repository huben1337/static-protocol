const CODE_INDENT_SPACES = 4
const CODE_INDENT = ' '.repeat(CODE_INDENT_SPACES)

function compile (code: string) {
    return eval(`(() => { ${code} })`)()
}

class Code {
    constructor (intitialValue = '') {
        this.lines.push({value: intitialValue, indent: this._indent})
    }

    private lines = new Array<{value: string, indent: number}>()

    private _indent = 0

    get indent () {
        return this._indent
    }

    set indent (value: number) {
        this._indent = value
    }

    insertLine (line: string, index: number) {
        this.lines.splice(index, 0, {
            value: line,
            indent: this.lines[index].indent
        })
    }

    addLine (line: string) {
        this.lines.push({
            value: line,
            indent: this._indent
        })
    }

    toString () {
        let result = ''
        for (const line of this.lines) {
            result += '\n' + CODE_INDENT.repeat(line.indent) + line.value
        }
        return result
    }

    compile (context = {}) {
        // console.log(this.toString())
        return compile.call(context, this.toString())
    }
}

export default Code