import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Trash2, Shield, Clock, CheckCircle, XCircle, AlertCircle, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

type DeleteRequest = {
  id: number;
  userId: number;
  daycareId: number | null;
  status: string;
  reason: string | null;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
};

export default function DeleteRequestsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<DeleteRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionType, setActionType] = useState<'approve' | 'deny' | null>(null);

  const { data: requests, isLoading } = useQuery<DeleteRequest[]>({
    queryKey: ['/api/gdpr/delete-requests'],
    enabled: user?.role === 'daycareleader' || user?.role === 'staff',
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote: string }) => {
      return apiRequest('PATCH', `/api/gdpr/delete-requests/${id}`, { status, adminNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/delete-requests'] });
      setSelectedRequest(null);
      setAdminNote("");
      setActionType(null);
      toast({
        title: t('success'),
        description: t('requestUpdated'),
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('updateFailed'),
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    const locale = i18n.language === 'fi' ? 'fi-FI' : 
                   i18n.language === 'sv' ? 'sv-SE' :
                   i18n.language === 'ar' ? 'ar-SA' :
                   i18n.language === 'ru' ? 'ru-RU' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="h-3 w-3 mr-1" />{t('pending')}</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="h-3 w-3 mr-1" />{t('approved')}</Badge>;
      case 'denied':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="h-3 w-3 mr-1" />{t('denied')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleAction = (request: DeleteRequest, action: 'approve' | 'deny') => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNote("");
  };

  const confirmAction = () => {
    if (!selectedRequest || !actionType) return;
    updateMutation.mutate({
      id: selectedRequest.id,
      status: actionType === 'approve' ? 'approved' : 'denied',
      adminNote,
    });
  };

  if (user?.role !== 'daycareleader' && user?.role !== 'staff') {
    return (
      <div className="flex items-center justify-center h-64" data-testid="delete-requests-access-denied">
        <Card className="max-w-md">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p>{t('accessDenied')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const processedRequests = requests?.filter(r => r.status !== 'pending') || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="delete-requests-page">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('deleteRequests')}</h1>
          <p className="text-muted-foreground">{t('manageDeleteRequests')}</p>
        </div>
      </div>

      <Card data-testid="card-pending-requests">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            {t('pendingRequests')} ({pendingRequests.length})
          </CardTitle>
          <CardDescription>{t('pendingRequestsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">{t('loading')}</div>
          ) : !pendingRequests.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noPendingRequests')}
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="p-4 rounded-lg border bg-card"
                  data-testid={`pending-request-${request.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.userName}</span>
                        <span className="text-sm text-muted-foreground">({request.userEmail})</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('requestedOn')}: {formatDate(request.createdAt)}
                      </p>
                      {request.reason && (
                        <p className="text-sm">
                          <span className="font-medium">{t('reason')}:</span> {request.reason}
                        </p>
                      )}
                    </div>
                    {user?.role === 'daycareleader' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => handleAction(request, 'approve')}
                          data-testid={`button-approve-${request.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {t('approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleAction(request, 'deny')}
                          data-testid={`button-deny-${request.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {t('deny')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {processedRequests.length > 0 && (
        <Card data-testid="card-processed-requests">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {t('processedRequests')} ({processedRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processedRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="p-4 rounded-lg border bg-card"
                  data-testid={`processed-request-${request.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{request.userName}</span>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('requestedOn')}: {formatDate(request.createdAt)}
                    {request.processedAt && ` | ${t('processedOn')}: ${formatDate(request.processedAt)}`}
                  </p>
                  {request.adminNote && (
                    <p className="text-sm mt-2">
                      <span className="font-medium">{t('adminNote')}:</span> {request.adminNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => { setSelectedRequest(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? t('approveRequest') : t('denyRequest')}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' ? t('approveRequestDescription') : t('denyRequestDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded bg-muted">
              <p className="font-medium">{selectedRequest?.userName}</p>
              <p className="text-sm text-muted-foreground">{selectedRequest?.userEmail}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminNote">{t('adminNote')} ({t('optional')})</Label>
              <Textarea
                id="adminNote"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={t('adminNotePlaceholder')}
                data-testid="input-admin-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRequest(null); setActionType(null); }}>
              {t('cancel')}
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={confirmAction}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-action"
            >
              {updateMutation.isPending ? t('processing') : (actionType === 'approve' ? t('approve') : t('deny'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
