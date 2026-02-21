import { Globe } from 'lucide-react'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { type Locale, useLocale } from '@/lib/i18n'

const LOCALE_LABELS: Record<Locale, string> = {
	en: 'English',
	zh: '中文',
	ja: '日本語',
}

export function LanguageSwitcher() {
	const { locale, setLocale } = useLocale()

	return (
		<Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
			<SelectTrigger className="w-[130px] h-8 text-xs">
				<Globe className="h-3.5 w-3.5 mr-1.5 opacity-60" />
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{Object.entries(LOCALE_LABELS).map(([key, label]) => (
					<SelectItem key={key} value={key}>
						{label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
