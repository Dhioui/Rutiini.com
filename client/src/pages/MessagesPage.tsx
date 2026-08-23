import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
import type { Child } from '@shared/schema';

interface Message {
  id: number;
  daycareId: number;
  senderId: number;
  recipientId: number;
  childId: number | null;
  content: string;
  imageUrl: string | null;
  read: boolean;
  createdAt: string;
  senderName?: string;
  recipientName?: string;
  childName?: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Conversation {
  userId: number;
  userName: string;
  userRole: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export function MessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [childId, setChildId] = useState('');
  const [content, setContent] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages'],
  });

  const { data: conversation, isLoading: conversationLoading } = useQuery<Message[]>({
    queryKey: ['/api/conversations', selectedUserId],
    enabled: selectedUserId !== null,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: children } = useQuery<Child[]>({
    queryKey: ['/api/children'],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { recipientId: number; content: string; childId?: number }) => {
      return await apiRequest('POST', '/api/messages', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      if (selectedUserId) {
        queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedUserId] });
      }
      setRecipientId('');
      setChildId('');
      setContent('');
      setShowNewMessage(false);
      toast({
        title: t('success'),
        description: t('messageSent'),
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (user?.role === 'guardian') {
      if (!childId) {
        toast({
          title: t('error'),
          description: t('selectChild'),
          variant: 'destructive',
        });
        return;
      }
      if (!selectedUserId && !recipientId) {
        toast({
          title: t('error'),
          description: t('selectRecipient'),
          variant: 'destructive',
        });
        return;
      }
    }

    const messageData: { recipientId: number; content: string; childId?: number } = {
      recipientId: selectedUserId || parseInt(recipientId),
      content,
    };

    if (childId) {
      messageData.childId = parseInt(childId);
    }

    sendMessageMutation.mutate(messageData);
  };

  const getConversations = (): Conversation[] => {
    if (!messages || !user) return [];

    const conversationMap = new Map<number, Conversation>();

    messages.forEach((msg) => {
      const otherUserId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      const otherUserName = msg.senderId === user.id ? msg.recipientName : msg.senderName;
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserName || `User ${otherUserId}`,
          userRole: '',
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: msg.recipientId === user.id && !msg.read ? 1 : 0,
        });
      } else {
        const conv = conversationMap.get(otherUserId)!;
        if (new Date(msg.createdAt) > new Date(conv.lastMessageAt)) {
          conv.lastMessage = msg.content;
          conv.lastMessageAt = msg.createdAt;
        }
        if (msg.recipientId === user.id && !msg.read) {
          conv.unreadCount++;
        }
      }
    });

    return Array.from(conversationMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  };

  const conversations = getConversations();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const availableRecipients = users?.filter((u) => {
    if (user?.role === 'guardian') {
      return u.role === 'staff' || u.role === 'daycareleader';
    }
    return u.id !== user?.id;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('messages')}</h1>
          <p className="text-muted-foreground mt-1">{t('conversations')}</p>
        </div>
        <Button onClick={() => setShowNewMessage(true)} data-testid="button-new-message">
          <MessageSquare className="mr-2 h-4 w-4" />
          {t('newMessage')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="border-0 shadow-md" data-testid="card-conversations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                {t('conversations')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {messagesLoading ? (
                <div className="space-y-2 p-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : conversations.length > 0 ? (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.userId}
                      onClick={() => {
                        setSelectedUserId(conv.userId);
                        setShowNewMessage(false);
                      }}
                      className={`w-full p-4 text-left hover-elevate active-elevate-2 ${
                        selectedUserId === conv.userId ? 'bg-muted' : ''
                      }`}
                      data-testid={`button-conversation-${conv.userId}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback>{getInitials(conv.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate" data-testid={`text-conversation-name-${conv.userId}`}>
                              {conv.userName}
                            </p>
                            {conv.unreadCount > 0 && (
                              <Badge variant="default" data-testid={`badge-unread-${conv.userId}`}>
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate" data-testid={`text-last-message-${conv.userId}`}>
                            {conv.lastMessage}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(conv.lastMessageAt), 'PP')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground" data-testid="text-no-conversations">{t('noMessages')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          {showNewMessage ? (
            <Card className="border-0 shadow-md" data-testid="card-new-message">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  {t('newMessage')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient">{t('messageTo')}</Label>
                    <Select value={recipientId} onValueChange={setRecipientId} required>
                      <SelectTrigger id="recipient" data-testid="select-recipient">
                        <SelectValue placeholder={t('selectRecipient')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRecipients?.map((recipient) => (
                          <SelectItem key={recipient.id} value={recipient.id.toString()}>
                            {recipient.name} ({recipient.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="childContext">
                      {t('childName')} {user?.role === 'guardian' ? '' : `(${t('optional')})`}
                    </Label>
                    <Select value={childId} onValueChange={setChildId} required={user?.role === 'guardian'}>
                      <SelectTrigger id="childContext" data-testid="select-message-child">
                        <SelectValue placeholder={t('selectChild')} />
                      </SelectTrigger>
                      <SelectContent>
                        {children?.map((child) => (
                          <SelectItem key={child.id} value={child.id.toString()}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">{t('messageContent')}</Label>
                    <Textarea
                      id="content"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={t('messageContent')}
                      rows={5}
                      required
                      data-testid="textarea-message-content"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={sendMessageMutation.isPending} data-testid="button-send-message">
                      <Send className="mr-2 h-4 w-4" />
                      {sendMessageMutation.isPending ? t('loading') : t('sendMessage')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowNewMessage(false)} data-testid="button-cancel-message">
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : selectedUserId ? (
            <Card className="border-0 shadow-md" data-testid="card-conversation-detail">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    {conversations.find((c) => c.userId === selectedUserId)?.userName}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {conversationLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : conversation && conversation.length > 0 ? (
                  <>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      {conversation.map((msg) => {
                        const isOwnMessage = msg.senderId === user?.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            data-testid={`message-${msg.id}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              {msg.childName && (
                                <p className="text-xs opacity-70 mb-1">
                                  {t('about')}: {msg.childName}
                                </p>
                              )}
                              <p className="text-sm" data-testid={`text-message-content-${msg.id}`}>{msg.content}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {format(new Date(msg.createdAt), 'p')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (user?.role === 'guardian' && !childId) {
                        toast({
                          title: t('error'),
                          description: t('childRequired'),
                          variant: 'destructive',
                        });
                        return;
                      }
                      if (content.trim()) {
                        sendMessageMutation.mutate({
                          recipientId: selectedUserId,
                          content,
                          childId: childId ? parseInt(childId) : undefined,
                        });
                      }
                    }} className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="childContextReply">
                          {t('childName')} {user?.role === 'guardian' ? '' : `(${t('optional')})`}
                        </Label>
                        <Select value={childId} onValueChange={setChildId} required={user?.role === 'guardian'}>
                          <SelectTrigger id="childContextReply" data-testid="select-reply-child">
                            <SelectValue placeholder={t('selectChild')} />
                          </SelectTrigger>
                          <SelectContent>
                            {children?.map((child) => (
                              <SelectItem key={child.id} value={child.id.toString()}>
                                {child.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2">
                        <Textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder={t('messageContent')}
                          rows={2}
                          data-testid="textarea-reply-content"
                        />
                        <Button type="submit" size="icon" disabled={sendMessageMutation.isPending} data-testid="button-send-reply">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('noMessages')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-md" data-testid="card-no-selection">
              <CardContent className="flex flex-col items-center justify-center py-24">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <MessageSquare className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-lg text-muted-foreground" data-testid="text-select-conversation">
                  {t('selectConversation')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagesPage;
