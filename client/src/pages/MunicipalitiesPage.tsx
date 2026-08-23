import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Building2, Plus, Pencil, Trash2, Globe, Settings, Building } from 'lucide-react';

interface Municipality {
  id: number;
  name: string;
  code: string;
  defaultMenuSourceType: string;
  defaultMenuSourceUrl: string | null;
  contactEmail: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Daycare {
  id: number;
  name: string;
  code: string;
  municipalityId: number | null;
  municipality: string | null;
}

const municipalityFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').max(10, 'Code must be 10 characters or less'),
  defaultMenuSourceType: z.enum(['none', 'aromi', 'manual']),
  defaultMenuSourceUrl: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  isActive: z.boolean(),
});

type MunicipalityFormData = z.infer<typeof municipalityFormSchema>;

export function MunicipalitiesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingMunicipality, setEditingMunicipality] = useState<Municipality | null>(null);
  const [viewDaycaresFor, setViewDaycaresFor] = useState<Municipality | null>(null);

  const { data: allMunicipalities = [], isLoading } = useQuery<Municipality[]>({
    queryKey: ['/api/municipalities'],
  });

  const { data: municipalityDaycares = [], isLoading: isDaycaresLoading } = useQuery<Daycare[]>({
    queryKey: ['/api/municipalities', viewDaycaresFor?.id, 'daycares'],
    enabled: !!viewDaycaresFor,
  });

  const createForm = useForm<MunicipalityFormData>({
    resolver: zodResolver(municipalityFormSchema),
    defaultValues: {
      name: '',
      code: '',
      defaultMenuSourceType: 'none',
      defaultMenuSourceUrl: '',
      contactEmail: '',
      isActive: true,
    },
  });

  const editForm = useForm<MunicipalityFormData>({
    resolver: zodResolver(municipalityFormSchema),
    defaultValues: {
      name: '',
      code: '',
      defaultMenuSourceType: 'none',
      defaultMenuSourceUrl: '',
      contactEmail: '',
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MunicipalityFormData) => {
      return apiRequest('POST', '/api/municipalities', {
        ...data,
        contactEmail: data.contactEmail || undefined,
        defaultMenuSourceUrl: data.defaultMenuSourceUrl || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/municipalities'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: t('success'),
        description: t('municipalityCreated'),
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('failedToCreateMunicipality'),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MunicipalityFormData> }) => {
      return apiRequest('PATCH', `/api/municipalities/${id}`, {
        ...data,
        contactEmail: data.contactEmail || undefined,
        defaultMenuSourceUrl: data.defaultMenuSourceUrl || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/municipalities'] });
      setEditingMunicipality(null);
      toast({
        title: t('success'),
        description: t('municipalityUpdated'),
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('failedToUpdateMunicipality'),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/municipalities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/municipalities'] });
      toast({
        title: t('success'),
        description: t('municipalityDeleted'),
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('failedToDeleteMunicipality'),
      });
    },
  });

  const handleCreateSubmit = (data: MunicipalityFormData) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: MunicipalityFormData) => {
    if (editingMunicipality) {
      updateMutation.mutate({ id: editingMunicipality.id, data });
    }
  };

  const openEditDialog = (municipality: Municipality) => {
    setEditingMunicipality(municipality);
    editForm.reset({
      name: municipality.name,
      code: municipality.code,
      defaultMenuSourceType: municipality.defaultMenuSourceType as 'none' | 'aromi' | 'manual',
      defaultMenuSourceUrl: municipality.defaultMenuSourceUrl || '',
      contactEmail: municipality.contactEmail || '',
      isActive: municipality.isActive,
    });
  };

  if (isLoading) {
    return <div className="p-8">{t('loading')}</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">{t('municipalities')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('manageMunicipalitiesDescription')}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-municipality">
              <Plus className="h-4 w-4 mr-2" />
              {t('addMunicipality')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{t('addMunicipality')}</DialogTitle>
              <DialogDescription>{t('addMunicipalityDescription')}</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('name')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Helsinki" {...field} data-testid="input-municipality-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('code')}</FormLabel>
                      <FormControl>
                        <Input placeholder="HEL" {...field} data-testid="input-municipality-code" />
                      </FormControl>
                      <FormDescription>{t('municipalityCodeDescription')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="defaultMenuSourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('defaultMenuSource')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-menu-source-type">
                            <SelectValue placeholder={t('selectMenuSource')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t('noMenuSource')}</SelectItem>
                          <SelectItem value="aromi">{t('aromiMenuSource')}</SelectItem>
                          <SelectItem value="manual">{t('manualMenuSource')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="defaultMenuSourceUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('defaultMenuUrl')}</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} data-testid="input-menu-source-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('contactEmail')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@municipality.fi" {...field} data-testid="input-contact-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t('active')}</FormLabel>
                        <FormDescription>{t('municipalityActiveDescription')}</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-is-active" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-municipality">
                    {createMutation.isPending ? t('saving') : t('save')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('municipalities')}
          </CardTitle>
          <CardDescription>
            {t('municipalitiesListDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allMunicipalities.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('code')}</TableHead>
                    <TableHead>{t('menuSource')}</TableHead>
                    <TableHead>{t('contactEmail')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMunicipalities.map((municipality) => (
                    <TableRow key={municipality.id} data-testid={`row-municipality-${municipality.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {municipality.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{municipality.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={municipality.defaultMenuSourceType === 'none' ? 'secondary' : 'default'}>
                          {municipality.defaultMenuSourceType === 'none' && t('noMenuSource')}
                          {municipality.defaultMenuSourceType === 'aromi' && t('aromi')}
                          {municipality.defaultMenuSourceType === 'manual' && t('manual')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {municipality.contactEmail || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={municipality.isActive ? 'default' : 'secondary'}>
                          {municipality.isActive ? t('active') : t('inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewDaycaresFor(municipality)}
                            data-testid={`button-view-daycares-${municipality.id}`}
                          >
                            <Building className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(municipality)}
                            data-testid={`button-edit-municipality-${municipality.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-municipality-${municipality.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('confirmDeleteMunicipalityDescription', { name: municipality.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(municipality.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  {t('delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('noMunicipalities')}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingMunicipality} onOpenChange={(open) => !open && setEditingMunicipality(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('editMunicipality')}</DialogTitle>
            <DialogDescription>{t('editMunicipalityDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-municipality-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('code')}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-municipality-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="defaultMenuSourceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('defaultMenuSource')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-menu-source-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t('noMenuSource')}</SelectItem>
                        <SelectItem value="aromi">{t('aromiMenuSource')}</SelectItem>
                        <SelectItem value="manual">{t('manualMenuSource')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="defaultMenuSourceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('defaultMenuUrl')}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-menu-source-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contactEmail')}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-edit-contact-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>{t('active')}</FormLabel>
                      <FormDescription>{t('municipalityActiveDescription')}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-is-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-municipality">
                  {updateMutation.isPending ? t('saving') : t('save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewDaycaresFor} onOpenChange={(open) => !open && setViewDaycaresFor(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('daycaresInMunicipality', { name: viewDaycaresFor?.name })}</DialogTitle>
            <DialogDescription>{t('daycaresInMunicipalityDescription')}</DialogDescription>
          </DialogHeader>
          {isDaycaresLoading ? (
            <div className="py-8 text-center">{t('loading')}</div>
          ) : municipalityDaycares.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('code')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {municipalityDaycares.map((daycare) => (
                    <TableRow key={daycare.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-primary" />
                          {daycare.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{daycare.code}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              {t('noDaycaresInMunicipality')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
