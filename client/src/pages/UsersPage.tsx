import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users as UsersIcon, Link, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Child {
  id: number;
  name: string;
  birthdate: string;
  group: string;
}

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["staff", "guardian"]),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  daycareId: number;
  linkedChildren?: { id: number; name: string }[];
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedGuardian, setSelectedGuardian] = useState<User | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: children = [] } = useQuery<Child[]>({
    queryKey: ["/api/children"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t("success"),
        description: t("userCreated"),
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error.message || t("failedToCreateUser"),
        variant: "destructive",
      });
    },
  });

  const linkGuardianMutation = useMutation({
    mutationFn: async ({ userId, childId }: { userId: number; childId: number }) => {
      return apiRequest("POST", `/api/users/${userId}/children/${childId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t("success"),
        description: t("guardianLinkedToChild"),
      });
      setIsLinkDialogOpen(false);
      setSelectedGuardian(null);
      setSelectedChildId("");
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error.message || t("failedToLinkGuardian"),
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/users/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t("success"),
        description: t("userDeleted"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error"),
        description: error.message || t("failedToDeleteUser"),
        variant: "destructive",
      });
    },
  });

  const handleLinkGuardian = () => {
    if (selectedGuardian && selectedChildId) {
      linkGuardianMutation.mutate({
        userId: selectedGuardian.id,
        childId: parseInt(selectedChildId),
      });
    }
  };

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      // Staff may only create guardians, so that is the only default that is
      // actually selectable for them.
      role: currentUser?.role === "daycareleader" ? "staff" : "guardian",
    },
  });

  if (currentUser?.role !== "daycareleader" && currentUser?.role !== "staff") {
    return (
      <div className="text-center">
        <p>{t("accessDenied")}</p>
      </div>
    );
  }

  if (isLoading) {
    return <div>{t("loading")}</div>;
  }

  const staffUsers = users.filter((u) => u.role === "staff");
  const guardianUsers = users.filter((u) => u.role === "guardian");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("userManagement")}</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user">
              <Plus className="h-4 w-4 mr-2" />
              {t("createUser")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("createNewUser")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  createUserMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("name")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("enterName")}
                          data-testid="input-user-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder={t("enterEmail")}
                          data-testid="input-user-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder={t("enterPassword")}
                          data-testid="input-user-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("role")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-user-role">
                            <SelectValue placeholder={t("selectRole")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {/* A staff account can read every child in the daycare, so
                              handing one out is a decision about who works here --
                              the leader's, not a colleague's. The server enforces
                              this; the option is hidden so nobody meets a refusal
                              they could not have predicted. */}
                          {currentUser?.role === "daycareleader" && (
                            <SelectItem value="staff" data-testid="option-staff">
                              {t("staff")}
                            </SelectItem>
                          )}
                          <SelectItem value="guardian" data-testid="option-guardian">
                            {t("guardian")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createUserMutation.isPending}
                  data-testid="button-submit-user"
                >
                  {createUserMutation.isPending ? t("creating") : t("createUser")}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-md" data-testid="card-staff-users">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              {t("staff")} ({staffUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="list-staff-users">
              {staffUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <UsersIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t("noStaffMembers")}
                  </p>
                </div>
              ) : (
                staffUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`user-staff-${user.id}`}
                  >
                    <div>
                      <p className="font-medium" data-testid={`text-user-name-${user.id}`}>
                        {user.name}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid={`text-user-email-${user.id}`}>
                        {user.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteUserMutation.mutate(user.id);
                      }}
                      disabled={deleteUserMutation.isPending}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md" data-testid="card-guardian-users">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              {t("guardians")} ({guardianUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="list-guardian-users">
              {guardianUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <UsersIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t("noGuardians")}
                  </p>
                </div>
              ) : (
                guardianUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-2"
                    data-testid={`user-guardian-${user.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium" data-testid={`text-user-name-${user.id}`}>
                        {user.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${user.id}`}>
                        {user.email}
                      </p>
                      {user.linkedChildren && user.linkedChildren.length > 0 && (
                        <div className="mt-1" data-testid={`linked-children-${user.id}`}>
                          <p className="text-xs text-muted-foreground">
                            {t("linkedChildren")}: {user.linkedChildren.map(c => c.name).join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGuardian(user);
                        setIsLinkDialogOpen(true);
                      }}
                      data-testid={`button-link-guardian-${user.id}`}
                    >
                      <Link className="h-4 w-4 mr-2" />
                      {t("linkToChild")}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("linkGuardianToChild")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("guardian")}: <span className="font-medium">{selectedGuardian?.name}</span>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("selectChild")}</label>
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger data-testid="select-child">
                  <SelectValue placeholder={t("selectChild")} />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id.toString()} data-testid={`option-child-${child.id}`}>
                      {child.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsLinkDialogOpen(false);
                  setSelectedGuardian(null);
                  setSelectedChildId("");
                }}
                className="flex-1"
                data-testid="button-cancel-link"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleLinkGuardian}
                disabled={!selectedChildId || linkGuardianMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-link"
              >
                {linkGuardianMutation.isPending ? t("linking") : t("link")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
