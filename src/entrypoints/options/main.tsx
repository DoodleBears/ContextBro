import ReactDOM from 'react-dom/client'
import { LocaleProvider } from '@/lib/i18n'
import App from './App'

const root = document.getElementById('root')
if (root) {
	ReactDOM.createRoot(root).render(
		<LocaleProvider>
			<App />
		</LocaleProvider>,
	)
}
