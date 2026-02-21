interface Props {
	content: string
	error?: string
	loading?: boolean
}

export function JsonPreview({ content, error, loading }: Props) {
	if (loading) {
		return (
			<div className="rounded-md border bg-muted p-3 text-xs text-muted-foreground">
				Compiling template...
			</div>
		)
	}

	if (error) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
				{error}
			</div>
		)
	}

	let formatted = content
	try {
		const parsed = JSON.parse(content)
		formatted = JSON.stringify(parsed, null, 2)
	} catch {
		// Not JSON — show raw
	}

	return (
		<pre className="max-h-64 overflow-auto rounded-md border bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">
			{formatted}
		</pre>
	)
}
