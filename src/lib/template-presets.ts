import type { ContextBroTemplate } from '@/lib/types'

/**
 * Built-in preset templates that users can quickly add.
 * Each covers a common use-case with relevant variables and filters.
 */
export const TEMPLATE_PRESETS: Omit<ContextBroTemplate, 'id'>[] = [
	{
		name: 'General Page',
		contentFormat: `{
  "title": "{{title}}",
  "url": "{{url}}",
  "content": "{{content}}",
  "author": "{{author}}",
  "published": "{{published}}",
  "domain": "{{domain}}",
  "description": "{{description}}",
  "wordCount": {{wordCount}},
  "clippedAt": "{{date}} {{time}}"
}`,
	},
	{
		name: 'GitHub PR / Issue',
		triggers: ['github.com/*/pull/*', 'github.com/*/issues/*'],
		contentFormat: `{
  "type": "github",
  "title": "{{title}}",
  "url": "{{url}}",
  "repo": "{{selector:meta[property='og:title']@content|split:' · '|last}}",
  "content": "{{content|truncate:8000}}",
  "author": "{{author}}",
  "domain": "{{domain}}",
  "clippedAt": "{{date}} {{time}}"
}`,
	},
	{
		name: 'Stack Overflow Q&A',
		triggers: ['stackoverflow.com/questions/*'],
		contentFormat: `{
  "type": "stackoverflow",
  "title": "{{title|replace:' - Stack Overflow':''}}",
  "url": "{{url}}",
  "question": "{{selector:#question .js-post-body|markdown}}",
  "acceptedAnswer": "{{selector:.accepted-answer .js-post-body|markdown}}",
  "tags": "{{selector:.post-tag|list}}",
  "votes": "{{selector:#question .js-vote-count@data-value}}",
  "clippedAt": "{{date}} {{time}}"
}`,
	},
	{
		name: 'News Article',
		triggers: [
			'*.reuters.com/*',
			'*.bbc.com/*',
			'*.cnn.com/*',
			'*.nytimes.com/*',
			'*.apnews.com/*',
			'news.ycombinator.com/*',
		],
		contentFormat: `{
  "type": "news",
  "title": "{{title}}",
  "url": "{{url}}",
  "content": "{{content|truncate:6000}}",
  "author": "{{author}}",
  "published": "{{published}}",
  "domain": "{{domain}}",
  "description": "{{description}}",
  "image": "{{image}}",
  "clippedAt": "{{date}} {{time}}"
}`,
	},
	{
		name: 'Reddit Post',
		triggers: ['*.reddit.com/r/*/comments/*'],
		contentFormat: `{
  "type": "reddit",
  "title": "{{title}}",
  "url": "{{url}}",
  "subreddit": "{{selector:[data-testid='subreddit-name']|replace:r/.:''}}",
  "content": "{{content|truncate:6000}}",
  "author": "{{author}}",
  "domain": "{{domain}}",
  "clippedAt": "{{date}} {{time}}"
}`,
	},
	{
		name: 'YouTube Video',
		triggers: ['youtube.com/watch*', 'youtube.com/live*'],
		contentFormat: `{
  "type": "youtube",
  "title": "{{title|replace:' - YouTube':''}}",
  "url": "{{url}}",
  "channel": "{{selector:#owner #channel-name|text}}",
  "description": "{{description}}",
  "published": "{{published}}",
  "domain": "youtube.com",
  "clippedAt": "{{date}} {{time}}"
}`,
	},
	{
		name: 'Selection Only',
		contentFormat: `{
  "selection": "{{selection}}",
  "sourceUrl": "{{url}}",
  "sourceTitle": "{{title}}",
  "clippedAt": "{{date}} {{time}}"
}`,
	},
]
