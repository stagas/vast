import path from 'node:path'
import fm from 'file-matcher'

export default async () => {
  const root = 'src/'
  const ext = '{js,jsx,ts,tsx}'
  const filePattern = '**/*.' + ext
  const testFilePattern = '**/*.{spec,test}.' + ext
  const inlineTestPattern = filePattern

  const fileOptions = {
    path: root,
    recursiveSearch: true,
    fileFilter: {
      fileNamePattern: testFilePattern,
    }
  }

  const inlineOptions = {
    path: root,
    recursiveSearch: true,
    fileFilter: {
      fileNamePattern: inlineTestPattern,
      content: /import\.meta\.vitest/,
    }
  }

  const cwd = process.cwd()
  const relative = filename => path.relative(cwd, filename)

  const fileMatcher = new fm.FileMatcher()
  const fileTests = (await fileMatcher.find(fileOptions)).map(relative)
  const inlineTests = (await fileMatcher.find(inlineOptions)).map(relative)

  return {
    autoDetect: true,
    files: [
      root + filePattern,
      ...fileTests.map(file => `!${file}`),
      ...inlineTests.map(file => `!${file}`)
    ],
    tests: [
      ...fileTests,
      ...inlineTests,
    ],
  }
}
