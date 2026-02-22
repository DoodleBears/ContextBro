/**
 * JSON stringify filter — wraps a value in JSON.stringify() so it is safe
 * to embed inside a hand-crafted JSON template.
 *
 * Usage:  {{content|json_stringify}}
 * Input:  He said "hi"\nNew line
 * Output: "He said \"hi\"\nNew line"   (including surrounding quotes)
 */
export function json_stringify(value: string): string {
	return JSON.stringify(value)
}
