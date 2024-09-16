import { argv } from "process"
import { StaticEndpoint } from "../src/StaticEndpoint.js"
import { BufferLike } from "../src/util/Buffer.js"
import dataGeneratorFactory from "./dataGeneratorFactory.js"
import randomDefinitionFactory from "./randomDefinitionFactory.js"
import { log } from "console"
import Code from "../src/codegen/Code.js"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"

declare const gc: () => void
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const allResults: { [label: string]: number[] | undefined } = {}

const DEBUG_LOG = argv.includes('--debug-log')

const runTest = async <T, U> (label: string, dataIterable: IterableIterator<T> | T[], cb: (data: T) => U) => {
    let results = allResults[label]
    if (!results) {
        results = []
        allResults[label] = results
    }
    const resultData = new Array<U>(Array.isArray(dataIterable) ? dataIterable.length : 0)
    let i = 0
    for (const data of dataIterable) {
        const start = performance.now()
        resultData[i++] = cb(data)
        const delta = performance.now() - start
        results.push(delta)
        if (DEBUG_LOG) log(`${label}: \x1b[32m${delta.toFixed(3)}\x1b[0m ms`)
    }
    gc()
    await delay(100)

    return resultData
}

const RUNS_PER_TEST = 10
const TEST_ITERATIONS = 100_000

const randomDefinition = randomDefinitionFactory({
    maxDepth: 3,
    fieldTypesConfig: {
        uint64: false,
        int64: false,
        buf: false,
        varbuf: false,
    }
})

for (let i = 0; i < 100; i++) {
    const def = randomDefinition()
    // console.dir(def, { depth: null })
    const ep = StaticEndpoint(def)
        
    const dataGen = dataGeneratorFactory(ep) as () => unknown
    
    const spEncode = ep.encode as (data: unknown) => BufferLike
    const spDecode = ep.decode as (buffer: BufferLike) => unknown

    const encodeData = Array.from({ length: RUNS_PER_TEST }, dataGen)

    const jsonEncodeResults = await runTest('json-encode', encodeData, (data) => {
        for (let i = 1; i < TEST_ITERATIONS; i++) {
            JSON.stringify(data)
        }
        return JSON.stringify(data)
    })
    
    const spEncodeResults = await runTest('static-protocol-encode', encodeData, (data) => {
        for (let i = 1; i < TEST_ITERATIONS; i++) {
            spEncode(data)
        }
        return spEncode(data)
    })

    
    await runTest('json-decode', jsonEncodeResults, (data) => {
        for (let i = 0; i < TEST_ITERATIONS; i++) {
            JSON.parse(data)
        }
    })
    
    await runTest('static-protocol-decode', spEncodeResults, (data) => {
        for (let i = 0; i < TEST_ITERATIONS; i++) {
            spDecode(data)
        }
    })
}

// Print Results

let maxLabelLength = 0
let maxPerfValue = 0

const benchmarkResults: [label: string, opsPerSecond: number, perf: string][] = []

for (const [label, timings] of Object.entries(allResults)) {
    if (!timings) throw new Error('No timings')
    const sum = timings.reduce((a, b) => a + b, 0)
    const ops = timings.length * TEST_ITERATIONS
    const opsPerSecond = ((ops * 1000) / sum)
    const perf = opsPerSecond.toFixed(0)
    maxLabelLength = Math.max(maxLabelLength, label.length)
    maxPerfValue = Math.max(maxPerfValue, opsPerSecond)
    benchmarkResults.push([label, opsPerSecond, perf])
}

const maxLabelAndPerfLength = maxLabelLength + Math.ceil(Math.log10(maxPerfValue))

for (const [label,, perf] of benchmarkResults) {
    log(`${label}: ${' '.repeat(maxLabelAndPerfLength - (label.length + perf.length))}\x1b[32m${perf}\x1b[0m op/s`)
}


const INJECT_GRAPH = argv.includes('--inject-graph')

type RGB = {
    r: number
    g: number
    b: number
}

const getBarColor = (relativeHeight: number, startRGB: RGB, endRGB: RGB): string => {
    const r = interpolate(startRGB.r, endRGB.r, relativeHeight)
    const g = interpolate(startRGB.g, endRGB.g, relativeHeight)
    const b = interpolate(startRGB.b, endRGB.b, relativeHeight)
    return rgbToHex({ r,g, b })
}
  
const hexToRgb = (hex: string): RGB => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) throw new Error('Invalid hex color: ' + hex)
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    }
}
  
const rgbToHex = ({ r, g, b }: RGB) => {
    const int = ((r << 16) + (g << 8) + b >>> 0).toString(16)
    return '#' + '0'.repeat(6 - int.length) + int
}
  
