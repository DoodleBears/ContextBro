import type { Endpoint } from '@/lib/types'

export interface SendResult {
	ok: boolean
	status: number
	statusText: string
	body?: string
}

/**
 * Send compiled template output to an endpoint via POST.
 * The body is the raw compiled template string — users control the shape via templates.
 */
export async function sendToEndpoint(endpoint: Endpoint, body: string): Promise<SendResult> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...endpoint.headers,
	}

	try {
		const response = await fetch(endpoint.url, {
			method: 'POST',
			headers,
			body,
		})

		const responseBody = await response.text().catch(() => undefined)

		return {
			ok: response.ok,
			status: response.status,
			statusText: response.statusText,
			body: responseBody,
		}
	} catch (error) {
		return {
			ok: false,
			status: 0,
			statusText: error instanceof Error ? error.message : 'Network error',
		}
	}
}
