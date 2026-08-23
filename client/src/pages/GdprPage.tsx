import { useState } from "react";
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
import { Download, Trash2, Shield, FileText, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type DeleteRequest = {
  id: number;
  userId: number;
  daycareId: number | null;
  status: string;
  reason: string | null;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
};

export default function GdprPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: deleteRequests, isLoading: loadingRequests } = useQuery<DeleteRequest[]>({
    queryKey: ['/api/gdpr/my-delete-requests'],
    enabled: user?.role === 'guardian',
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/gdpr/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Export failed');
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: t('success'),
        description: t('dataExportedSuccessfully'),
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('exportFailed'),
        variant: "destructive",
      });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (reason: string) => {
      return apiRequest('POST', '/api/gdpr/delete-request', { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/my-delete-requests'] });
      setShowDeleteDialog(false);
      setDeleteReason("");
      toast({
        title: t('success'),
        description: t('deleteRequestSubmitted'),
      });
    },
    onError: () => {
      toast({
        title: t('error'),
        description: t('deleteRequestFailed'),
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

  const hasPendingRequest = deleteRequests?.some(r => r.status === 'pending');

  if (user?.role !== 'guardian') {
    return (
      <div className="flex items-center justify-center h-64" data-testid="gdpr-access-denied">
        <Card className="max-w-md">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p>{t('accessDenied')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="gdpr-page">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('gdprSettings')}</h1>
          <p className="text-muted-foreground">{t('gdprDescription')}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-data-export">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('exportMyData')}
            </CardTitle>
            <CardDescription>{t('exportDataDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('exportDataDetails')}
            </p>
            <Button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              data-testid="button-export-data"
            >
              <Download className="h-4 w-4 mr-2" />
              {exportMutation.isPending ? t('exporting') : t('downloadData')}
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-delete-request">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {t('requestDataDeletion')}
            </CardTitle>
            <CardDescription>{t('deleteDataDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('deleteDataDetails')}
            </p>
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={hasPendingRequest}
                  data-testid="button-request-deletion"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {hasPendingRequest ? t('pendingRequestExists') : t('requestDeletion')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('confirmDeleteRequest')}</DialogTitle>
                  <DialogDescription>{t('confirmDeleteRequestDescription')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">{t('reason')} ({t('optional')})</Label>
                    <Textarea
                      id="reason"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder={t('deleteReasonPlaceholder')}
                      data-testid="input-delete-reason"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteRequestMutation.mutate(deleteReason)}
                    disabled={deleteRequestMutation.isPending}
                    data-testid="button-confirm-deletion"
                  >
                    {deleteRequestMutation.isPending ? t('submitting') : t('submitRequest')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-delete-requests-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('myDeleteRequests')}
          </CardTitle>
          <CardDescription>{t('deleteRequestsHistory')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRequests ? (
            <div className="text-center py-4 text-muted-foreground">{t('loading')}</div>
          ) : !deleteRequests?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noDeleteRequests')}
            </div>
          ) : (
            <div className="space-y-3">
              {deleteRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="p-4 rounded-lg border bg-card"
                  data-testid={`delete-request-${request.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </span>
                    {getStatusBadge(request.status)}
                  </div>
                  {request.reason && (
                    <p className="text-sm mb-2">
                      <span className="font-medium">{t('reason')}:</span> {request.reason}
                    </p>
                  )}
                  {request.adminNote && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">{t('adminNote')}:</span> {request.adminNote}
                    </p>
                  )}
                  {request.processedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('processedOn')}: {formatDate(request.processedAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
