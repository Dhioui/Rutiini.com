import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const languages = [
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'so', name: 'Somali', flag: '🇸🇴' },
];

export function LanguageToggle() {
  const { i18n } = useTranslation();

  // Only changes the language. `<html lang>` and `<html dir>` follow from
  // i18next's languageChanged event, wired up in i18n.ts, so they are also right
  // on a reload -- which is when the saved language is restored without anyone
  // touching this menu.
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          data-testid="button-language-toggle"
          aria-label={`Change language. Current: ${currentLanguage.name}`}
        >
          <Languages className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Language options">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={i18n.language === lang.code ? 'bg-accent' : ''}
            data-testid={`menu-item-${lang.code}`}
            aria-current={i18n.language === lang.code ? 'true' : undefined}
          >
            <span className="mr-2" aria-hidden="true">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
