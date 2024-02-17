export const NONSPACE = /[^\s]/g
export const SPACE = /\s/g
export const WORD = /[\s]{2,}|[./\\()"'\-:,.;<>~!@#$%^&*|+=[\]{}`~?\b ]{1}|\w+/g
export const TOKEN = /\s+|[\w\.]+|[\W]/g
export const BRACKET = /[\[\]\(\)\{\}]/ // used with .test so not a /g
///.+?\b|.\B|\b.+?/g

export const Open = {
  '(': ')',
  '[': ']',
  '{': '}',
} as any

export const Close = {
  ')': '(',
  ']': '[',
  '}': '{',
} as any

export const openers = new Set(Object.keys(Open))
export const closers = new Set(Object.keys(Close))

export function findMatchingBrackets(s: string, i: number): [number, number] | undefined {
  let char: string
  const stack: string[] = []
  let max = 1000

  --i

  const L = s[i]
  const R = s[i + 1]
  const LO = Open[L]
  const RO = Open[R]
  const LC = Close[L]
  const RC = Close[R]

  if (LC && RO) i++
  else if ((LO || RO) && (LC || RC)) { }
  else if (RO && !LO) i++
  else if (LC && !RC) i--

  while (i >= 0) {
    if (!--max) return
    char = s[i--]!
    if (closers.has(char)) {
      stack.push(Close[char])
    }
    else if (stack.at(-1) === char) {
      stack.pop()
    }
    else if (openers.has(char)) {
      stack.push(char)
      break
    }
  }
  const openIndex = ++i
  const open = stack.at(-1)
  while (i < s.length) {
    if (!--max) return
    char = s[i++]!
    if (openers.has(char)) {
      stack.push(Open[char])
    }
    else if (stack.at(-1) === char) {
      stack.pop()
      if (stack.length === 1 && Close[char] === open) return [openIndex, i - 1]
    }
    else if (closers.has(char)) {
      return
    }
  }
}

export function parseWords(regexp: RegExp, text: any) {
  regexp.lastIndex = 0
  let word
  const words: RegExpExecArray[] = []
  while ((word = regexp.exec(text))) words.push(word)
  return words
}

export function lineBegin(line: string) {
  return line.match(/[^\s]|$/m)!.index!
}

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function byDepth(a: { depth: number }, b: { depth: number }) {
  return a.depth - b.depth
}
