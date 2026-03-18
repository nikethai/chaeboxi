// Referenced from the existing renderer implementation.
export function processLaTeX(content: string): string {
	const codeBlocks: string[] = []
	content = content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (_, code: string) => {
		codeBlocks.push(code)
		return `<<CODE_BLOCK_${codeBlocks.length - 1}>>`
	})

	const latexExpressions: string[] = []
	content = content.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g, (match) => {
		latexExpressions.push(match)
		return `<<LATEX_${latexExpressions.length - 1}>>`
	})

	content = content.replace(/\$(?=\d)/g, '\\$')
	content = content.replace(/<<LATEX_(\d+)>>/g, (_, index: string) => latexExpressions[Number.parseInt(index, 10)])
	content = content.replace(/<<CODE_BLOCK_(\d+)>>/g, (_, index: string) => codeBlocks[Number.parseInt(index, 10)])
	content = escapeBrackets(content)
	content = escapeMhchem(content)

	return content
}

export function escapeBrackets(text: string): string {
	const pattern = /(```[\S\s]*?```|`.*?`)|\\\[([\S\s]*?[^\\])\\]|\\\((.*?)\\\)/g

	return text.replace(
		pattern,
		(
			match: string,
			codeBlock: string | undefined,
			squareBracket: string | undefined,
			roundBracket: string | undefined
		): string => {
			if (codeBlock != null) {
				return codeBlock
			}

			if (squareBracket != null) {
				return `$$${squareBracket}$$`
			}

			if (roundBracket != null) {
				return `$${roundBracket}$`
			}

			return match
		}
	)
}

export function escapeMhchem(text: string) {
	return text.replaceAll('$\\ce{', '$\\\\ce{').replaceAll('$\\pu{', '$\\\\pu{')
}
