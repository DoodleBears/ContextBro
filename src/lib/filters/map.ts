import type { ParamValidationResult } from './index'

export const validateMapParams = (param: string | undefined): ParamValidationResult => {
	if (!param) {
		return { valid: false, error: 'requires an arrow function (e.g., map:x => x.name)' }
	}

	const match = param.match(/^\s*(\w+)\s*=>\s*(.+)$/)
	if (!match) {
		return { valid: false, error: 'invalid syntax. Use arrow function format (e.g., x => x.name)' }
	}

	return { valid: true }
}

export const map = (str: string, param?: string): string => {
	let array
	try {
		array = JSON.parse(str)
	} catch (_error) {
		array = [str]
	}

	if (Array.isArray(array) && param) {
		const match = param.match(/^\s*(\w+)\s*=>\s*(.+)$/)
		if (!match) {
			return str
		}
		const [, argName, expression] = match

		const mappedArray = array.map((item, _index) => {
			// Check if the expression is an object literal or a string literal
			if (
				(expression.trim().startsWith('{') && expression.trim().endsWith('}')) ||
				(expression.trim().startsWith('"') && expression.trim().endsWith('"')) ||
				(expression.trim().startsWith("'") && expression.trim().endsWith("'"))
			) {
				// Use a simple object to store the mapped properties
				const mappedItem: { [key: string]: any } = {}

				// Parse the expression to extract property assignments or string literal
				if (expression.trim().startsWith('{')) {
					const assignments = expression.match(/\{(.+)\}/)?.[1].split(',') || []

					assignments.forEach((assignment) => {
						const [key, value] = assignment.split(':').map((s) => s.trim())
						// Remove any surrounding quotes from the key
						const cleanKey = key.replace(/^['"](.+)['"]$/, '$1')
						// Evaluate the value expression
						const cleanValue = evaluateExpression(value, item, argName)
						mappedItem[cleanKey] = cleanValue
					})
				} else {
					// Handle string literal
					const stringLiteral = expression.trim().slice(1, -1)
					mappedItem.str = stringLiteral.replace(new RegExp(`\\$\\{${argName}\\}`, 'g'), item)
				}

				return mappedItem
			} else {
				// If it's not an object literal or string literal, treat it as a simple expression
				return evaluateExpression(expression, item, argName)
			}
		})

		return JSON.stringify(mappedArray)
	}
	return str
}

function evaluateExpression(expression: string, item: any, argName: string): any {
	if (typeof item === 'string') {
		// For simple string arrays, return the item directly
		return item
	}
	const result = expression.replace(new RegExp(`${argName}\\.([\\w.\\[\\]]+)`, 'g'), (_, prop) => {
		const value = getNestedProperty(item, prop)
		return JSON.stringify(value)
	})
	try {
		return JSON.parse(result)
	} catch {
		return result.replace(/^["'](.+)["']$/, '$1')
	}
}

function getNestedProperty(obj: any, path: string): any {
	const result = path
		.split(/[.[\]]/)
		.filter(Boolean)
		.reduce((current, key) => {
			if (current && Array.isArray(current) && /^\d+$/.test(key)) {
				return current[parseInt(key, 10)]
			}
			return current && current[key] !== undefined ? current[key] : undefined
		}, obj)
	return result
}
