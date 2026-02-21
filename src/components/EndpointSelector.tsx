import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useLocale } from '@/lib/i18n'
import type { Endpoint } from '@/lib/types'

interface Props {
	endpoints: Endpoint[]
	selectedId: string
	onChange: (id: string) => void
}

export function EndpointSelector({ endpoints, selectedId, onChange }: Props) {
	const { t } = useLocale()
	const enabled = endpoints.filter((e) => e.enabled)

	if (enabled.length === 0) {
		return <span className="text-xs text-muted-foreground italic">{t('popup.noEndpoints')}</span>
	}

	return (
		<Select value={selectedId} onValueChange={onChange}>
			<SelectTrigger className="h-8 text-xs">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{enabled.map((ep) => (
					<SelectItem key={ep.id} value={ep.id}>
						{ep.name || t('endpoints.unnamed')}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
