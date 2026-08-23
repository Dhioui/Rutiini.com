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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Document {
  id: number;
  daycareId: number;
  title: string;
  content: string;
  type: string;
  fileUrl: string | null;
  publishedById: number;
  publishedAt: string;
  publishedByName?: string;
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ['/api/documents', selectedType],
    queryFn: async () => {
      const url = selectedType !== 'all' 
        ? `/api/documents?type=${selectedType}`
        : '/api/documents';
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(url, { headers, credentials: 'include' });
      if (!res.ok) {
        const text = await res.text() || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; type: string; fileUrl?: string }) => {
      return await apiRequest('POST', '/api/documents', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setIsCreateDialogOpen(false);
      setTitle('');
      setContent('');
      setType('');
      setFileUrl('');
      toast({
        title: t('success'),
        description: t('documentCreated'),
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: number) => {
      return await apiRequest('DELETE', `/api/documents/${docId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: t('success'),
        description: t('documentDeleted'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToDeleteDocument'),
        variant: 'destructive',
      });
    },
  });

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const documentData: { title: string; content: string; type: string; fileUrl?: string } = {
      title,
      content,
      type,
    };

    if (fileUrl) {
      documentData.fileUrl = fileUrl;
    }

    createDocumentMutation.mutate(documentData);
  };

  const documentTypes = [
    { value: 'announcement', label: t('announcement') },
    { value: 'general', label: t('general') },
  ];

  const getDocumentTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'announcement':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const filteredDocuments = documents;

  const canCreateDocument = user?.role === 'daycareleader' || user?.role === 'staff' || user?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('documents')}</h1>
          <p className="text-muted-foreground mt-1">{filteredDocuments?.length || 0} {t('documents').toLowerCase()}</p>
        </div>
        {canCreateDocument && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-document">
                <Plus className="mr-2 h-4 w-4" />
                {t('addDocument')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('addDocument')}</DialogTitle>
                <DialogDescription>{t('addDocument')}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateDocument} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t('documentTitle')}</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('documentTitle')}
                    required
                    data-testid="input-document-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">{t('documentType')}</Label>
                  <Select value={type} onValueChange={setType} required>
                    <SelectTrigger id="type" data-testid="select-document-type">
                      <SelectValue placeholder={t('selectDocumentType')} />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((docType) => (
                        <SelectItem key={docType.value} value={docType.value}>
                          {docType.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">{t('documentContent')}</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('documentContent')}
                    rows={8}
                    required
                    data-testid="textarea-document-content"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fileUrl">{t('fileUrl')} ({t('optional')})</Label>
                  <Input
                    id="fileUrl"
                    type="url"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://..."
                    data-testid="input-document-fileurl"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={createDocumentMutation.isPending} data-testid="button-publish-document">
                    {createDocumentMutation.isPending ? t('loading') : t('addDocument')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-document"
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-documents">{t('allDocuments')}</TabsTrigger>
          <TabsTrigger value="announcement" data-testid="tab-announcements">{t('announcements')}</TabsTrigger>
          <TabsTrigger value="general" data-testid="tab-general">{t('general')}</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedType} className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-0 shadow-md">
                  <CardHeader>
                    <Skeleton className="h-6 w-64" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments && filteredDocuments.length > 0 ? (
            <div className="space-y-4" data-testid="list-documents">
              {filteredDocuments.map((doc) => {
                const isExpanded = expandedDocId === doc.id;
                return (
                  <Card key={doc.id} className="border-0 shadow-md" data-testid={`card-document-${doc.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-xl" data-testid={`text-document-title-${doc.id}`}>
                              {doc.title}
                            </CardTitle>
                            <Badge variant={getDocumentTypeBadgeVariant(doc.type)} data-testid={`badge-document-type-${doc.id}`}>
                              {documentTypes.find((t) => t.value === doc.type)?.label || doc.type}
                            </Badge>
                          </div>
                          <CardDescription>
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                              {doc.publishedByName && (
                                <span data-testid={`text-published-by-${doc.id}`}>
                                  {t('publishedBy')}: {doc.publishedByName}
                                </span>
                              )}
                              <span data-testid={`text-published-at-${doc.id}`}>
                                {format(new Date(doc.publishedAt), 'PP')}
                              </span>
                            </div>
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                            data-testid={`button-toggle-document-${doc.id}`}
                          >
                            {isExpanded ? t('collapse') : t('expand')}
                          </Button>
                          {canCreateDocument && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteDocumentMutation.mutate(doc.id)}
                              disabled={deleteDocumentMutation.isPending}
                              data-testid={`button-delete-document-${doc.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`text-sm ${isExpanded ? '' : 'line-clamp-2'}`}
                        data-testid={`text-document-content-${doc.id}`}
                      >
                        {doc.content}
                      </p>
                      {doc.fileUrl && (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline mt-2 inline-block"
                          data-testid={`link-document-file-${doc.id}`}
                        >
                          {t('viewFile')}
                        </a>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-0 shadow-md" data-testid="card-no-documents">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground" data-testid="text-no-documents">{t('noDocuments')}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DocumentsPage;
