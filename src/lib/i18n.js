import { useCallback } from 'react'
import { useData } from '../context/DataContext'
import es from './locales/es.js'
import fr from './locales/fr.js'

/**
 * The portal language chosen in Account & Settings → Portal. English text is
 * its own key: `t('My courses')` returns the translation, or the English when
 * a phrase has none. Navigation, signing in and the learner's pages are
 * translated; the administration pages are in English.
 */
const DICTIONARIES = { Spanish: es, French: fr }

export const LANGUAGES = ['English (US)', 'Spanish', 'French']

export function useT() {
  const { settings } = useData()
  const dict = DICTIONARIES[settings?.language]
  return useCallback((text) => (dict && dict[text]) || text, [dict])
}
