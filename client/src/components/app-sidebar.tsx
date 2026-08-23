import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LayoutDashboard, Users, ClipboardList, FileText, Settings, Baby, Building2, Calendar, MessageSquare, BarChart3, ShieldCheck, ScrollText, UtensilsCrossed, ClipboardCheck, Shield, Trash2, ChevronRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
};

export function AppSidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { setOpen, state } = useSidebar();

  const isCollapsed = state === 'collapsed';

  const getMenuGroups = (): MenuGroup[] => {
    if (!user) return [];

    switch (user.role) {
      case 'super_admin':
        return [
          {
            label: t('management'),
            defaultOpen: true,
            items: [
              { title: t('dashboard'), url: '/dashboard', icon: LayoutDashboard },
              { title: t('municipalities'), url: '/super-admin/municipalities', icon: Globe },
              { title: t('daycares'), url: '/daycares', icon: Building2 },
              { title: t('administrators'), url: '/super-admin/users', icon: ShieldCheck },
            ],
          },
          {
            label: t('system'),
            defaultOpen: true,
            items: [
              { title: t('statistics'), url: '/super-admin/stats', icon: BarChart3 },
              { title: t('auditLogs'), url: '/super-admin/audit-logs', icon: ScrollText },
              { title: t('settings'), url: '/settings', icon: Settings },
            ],
          },
        ];
      case 'daycareleader':
        return [
          {
            label: t('childrenAndEntries'),
            defaultOpen: true,
            items: [
              { title: t('dashboard'), url: '/dashboard', icon: LayoutDashboard },
              { title: t('children'), url: '/children', icon: Baby },
              { title: t('addEntry'), url: '/entries/new', icon: ClipboardList },
              { title: t('mealMenu'), url: '/menu', icon: UtensilsCrossed },
            ],
          },
          {
            label: t('communication'),
            defaultOpen: true,
            items: [
              { title: t('absences'), url: '/absences', icon: Calendar },
              { title: t('forms'), url: '/forms', icon: ClipboardCheck },
              { title: t('messages'), url: '/messages', icon: MessageSquare },
            ],
          },
          {
            label: t('administration'),
            defaultOpen: false,
            items: [
              { title: t('users'), url: '/users', icon: Users },
              { title: t('deleteRequests'), url: '/delete-requests', icon: Trash2 },
              { title: t('auditLogs'), url: '/audit-logs', icon: ScrollText },
              { title: t('settings'), url: '/settings', icon: Settings },
            ],
          },
        ];
      case 'staff':
        return [
          {
            label: t('childrenAndEntries'),
            defaultOpen: true,
            items: [
              { title: t('dashboard'), url: '/dashboard', icon: LayoutDashboard },
              { title: t('children'), url: '/children', icon: Baby },
              { title: t('addEntry'), url: '/entries/new', icon: ClipboardList },
              { title: t('mealMenu'), url: '/menu', icon: UtensilsCrossed },
            ],
          },
          {
            label: t('communication'),
            defaultOpen: true,
            items: [
              { title: t('absences'), url: '/absences', icon: Calendar },
              { title: t('forms'), url: '/forms', icon: ClipboardCheck },
              { title: t('messages'), url: '/messages', icon: MessageSquare },
            ],
          },
          {
            label: t('administration'),
            defaultOpen: false,
            items: [
              { title: t('users'), url: '/users', icon: Users },
              { title: t('deleteRequests'), url: '/delete-requests', icon: Trash2 },
            ],
          },
        ];
      case 'guardian':
        return [
          {
            label: t('myFamily'),
            defaultOpen: true,
            items: [
              { title: t('dashboard'), url: '/dashboard', icon: LayoutDashboard },
              { title: t('myChildren'), url: '/children', icon: Baby },
              { title: t('mealMenu'), url: '/menu', icon: UtensilsCrossed },
            ],
          },
          {
            label: t('communication'),
            defaultOpen: true,
            items: [
              { title: t('absences'), url: '/absences', icon: Calendar },
              { title: t('forms'), url: '/forms', icon: ClipboardCheck },
              { title: t('messages'), url: '/messages', icon: MessageSquare },
            ],
          },
          {
            label: t('settingsPrivacy'),
            defaultOpen: false,
            items: [
              { title: t('gdprSettings'), url: '/gdpr', icon: Shield },
            ],
          },
        ];
      default:
        return [];
    }
  };

  const menuGroups = getMenuGroups();

  const isItemActive = (url: string) => location === url;
  const isGroupActive = (items: MenuItem[]) => items.some(item => isItemActive(item.url));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach((group, index) => {
      initial[`group-${index}`] = group.defaultOpen ?? false;
    });
    return initial;
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Baby className="h-6 w-6" aria-hidden="true" />
          </div>
          {!isCollapsed && (
            <div>
              <p className="text-lg font-semibold">{t('appName')}</p>
              <p className="text-xs text-muted-foreground">{t('appTagline')}</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{user?.name}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuGroups.map((group, groupIndex) => {
                const groupKey = `group-${groupIndex}`;
                const isOpen = openGroups[groupKey] ?? group.defaultOpen ?? false;
                const hasActiveItem = isGroupActive(group.items);

                return (
                  <Collapsible
                    key={groupKey}
                    open={isOpen}
                    onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [groupKey]: open }))}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          type="button"
                          className="w-full justify-between"
                          data-testid={`sidebar-group-${groupKey}`}
                          aria-expanded={isOpen}
                        >
                          <span className={hasActiveItem ? 'font-medium' : ''}>{group.label}</span>
                          <ChevronRight 
                            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {group.items.map((item) => (
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton asChild isActive={isItemActive(item.url)}>
                                <Link
                                  href={item.url}
                                  data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                                  onClick={() => setTimeout(() => setOpen(false), 0)}
                                >
                                  <item.icon className="h-4 w-4" aria-hidden="true" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={logout}
          data-testid="button-logout"
        >
          {t('logout')}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
