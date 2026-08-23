import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Baby, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import type { Child, Entry } from '@shared/schema';

export function ChildrenPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [groupId, setGroupId] = useState('');

  const { data: children, isLoading } = useQuery<Child[]>({
    queryKey: ['/api/children'],
  });

  const addChildMutation = useMutation({
    mutationFn: async (data: { name: string; birthdate: string; groupId: number | null }) => {
      return await apiRequest('POST', '/api/children', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/children'] });
      setIsAddDialogOpen(false);
      setName('');
      setBirthdate('');
      setGroupId('');
      toast({
        title: t('success'),
        description: t('childName') + ' ' + t('save'),
      });
    },
  });

  const deleteChildMutation = useMutation({
    mutationFn: async (childId: number) => {
      return await apiRequest('DELETE', `/api/children/${childId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/children'] });
      toast({
        title: t('success'),
        description: t('childDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToDeleteChild'),
        variant: 'destructive',
      });
    },
  });

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault();
    addChildMutation.mutate({
      name,
      birthdate,
      groupId: groupId ? parseInt(groupId) : null,
    });
  };

  const calculateAge = (birthdate: string) => {
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const canAddChildren = user?.role === 'daycareleader' || user?.role === 'staff' || user?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {user?.role === 'guardian' ? t('myChildren') : t('children')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {children?.length || 0} {t('children').toLowerCase()}
          </p>
        </div>
        {canAddChildren && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-child">
                <Plus className="mr-2 h-4 w-4" />
                {t('addChild')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('addChild')}</DialogTitle>
                <DialogDescription>
                  {t('addChild')}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddChild} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('childName')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="input-child-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthdate">{t('birthdate')}</Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    required
                    data-testid="input-child-birthdate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupId">{t('group')}</Label>
                  <Input
                    id="groupId"
                    type="number"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    placeholder={t('optional')}
                    data-testid="input-child-group"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addChildMutation.isPending}
                  data-testid="button-submit-child"
                >
                  {addChildMutation.isPending ? t('loading') : t('save')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-md">
              <CardHeader>
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : children && children.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="list-children">
          {children.map((child) => (
            <Card 
              key={child.id} 
              className="border-0 shadow-md hover-elevate cursor-pointer transition-all"
              onClick={() => setLocation(`/children/${child.id}`)}
              data-testid={`card-child-${child.id}`}
            >
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 ring-2 ring-primary/20" data-testid={`avatar-child-${child.id}`}>
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {getInitials(child.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-child-name-${child.id}`}>{child.name}</CardTitle>
                    <CardDescription data-testid={`text-child-age-${child.id}`}>
                      {calculateAge(child.birthdate)} {t('age').toLowerCase()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2">
                  {child.groupId && (
                    <Badge variant="secondary" data-testid={`badge-child-group-${child.id}`}>
                      {t('group')} {child.groupId}
                    </Badge>
                  )}
                  <div className="flex gap-1 ml-auto">
                    <Button variant="ghost" size="sm" data-testid={`button-view-child-${child.id}`}>
                      {t('viewDetails')}
                    </Button>
                    {canAddChildren && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChildMutation.mutate(child.id);
                        }}
                        disabled={deleteChildMutation.isPending}
                        data-testid={`button-delete-child-${child.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-md" data-testid="card-no-children">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Baby className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('noChildren')}</p>
            {canAddChildren && (
              <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-child">
                <Plus className="mr-2 h-4 w-4" />
                {t('addChild')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
