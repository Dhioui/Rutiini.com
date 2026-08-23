import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, FileText, Bus, MessageSquare, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Notification } from '@shared/schema';
import { formatDistanceToNow, type Locale } from 'date-fns';
import { fi, enUS, sv, ar, ru } from 'date-fns/locale';

const localeMap: Record<string, Locale> = {
  fi: fi,
  en: enUS,
  sv: sv,
  ar: ar,
  ru: ru,
};

export function NotificationDropdown() {
  const { t, i18n } = useTranslation();
  const locale = localeMap[i18n.language] || fi;

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest('PATCH', '/api/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  const getNotificationIcon = (type: string) => {
    const iconClass = "h-4 w-4 text-muted-foreground";
    switch (type) {
      case 'entry':
        return <FileText className={iconClass} />;
      case 'trip':
        return <Bus className={iconClass} />;
      case 'message':
        return <MessageSquare className={iconClass} />;
      case 'absence':
        return <Calendar className={iconClass} />;
      default:
        return <Bell className={iconClass} />;
    }
  };

  const getTranslatedTitle = (notification: Notification): string => {
    const { title, type } = notification;
    
    if (type === 'entry') {
      const entryType = title.replace('entry_', '');
      return `${t(entryType)}: ${t('notificationEntry')}`;
    }
    
    if (type === 'trip') {
      return t('notificationNewTrip');
    }
    
    if (type === 'absence') {
      const absenceType = title.replace('absence_', '');
      return `${t(absenceType)}: ${t('notificationAbsence')}`;
    }
    
    if (type === 'message') {
      return t('notificationNewMessage');
    }
    
    return title;
  };

  const getTranslatedMessage = (notification: Notification): string => {
    const { message, type } = notification;
    
    try {
      const data = JSON.parse(message);
      
      if (type === 'entry') {
        return t('notificationEntryMessage', { 
          childName: data.childName, 
          entryType: t(data.entryType), 
          value: data.value 
        });
      }
      
      if (type === 'trip') {
        return t('notificationTripMessage', { 
          tripTitle: data.tripTitle, 
          tripDate: data.tripDate, 
          tripLocation: data.tripLocation 
        });
      }
      
      if (type === 'absence') {
        return t('notificationAbsenceMessage', { 
          childName: data.childName, 
          absenceType: t(data.absenceType), 
          date: data.date 
        });
      }
      
      if (type === 'message') {
        return t('notificationMessageMessage', { senderName: data.senderName });
      }
      
      return message;
    } catch {
      return message;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative" 
          data-testid="button-notifications"
          aria-label={unreadCount > 0 ? t('notificationsWithCount', { count: unreadCount }) : t('notifications')}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
              aria-hidden="true"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">
            {unreadCount > 0 ? t('notificationsWithCount', { count: unreadCount }) : t('notifications')}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" aria-label={t('notifications')}>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('notifications')}</span>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-1 text-xs"
              onClick={() => markAllAsReadMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              {t('markAllRead')}
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-64">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {t('noNotifications')}
            </div>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${!notification.read ? 'bg-muted/50' : ''}`}
                onClick={() => {
                  if (!notification.read) {
                    markAsReadMutation.mutate(notification.id);
                  }
                }}
                data-testid={`notification-${notification.id}`}
              >
                <div className="flex items-center gap-2 w-full">
                  {getNotificationIcon(notification.type)}
                  <span className="font-medium text-sm flex-1">{getTranslatedTitle(notification)}</span>
                  {!notification.read && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
                  {getTranslatedMessage(notification)}
                </p>
                <span className="text-xs text-muted-foreground pl-6">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale })}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
