interface Props {
	content: string
	error?: string
	loading?: boolean
}

export function JsonPreview({ content, error, loading }: Props) {
	if (loading) {
		return (
			<div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-400">
				Compiling template...
			</div>
		)
	}

	if (error) {
		return (
			<div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-600">
				{error}
			</div>
		)
	}

	// Try to format as JSON for display
	let formatted = content
	try {
		const parsed = JSON.parse(content)
		formatted = JSON.stringify(parsed, null, 2)
	} catch {
		// Not JSON — show raw
	}

	return (
		<pre className="max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
			{formatted}
		</pre>
	)
}
