import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, Shield, Filter, X, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

type AuditLog = {
  id: number;
  actorRole: string;
  daycareId: number | null;
  action: string;
  entityType: string;
  entityIdHash: string | null;
  timestamp: string;
};

export default function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  const { data: logs, isLoading, error } = useQuery<AuditLog[]>({
    queryKey: ['/api/audit-logs'],
    enabled: user?.role === 'super_admin' || user?.role === 'daycareleader',
  });

  const uniqueActions = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map(log => log.action))).sort();
  }, [logs]);

  const uniqueEntityTypes = useMemo(() => {
    if (!logs) return [];
    return Array.from(new Set(logs.map(log => log.entityType))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (entityFilter !== "all" && log.entityType !== entityFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          log.action.toLowerCase().includes(search) ||
          log.entityType.toLowerCase().includes(search) ||
          log.actorRole.toLowerCase().includes(search) ||
          (log.entityIdHash && log.entityIdHash.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [logs, actionFilter, entityFilter, searchTerm]);

  const clearFilters = () => {
    setActionFilter("all");
    setEntityFilter("all");
    setSearchTerm("");
  };

  const hasActiveFilters = actionFilter !== "all" || entityFilter !== "all" || searchTerm !== "";

  if (user?.role !== 'super_admin' && user?.role !== 'daycareleader') {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p>{t('accessDenied')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'DELETE':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'LOGIN':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'LOGOUT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'ACCESS_DENIED':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const locale = i18n.language === 'fi' ? 'fi-FI' : 
                   i18n.language === 'sv' ? 'sv-SE' :
                   i18n.language === 'ar' ? 'ar-SA' :
                   i18n.language === 'ru' ? 'ru-RU' : 'en-US';
    return new Date(timestamp).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6" data-testid="audit-logs-page">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t('auditLogs')}</h1>
          <p className="text-muted-foreground">
            {t('systemActivityLog')}
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">{t('search')}</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-logs"
                />
              </div>
            </div>
            <div className="min-w-[160px]">
              <label className="text-sm font-medium mb-1 block">{t('action')}</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger data-testid="select-action-filter">
                  <SelectValue placeholder={t('allActions')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allActions')}</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <label className="text-sm font-medium mb-1 block">{t('entityType')}</label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger data-testid="select-entity-filter">
                  <SelectValue placeholder={t('allEntities')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allEntities')}</SelectItem>
                  {uniqueEntityTypes.map(entity => (
                    <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearFilters}
                className="mb-0.5"
                data-testid="button-clear-filters"
              >
                <X className="h-4 w-4 mr-1" />
                {t('clearFilters')}
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <div className="mt-3 text-sm text-muted-foreground">
              {t('showingResults', { count: filteredLogs.length, total: logs?.length || 0 })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('auditLogs')}
          </CardTitle>
          <CardDescription>
            {t('entityIdsHashed')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-8 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              {t('error')}
            </div>
          ) : !filteredLogs?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {hasActiveFilters ? t('noMatchingLogs') : t('noAuditLogs')}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card hover-elevate"
                    data-testid={`audit-log-${log.id}`}
                  >
                    <div className="flex-shrink-0">
                      <Badge className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{log.entityType}</span>
                        {log.entityIdHash && (
                          <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
                            {log.entityIdHash.substring(0, 12)}...
                          </code>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {t('role')}: {t(log.actorRole, { defaultValue: log.actorRole })}
                        {log.daycareId && ` | ${t('daycare')}: #${log.daycareId}`}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
