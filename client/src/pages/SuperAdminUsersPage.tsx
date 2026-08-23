import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Users, Plus, Building2, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Daycare } from '@shared/schema';

interface AdminInfo {
  id: number;
  name: string;
  email: string;
}

interface AdminsByDaycare {
  daycareId: number;
  daycareName: string;
  admins: AdminInfo[];
}

export function SuperAdminUsersPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [daycareId, setDaycareId] = useState<string>('');

  const { data: adminsByDaycare, isLoading: adminsLoading } = useQuery<AdminsByDaycare[]>({
    queryKey: ['/api/super-admin/admins'],
  });

  const { data: daycares, isLoading: daycaresLoading } = useQuery<Daycare[]>({
    queryKey: ['/api/daycares'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; daycareId: number }) => {
      return await apiRequest('POST', '/api/super-admin/admins', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/admins'] });
      toast({
        title: t('success'),
        description: t('adminCreated'),
      });
      setIsOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setDaycareId('');
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('emailInUse'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!daycareId) {
      toast({
        title: t('error'),
        description: t('selectDaycare'),
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ 
      name, 
      email, 
      password, 
      daycareId: parseInt(daycareId) 
    });
  };

  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      return await apiRequest('DELETE', `/api/super-admin/admins/${adminId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/admins'] });
      toast({
        title: t('success'),
        description: t('adminDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToDeleteAdmin'),
        variant: 'destructive',
      });
    },
  });

  const handleDeleteAdmin = (adminId: number) => {
    if (confirm(t('confirmDeleteAdmin'))) {
      deleteAdminMutation.mutate(adminId);
    }
  };

  const totalAdmins = adminsByDaycare?.reduce((sum, dc) => sum + dc.admins.length, 0) || 0;

  if (adminsLoading || daycaresLoading) {
    return <div className="p-8">{t('loading')}</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">{t('adminManagement')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('manageDescription')}. {t('gdprNote')}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-admin">
              <Plus className="mr-2 h-4 w-4" />
              {t('addAdmin')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('addAdmin')}</DialogTitle>
              <DialogDescription>
                {t('createAdminDescription')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('name')}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('adminNamePlaceholder')}
                  required
                  data-testid="input-admin-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@daycare.fi"
                  required
                  data-testid="input-admin-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('temporaryPassword')}
                  required
                  minLength={6}
                  data-testid="input-admin-password"
                />
                <p className="text-sm text-muted-foreground">
                  {t('adminWillChangePassword')}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="daycare">{t('daycare')}</Label>
                <Select value={daycareId} onValueChange={setDaycareId}>
                  <SelectTrigger data-testid="select-admin-daycare">
                    <SelectValue placeholder={t('selectDaycare')} />
                  </SelectTrigger>
                  <SelectContent>
                    {daycares?.map((daycare) => (
                      <SelectItem key={daycare.id} value={daycare.id.toString()}>
                        {daycare.name} ({daycare.code.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-admin">
                  {createMutation.isPending ? t('creating') : t('save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="border-0 shadow-md" data-testid="card-admin-count">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalAdmins')}</CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-admin-count">{totalAdmins}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md" data-testid="card-daycare-count">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">{t('totalDaycares')}</CardTitle>
            <div className="rounded-full bg-blue-500/10 p-2">
              <Building2 className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-daycare-count">{daycares?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md" data-testid="card-admins-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t('adminsByDaycare')}
          </CardTitle>
          <CardDescription>
            {t('adminsByDaycareDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adminsByDaycare && adminsByDaycare.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {adminsByDaycare.map((dc) => (
                <AccordionItem key={dc.daycareId} value={`daycare-${dc.daycareId}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{dc.daycareName}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({dc.admins.length} {t('adminsCount')})
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {dc.admins.length > 0 ? (
                      <div className="space-y-2 pl-8">
                        {dc.admins.map((admin) => (
                          <div 
                            key={admin.id} 
                            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50"
                            data-testid={`admin-${admin.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{admin.name}</div>
                                <div className="text-sm text-muted-foreground">{admin.email}</div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAdmin(admin.id)}
                              disabled={deleteAdminMutation.isPending}
                              data-testid={`button-delete-admin-${admin.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground pl-8 py-2">
                        {t('noAdmins')}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('noDaycaresCreate')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
