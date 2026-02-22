import { Monitor, Moon, Sun } from 'lucide-react'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useLocale } from '@/lib/i18n'
import type { Theme } from '@/lib/theme'

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
	{ value: 'system', icon: Monitor, labelKey: 'general.themeSystem' },
	{ value: 'light', icon: Sun, labelKey: 'general.themeLight' },
	{ value: 'dark', icon: Moon, labelKey: 'general.themeDark' },
]

interface Props {
	theme: Theme
	onChange: (theme: Theme) => void
}

export function ThemeSwitcher({ theme, onChange }: Props) {
	const { t } = useLocale()

	const currentOption = THEME_OPTIONS.find((o) => o.value === theme) || THEME_OPTIONS[0]
	const Icon = currentOption.icon

	return (
		<Select value={theme} onValueChange={(v) => onChange(v as Theme)}>
			<SelectTrigger className="w-[130px] h-8 text-xs">
				<Icon className="h-3.5 w-3.5 mr-1.5 opacity-60" />
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{THEME_OPTIONS.map((opt) => (
					<SelectItem key={opt.value} value={opt.value}>
						{t(opt.labelKey)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
