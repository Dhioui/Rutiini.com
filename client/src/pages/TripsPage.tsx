import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Bus, MapPin, Calendar, DollarSign, Check, X, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Trip, TripResponse, Child } from '@shared/schema';

export function TripsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('0');
  const [groupId, setGroupId] = useState('');

  const { data: trips, isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ['/api/trips'],
  });

  const { data: tripResponses } = useQuery<TripResponse[]>({
    queryKey: ['/api/trip-responses'],
    enabled: user?.role === 'guardian' || user?.role === 'super_admin',
  });

  const { data: children } = useQuery<Child[]>({
    queryKey: ['/api/children'],
    enabled: user?.role === 'guardian' || user?.role === 'super_admin',
  });

  const createTripMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; date: string; location: string; cost: number; createdBy: number; groupId: number | null }) => {
      return await apiRequest('POST', '/api/trips', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      setIsCreateDialogOpen(false);
      setTitle('');
      setDescription('');
      setDate('');
      setLocation('');
      setCost('0');
      setGroupId('');
      toast({
        title: t('success'),
        description: t('tripCreated'),
      });
    },
  });

  const respondToTripMutation = useMutation({
    mutationFn: async (data: { tripId: number; guardianId: number; childId: number; response: string }) => {
      return await apiRequest('POST', `/api/trips/${data.tripId}/respond`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trip-responses'] });
      toast({
        title: t('success'),
        description: t('responseSubmitted'),
      });
    },
  });

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      return await apiRequest('DELETE', `/api/trips/${tripId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: t('success'),
        description: t('tripDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToDeleteTrip'),
        variant: 'destructive',
      });
    },
  });

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    createTripMutation.mutate({
      title,
      description,
      date,
      location,
      cost: parseInt(cost),
      createdBy: user.id,
      groupId: groupId ? parseInt(groupId) : null,
    });
  };

  const handleRespond = (tripId: number, childId: number, response: 'approved' | 'declined') => {
    if (!user) return;
    
    respondToTripMutation.mutate({
      tripId,
      guardianId: user.id,
      childId,
      response,
    });
  };

  const getResponseForTrip = (tripId: number, childId: number) => {
    return tripResponses?.find(r => r.tripId === tripId && r.childId === childId);
  };

  const canCreateTrip = user?.role === 'daycareleader' || user?.role === 'staff' || user?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('trips')}</h1>
          <p className="text-muted-foreground mt-1">
            {trips?.length || 0} {t('trips').toLowerCase()}
          </p>
        </div>
        {canCreateTrip && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-trip">
                <Plus className="mr-2 h-4 w-4" />
                {t('createTrip')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('createTrip')}</DialogTitle>
                <DialogDescription>
                  {t('createTrip')}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTrip} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t('tripTitle')}</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      data-testid="input-trip-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">{t('tripDate')}</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      data-testid="input-trip-date"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="location">{t('tripLocation')}</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      required
                      data-testid="input-trip-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">{t('tripCost')}</Label>
                    <Input
                      id="cost"
                      type="number"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      min="0"
                      required
                      data-testid="input-trip-cost"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groupId">{t('group')}</Label>
                  <Input
                    id="groupId"
                    type="number"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    placeholder={t('optional')}
                    data-testid="input-trip-group"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('tripDescription')}</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    required
                    data-testid="input-trip-description"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createTripMutation.isPending}
                  data-testid="button-submit-trip"
                >
                  {createTripMutation.isPending ? t('loading') : t('createTrip')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {tripsLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="border-0 shadow-md">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : trips && trips.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2" data-testid="list-trips">
          {trips.map((trip) => (
            <Card key={trip.id} className="border-0 shadow-md" data-testid={`card-trip-${trip.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2" data-testid={`text-trip-title-${trip.id}`}>
                      <Bus className="h-5 w-5 text-primary" />
                      {trip.title}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1" data-testid={`text-trip-date-${trip.id}`}>
                        <Calendar className="h-3 w-3" />
                        {format(new Date(trip.date), 'dd.MM.yyyy')}
                      </span>
                      <span className="flex items-center gap-1" data-testid={`text-trip-location-${trip.id}`}>
                        <MapPin className="h-3 w-3" />
                        {trip.location}
                      </span>
                    </CardDescription>
                  </div>
                  {trip.cost > 0 && (
                    <Badge variant="secondary" className="flex items-center gap-1" data-testid={`badge-trip-cost-${trip.id}`}>
                      <DollarSign className="h-3 w-3" />
                      {trip.cost}€
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground" data-testid={`text-trip-description-${trip.id}`}>{trip.description}</p>

                {canCreateTrip && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTripMutation.mutate(trip.id)}
                      disabled={deleteTripMutation.isPending}
                      data-testid={`button-delete-trip-${trip.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {user?.role === 'guardian' && children && (
                  <div className="space-y-2" data-testid={`list-trip-responses-${trip.id}`}>
                    {children.map((child) => {
                      const response = getResponseForTrip(trip.id, child.id);
                      return (
                        <div key={child.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3" data-testid={`card-trip-response-${trip.id}-${child.id}`}>
                          <span className="text-sm font-medium" data-testid={`text-child-name-${child.id}`}>{child.name}</span>
                          {response ? (
                            <Badge 
                              variant={response.response === 'approved' ? 'default' : 'destructive'}
                              data-testid={`badge-response-${trip.id}-${child.id}`}
                            >
                              {t(response.response)}
                            </Badge>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleRespond(trip.id, child.id, 'approved')}
                                disabled={respondToTripMutation.isPending}
                                data-testid={`button-approve-${trip.id}-${child.id}`}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                {t('approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRespond(trip.id, child.id, 'declined')}
                                disabled={respondToTripMutation.isPending}
                                data-testid={`button-decline-${trip.id}-${child.id}`}
                              >
                                <X className="h-3 w-3 mr-1" />
                                {t('decline')}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-md" data-testid="card-no-trips">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Bus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('noTrips')}</p>
            {canCreateTrip && (
              <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-trip">
                <Plus className="mr-2 h-4 w-4" />
                {t('createTrip')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
