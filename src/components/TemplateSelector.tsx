import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useLocale } from '@/lib/i18n'
import type { ContextBroTemplate } from '@/lib/types'

interface Props {
	templates: ContextBroTemplate[]
	selectedId: string
	onChange: (id: string) => void
}

export function TemplateSelector({ templates, selectedId, onChange }: Props) {
	const { t } = useLocale()

	return (
		<Select value={selectedId} onValueChange={onChange}>
			<SelectTrigger className="h-8 text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="default">{t('common.default')}</SelectItem>
				{templates.map((tmpl) => (
					<SelectItem key={tmpl.id} value={tmpl.id}>
						{tmpl.name || t('templates.unnamed')}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