const interpolate = (start: number, end: number, ratio: number) => start + (end - start) * ratio

if (INJECT_GRAPH) {
    log('\nCreating HTML Graph...')
    const code = new Code()
    code.indent++
    for (const [label, opsPerSecond, perf] of benchmarkResults) {
        const threeDigitParts = new Array<string>(Math.ceil(perf.length / 3))
        let partIndex = threeDigitParts.length - 1
        for (let i = perf.length; i >= 0; i -= 3) {
            threeDigitParts[partIndex--] = perf.substring(i - 3, i)
        }
        code.add('<div class="entry">')
        code.indent++
        const relativeBarHeight = (opsPerSecond / maxPerfValue)
        const color = getBarColor(relativeBarHeight, hexToRgb('#621ae8'), hexToRgb('#aa1ae8'))
        const barText = threeDigitParts.join('\u2009')
        code.add(`<div class="bar" style="height: calc(var(--bar-height) * ${relativeBarHeight.toFixed(3)}  - var(--bar-top-padding)); background-color: ${color};">${barText}</div>`)
        code.add(`<div class="label">${label}</div>`)
        code.indent--
        code.add('</div>')
    }
    code.indent--
    const path = join(import.meta.dirname, '../../assets/graph.svg')
    log('Injecting HTML Graph...')
    const graphFileBuffer = await readFile(path)
    const graphDivOpen = '<div class="graph">'
    const graphDivStart = graphFileBuffer.indexOf(graphDivOpen)
    if (graphDivStart === -1) throw new Error('Graph div not found.')
    let lastDivOpenIndex = graphDivStart + graphDivOpen.length
    let lastDivCloseIndex = lastDivOpenIndex
    let openDivs = 1
    let end = -1
    const closeDiv = '</div>'
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
        while (lastDivCloseIndex <= lastDivOpenIndex) {
            lastDivCloseIndex = graphFileBuffer.indexOf(closeDiv, lastDivCloseIndex)
            if (lastDivCloseIndex === -1) throw new Error('Graph was not closed.')
            lastDivCloseIndex += closeDiv.length
            openDivs--
        }

        
        while (lastDivOpenIndex <= lastDivCloseIndex) {
            lastDivOpenIndex = graphFileBuffer.indexOf('<div', lastDivOpenIndex + 1)
            if (lastDivOpenIndex === -1) {
                while (openDivs > 0) {
                    lastDivCloseIndex = graphFileBuffer.indexOf(closeDiv, lastDivCloseIndex)
                    if (lastDivCloseIndex === -1) throw new Error('Graph was not closed.')
                    lastDivCloseIndex += closeDiv.length
                    openDivs--
                }
                break
            }
            lastDivOpenIndex += 4
            openDivs++
        }
        
        if (openDivs === 0) {
            end = lastDivCloseIndex - closeDiv.length
            break
        }
    }
    let graphDivIndent = 0
    const lastLine = graphFileBuffer.lastIndexOf('\n', graphDivStart)
    if (lastLine !== -1) {
        for (let i = lastLine + 1; i < graphDivStart; i++) {
            if (graphFileBuffer[i] === ' '.charCodeAt(0)) {
                graphDivIndent++
            } else {
                graphDivIndent = 0
                break
            }
        }
    }
    const start = graphDivStart + graphDivOpen.length
    const newGraphDiv = code.toString(Math.floor(graphDivIndent / 4))
    const newGraphFileBuffer = Buffer.alloc(start + newGraphDiv.length + (graphFileBuffer.length - end))
    graphFileBuffer.copy(newGraphFileBuffer, 0, 0, start)
    graphFileBuffer.copy(newGraphFileBuffer, start + newGraphDiv.length, end, graphFileBuffer.length)
    newGraphFileBuffer.write(newGraphDiv, start, newGraphDiv.length)
    await writeFile(path, newGraphFileBuffer)
    log('Successfully injected HTML Graph.')
}

// Max depth: 3
// json-encode:            198554.146 op/s
// static-protocol-encode: 720976.462 op/s
// json-decode:            180126.349 op/s
// static-protocol-decode: 854974.593 op/s

// No Arrays. Max depth: 4
// json-encode:             271627.975 op/s
// static-protocol-encode:  796987.492 op/s
// json-decode:             238813.369 op/s
// static-protocol-decode: 1133660.151 op/s

// No Strings Max depth: 3
// json-encode:             231789.792 op/s
// static-protocol-encode: 1899757.199 op/s
// json-decode:             189639.488 op/s
// static-protocol-decode: 5119314.323 op/s
