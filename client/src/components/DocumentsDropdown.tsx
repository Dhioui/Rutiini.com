import { useTranslation } from 'react-i18next';
import { Link } from 'wouter';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function DocumentsDropdown() {
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/documents">
          <Button variant="ghost" size="icon" data-testid="button-documents">
            <FileText className="h-5 w-5" />
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t('documents', 'Tiedotteet')}</p>
      </TooltipContent>
    </Tooltip>
  );
}
