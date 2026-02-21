import type { ParamValidationResult } from './index'

export const validateTemplateParams = (param: string | undefined): ParamValidationResult => {
	if (!param) {
		return { valid: false, error: 'requires a template string (e.g., template:"${name}")' }
	}

	return { valid: true }
}

export const template = (input: string | any[], param?: string): string => {
	if (!param) {
		return typeof input === 'string' ? input : JSON.stringify(input)
	}

	// Remove outer parentheses if present
	param = param.replace(/^\((.*)\)$/, '$1')
	// Remove surrounding quotes (both single and double)
	param = param.replace(/^(['"])(.*)\1$/, '$2')

	let obj: any[] = []
	if (typeof input === 'string') {
		try {
			obj = JSON.parse(input)
		} catch (_error) {
			obj = [input]
		}
	} else {
		obj = input
	}

	// Ensure obj is always an array
	obj = Array.isArray(obj) ? obj : [obj]

	const result = obj.map((item) => replaceTemplateVariables(item, param)).join('\n\n')
	return result
}

function replaceTemplateVariables(obj: any, template: string): string {
	// If obj is a string that looks like an object, try to parse it
	if (typeof obj === 'string') {
		try {
			obj = parseObjectString(obj)
		} catch (_error) {
			// Failed to parse object string
		}
	}

	let result = template.replace(/\$\{([\w.]+)\}/g, (_match, path) => {
		const value = getNestedProperty(obj, path)
		return value !== undefined && value !== 'undefined' ? value : ''
	})

	// Handle the case where obj is a simple string (from string literal in map)
	if (typeof obj === 'object' && obj.str) {
		result = result.replace(/\$\{str\}/g, obj.str)
	}

	// Replace \n with actual newlines
	result = result.replace(/\\n/g, '\n')

	// Remove any empty lines (which might be caused by undefined values)
	result = result
		.split('\n')
		.filter((line) => line.trim() !== '')
		.join('\n')

	return result.trim()
}

function parseObjectString(str: string): any {
	const obj: any = {}
	const regex = /(\w+):\s*("(?:\\.|[^"\\])*"|[^,}]+)/g
	let match

	while ((match = regex.exec(str)) !== null) {
		let [, key, value] = match
		// Remove quotes from the value if it's a string
		if (value.startsWith('"') && value.endsWith('"')) {
			value = value.slice(1, -1)
		}
		obj[key] = value === 'undefined' ? undefined : value
	}

	return obj
}

function getNestedProperty(obj: any, path: string): any {
	const result = path.split('.').reduce((current, key) => {
		return current && typeof current === 'object' ? current[key] : undefined
	}, obj)
	return result
}
