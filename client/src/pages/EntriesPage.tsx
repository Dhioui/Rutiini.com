import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Moon, Utensils, Palette, AlertTriangle, Zap, Smile, TreePine, BatteryLow } from 'lucide-react';
import type { Child } from '@shared/schema';

export function EntriesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [childId, setChildId] = useState('');
  const [type, setType] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const { data: children } = useQuery<Child[]>({
    queryKey: ['/api/children'],
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: { childId: number; type: string; value: string; note: string; staffId: number }) => {
      return await apiRequest('POST', '/api/entries', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entries'] });
      setChildId('');
      setType('');
      setValue('');
      setNote('');
      toast({
        title: t('success'),
        description: t('entryCreated'),
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    createEntryMutation.mutate({
      childId: parseInt(childId),
      type,
      value,
      note,
      staffId: user.id,
    });
  };

  const entryTypes = [
    { value: 'sleep', label: t('sleep') },
    { value: 'meal', label: t('meal') },
    { value: 'play', label: t('play') },
    { value: 'incident', label: t('incident') },
  ];

  // Quick entry presets for one-click recording (all use valid schema types: sleep, meal, play, incident)
  const quickEntries = [
    { type: 'meal', value: t('ateWell'), icon: Utensils, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { type: 'sleep', value: t('isNapping'), icon: Moon, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { type: 'play', value: t('playingOutside'), icon: TreePine, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
    { type: 'play', value: t('happyMood'), icon: Smile, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
    { type: 'play', value: t('tiredMood'), icon: BatteryLow, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  ];

  const handleQuickEntry = (entry: { type: string; value: string }) => {
    if (!childId || !user) {
      toast({
        title: t('error'),
        description: t('selectChildFirst'),
        variant: 'destructive',
      });
      return;
    }
    
    createEntryMutation.mutate({
      childId: parseInt(childId),
      type: entry.type,
      value: entry.value,
      note: '',
      staffId: user.id,
    });
  };

  const getEntryTypeIcon = (value: string) => {
    const iconClass = "h-4 w-4";
    switch (value) {
      case 'sleep':
        return <Moon className={`${iconClass} text-blue-500`} />;
      case 'meal':
        return <Utensils className={`${iconClass} text-green-500`} />;
      case 'play':
        return <Palette className={`${iconClass} text-purple-500`} />;
      case 'incident':
        return <AlertTriangle className={`${iconClass} text-orange-500`} />;
      default:
        return null;
    }
  };

  const canCreateEntry = user?.role === 'daycareleader' || user?.role === 'staff' || user?.role === 'super_admin';

  if (!canCreateEntry) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t('error')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">{t('createEntry')}</h1>
        <p className="text-muted-foreground mt-1">{t('addEntry')}</p>
      </div>

      {/* Quick Entries Section */}
      <Card className="border-0 shadow-md" data-testid="card-quick-entries">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {t('quickEntries')}
          </CardTitle>
          <CardDescription>{t('quickEntriesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Child selector for quick entries */}
          <div className="mb-4">
            <Label htmlFor="quick-child" className="text-sm font-medium">{t('childName')}</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger id="quick-child" className="mt-1" data-testid="select-quick-child">
                <SelectValue placeholder={t('selectChildFirst')} />
              </SelectTrigger>
              <SelectContent>
                {children?.map((child) => (
                  <SelectItem key={child.id} value={child.id.toString()} data-testid={`quick-option-child-${child.id}`}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Quick entry buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickEntries.map((entry, index) => {
              const IconComponent = entry.icon;
              return (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-2 hover-elevate"
                  onClick={() => handleQuickEntry(entry)}
                  disabled={createEntryMutation.isPending || !childId}
                  data-testid={`button-quick-${entry.type}-${index}`}
                >
                  <div className={`rounded-full p-2 ${entry.bgColor}`}>
                    <IconComponent className={`h-5 w-5 ${entry.color}`} />
                  </div>
                  <span className="text-sm font-medium text-center">{entry.value}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md" data-testid="card-create-entry">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            {t('createEntry')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="child">{t('childName')}</Label>
              <Select value={childId} onValueChange={setChildId} required>
                <SelectTrigger id="child" data-testid="select-child">
                  <SelectValue placeholder={t('childName')} />
                </SelectTrigger>
                <SelectContent>
                  {children?.map((child) => (
                    <SelectItem key={child.id} value={child.id.toString()} data-testid={`option-child-${child.id}`}>
                      {child.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">{t('entryType')}</Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger id="type" data-testid="select-entry-type">
                  <SelectValue placeholder={t('entryType')} />
                </SelectTrigger>
                <SelectContent>
                  {entryTypes.map((entryType) => (
                    <SelectItem key={entryType.value} value={entryType.value} data-testid={`option-type-${entryType.value}`}>
                      <span className="flex items-center gap-2">
                        {getEntryTypeIcon(entryType.value)}
                        <span>{entryType.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">{t('value')}</Label>
              <Input
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t('value')}
                required
                data-testid="input-entry-value"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">{t('note')}</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('note')}
                rows={4}
                data-testid="input-entry-note"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={createEntryMutation.isPending}
              data-testid="button-create-entry"
            >
              {createEntryMutation.isPending ? t('loading') : t('createEntry')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {type && (
        <Card className="border-0 shadow-md bg-muted/50" data-testid="card-entry-preview">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {type === 'sleep' && <div className="rounded-full bg-blue-500/10 p-3"><Moon className="h-6 w-6 text-blue-500" /></div>}
              {type === 'meal' && <div className="rounded-full bg-green-500/10 p-3"><Utensils className="h-6 w-6 text-green-500" /></div>}
              {type === 'play' && <div className="rounded-full bg-purple-500/10 p-3"><Palette className="h-6 w-6 text-purple-500" /></div>}
              {type === 'incident' && <div className="rounded-full bg-orange-500/10 p-3"><AlertTriangle className="h-6 w-6 text-orange-500" /></div>}
              <div>
                <p className="font-medium text-sm text-muted-foreground">{t('entryType')}</p>
                <Badge variant="secondary" data-testid="badge-entry-type">{t(type)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
