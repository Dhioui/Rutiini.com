import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Trash2, Eye, Pencil, CheckCircle, Loader2, X } from "lucide-react";
import type { Form, FormField, Child } from "@shared/schema";

interface FormWithMeta extends Form {
  submissionCount?: number;
}

interface FormSubmission {
  id: number;
  formId: number;
  childId: number | null;
  responses: Record<string, any>;
  submittedAt: string;
  submitterName: string;
  childName: string | null;
}

export default function FormsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [viewSubmissionsDialogOpen, setViewSubmissionsDialogOpen] = useState(false);

  const isAdmin = user?.role === "daycareleader" || user?.role === "staff";
  const isGuardian = user?.role === "guardian";

  const { data: forms, isLoading: formsLoading } = useQuery<Form[]>({
    queryKey: ["/api/forms"],
  });

  const { data: children } = useQuery<Child[]>({
    queryKey: ["/api/children"],
    enabled: isGuardian,
  });

  const { data: mySubmissions } = useQuery<FormSubmission[]>({
    queryKey: ["/api/my-submissions"],
    enabled: isGuardian,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-forms-title">
            {t("formsTitle", "Lomakkeet")}
          </h1>
          <p className="text-muted-foreground">
            {isGuardian
              ? t("formsGuardianDescription", "Täytä lomakkeet lapsillesi")
              : t("formsAdminDescription", "Hallinnoi lomakkeita ja vastauksia")}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-form">
                <Plus className="h-4 w-4 mr-2" />
                {t("createForm", "Luo lomake")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("createFormTitle", "Luo uusi lomake")}</DialogTitle>
                <DialogDescription>
                  {t("createFormDescription", "Määritä lomakkeen kentät ja asetukset")}
                </DialogDescription>
              </DialogHeader>
              <CreateFormDialog onClose={() => setCreateDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {formsLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : forms && forms.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              isAdmin={isAdmin}
              isGuardian={isGuardian}
              children={children || []}
              mySubmissions={mySubmissions || []}
              onFill={(f) => {
                setSelectedForm(f);
                setFillDialogOpen(true);
              }}
              onViewSubmissions={(f) => {
                setSelectedForm(f);
                setViewSubmissionsDialogOpen(true);
              }}
              onEdit={(f) => {
                setSelectedForm(f);
                setEditDialogOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isAdmin
                ? t("noFormsAdmin", "Ei lomakkeita. Luo ensimmäinen lomake.")
                : t("noFormsGuardian", "Ei täytettäviä lomakkeita.")}
            </p>
          </CardContent>
        </Card>
      )}

      {selectedForm && fillDialogOpen && (
        <Dialog open={fillDialogOpen} onOpenChange={setFillDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedForm.title}</DialogTitle>
              <DialogDescription>{selectedForm.description}</DialogDescription>
            </DialogHeader>
            <FillFormDialog
              form={selectedForm}
              children={children || []}
              mySubmissions={mySubmissions || []}
              onClose={() => setFillDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {selectedForm && viewSubmissionsDialogOpen && (
        <Dialog open={viewSubmissionsDialogOpen} onOpenChange={setViewSubmissionsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {t("viewSubmissions", "Vastaukset")}: {selectedForm.title}
              </DialogTitle>
            </DialogHeader>
            <ViewSubmissionsDialog form={selectedForm} />
          </DialogContent>
        </Dialog>
      )}

      {selectedForm && editDialogOpen && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("editForm", "Muokkaa lomaketta")}</DialogTitle>
              <DialogDescription>
                {t("editFormDescription", "Muokkaa lomakkeen tietoja ja kenttiä")}
              </DialogDescription>
            </DialogHeader>
            <EditFormDialog form={selectedForm} onClose={() => setEditDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function FormCard({
  form,
  isAdmin,
  isGuardian,
  children,
  mySubmissions,
  onFill,
  onViewSubmissions,
  onEdit,
}: {
  form: Form;
  isAdmin: boolean;
  isGuardian: boolean;
  children: Child[];
  mySubmissions: FormSubmission[];
  onFill: (form: Form) => void;
  onViewSubmissions: (form: Form) => void;
  onEdit: (form: Form) => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/forms/${form.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({
        title: t("formDeleted", "Lomake poistettu"),
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/forms/${form.id}`, {
        isActive: !form.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
    },
  });

  const fields = form.fields as FormField[];
  const alreadySubmitted = isGuardian && mySubmissions.some(
    (s) => s.formId === form.id && (form.requiresChildContext ? children.every((c) => mySubmissions.some((sub) => sub.formId === form.id && sub.childId === c.id)) : true)
  );

  return (
    <Card className="hover-elevate" data-testid={`card-form-${form.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{form.title}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">{form.description}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={form.isActive ? "default" : "secondary"}>
              {form.isActive ? t("formActive", "Aktiivinen") : t("formInactive", "Ei aktiivinen")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>
            {fields.length} {t("fieldsCount", "kenttää")}
          </span>
          {form.requiresChildContext && (
            <Badge variant="outline" className="ml-auto">
              {t("perChild", "Lapsikohtainen")}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isGuardian && form.isActive && (
            <Button
              size="sm"
              onClick={() => onFill(form)}
              disabled={alreadySubmitted}
              data-testid={`button-fill-form-${form.id}`}
            >
              {alreadySubmitted ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {t("alreadySubmitted", "Lähetetty")}
                </>
              ) : (
                t("fillForm", "Täytä")
              )}
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" onClick={() => onViewSubmissions(form)} data-testid={`button-view-submissions-${form.id}`}>
                <Eye className="h-4 w-4 mr-1" />
                {t("viewSubmissions", "Vastaukset")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleActiveMutation.mutate()}
                disabled={toggleActiveMutation.isPending}
              >
                {form.isActive ? t("deactivate", "Poista käytöstä") : t("activate", "Aktivoi")}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEdit(form)}
                data-testid={`button-edit-form-${form.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(t("deleteFormConfirm", "Haluatko varmasti poistaa tämän lomakkeen?"))) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateFormDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"consent" | "survey" | "registration" | "general">("consent");
  const [requiresChildContext, setRequiresChildContext] = useState(true);
  const [fields, setFields] = useState<FormField[]>([
    { id: "field_1", type: "text", label: "", required: false },
  ]);

  const generateFieldId = () => `field_${crypto.randomUUID()}`;

  const prepareFieldsForSave = () => {
    return fields
      .filter((f) => f.label.trim() !== "")
      .map((f) => {
        if (f.type === "select") {
          return { ...f, options: f.options?.filter((opt) => opt.trim() !== "") ?? [] };
        }
        return { ...f };
      });
  };

  const hasEmptySelectOptions = () => {
    return fields.some(
      (f) => f.type === "select" && f.label.trim() !== "" && (!f.options || f.options.every((opt) => opt.trim() === ""))
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const preparedFields = prepareFieldsForSave();
      await apiRequest("POST", "/api/forms", {
        title,
        description,
        type,
        requiresChildContext,
        fields: preparedFields,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: t("formCreated", "Lomake luotu") });
      onClose();
    },
    onError: () => {
      toast({ title: t("error", "Virhe"), variant: "destructive" });
    },
  });

  const addField = () => {
    setFields([
      ...fields,
      { id: generateFieldId(), type: "text", label: "", required: false },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...structuredClone(f), ...updates } : f)));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div>
          <Label>{t("formTitle", "Lomakkeen otsikko")}</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("formTitlePlaceholder", "esim. Retkisopimus")}
            data-testid="input-form-title"
          />
        </div>
        <div>
          <Label>{t("formDescription", "Kuvaus")}</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("formDescriptionPlaceholder", "Kerro lomakkeesta...")}
            data-testid="input-form-description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("formType", "Tyyppi")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger data-testid="select-form-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consent">{t("formTypeConsent", "Suostumus")}</SelectItem>
                <SelectItem value="survey">{t("formTypeSurvey", "Kysely")}</SelectItem>
                <SelectItem value="registration">{t("formTypeRegistration", "Ilmoittautuminen")}</SelectItem>
                <SelectItem value="general">{t("formTypeGeneral", "Yleinen")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch
              checked={requiresChildContext}
              onCheckedChange={setRequiresChildContext}
              data-testid="switch-requires-child"
            />
            <Label>{t("requiresChild", "Lapsikohtainen")}</Label>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>{t("formFields", "Kentät")}</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="p-3 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Input
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  placeholder={t("fieldLabel", "Kentän nimi")}
                  data-testid={`input-field-label-${index}`}
                />
                <Select
                  value={field.type}
                  onValueChange={(v) => updateField(index, { type: v as FormField["type"], options: v === "select" ? [""] : undefined })}
                >
                  <SelectTrigger data-testid={`select-field-type-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("fieldText", "Teksti")}</SelectItem>
                    <SelectItem value="textarea">{t("fieldTextarea", "Pitkä teksti")}</SelectItem>
                    <SelectItem value="checkbox">{t("fieldCheckbox", "Valintaruutu")}</SelectItem>
                    <SelectItem value="select">{t("fieldSelect", "Pudotusvalikko")}</SelectItem>
                    <SelectItem value="date">{t("fieldDate", "Päivämäärä")}</SelectItem>
                    <SelectItem value="number">{t("fieldNumber", "Numero")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(v) => updateField(index, { required: v })}
                  />
                  <Label className="text-sm">{t("required", "Pakollinen")}</Label>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeField(index)}
                disabled={fields.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {field.type === "select" && (
              <div className="pl-2 space-y-2">
                <Label className="text-sm text-muted-foreground">{t("dropdownOptions", "Vaihtoehdot")}</Label>
                {(field.options || [""]).map((opt, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...(field.options || [""])];
                        newOptions[optIndex] = e.target.value;
                        updateField(index, { options: newOptions });
                      }}
                      placeholder={`${t("option", "Vaihtoehto")} ${optIndex + 1}`}
                      data-testid={`input-option-${index}-${optIndex}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const newOptions = (field.options || []).filter((_, i) => i !== optIndex);
                        updateField(index, { options: newOptions.length > 0 ? newOptions : [""] });
                      }}
                      disabled={(field.options || []).length <= 1}
                      data-testid={`button-remove-option-${index}-${optIndex}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOptions = [...(field.options || [""]), ""];
                    updateField(index, { options: newOptions });
                  }}
                  data-testid={`button-add-option-${index}`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t("addOption", "Lisää vaihtoehto")}
                </Button>
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addField} className="w-full" data-testid="button-add-field">
          <Plus className="h-4 w-4 mr-2" />
          {t("addField", "Lisää kenttä")}
        </Button>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-form">
          {t("cancel", "Peruuta")}
        </Button>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!title.trim() || fields.every((f) => !f.label.trim()) || hasEmptySelectOptions() || createMutation.isPending}
          data-testid="button-save-form"
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("save", "Tallenna")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function FillFormDialog({
  form,
  children,
  mySubmissions,
  onClose,
}: {
  form: Form;
  children: Child[];
  mySubmissions: FormSubmission[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedChildId, setSelectedChildId] = useState<number | null>(
    children.length === 1 ? children[0].id : null
  );
  
  const fields = form.fields as FormField[];
  
  // Initialize responses with default values from readonly fields
  const [responses, setResponses] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const field of fields) {
      if (field.readonly && field.value !== undefined) {
        initial[field.id] = field.value;
      }
    }
    return initial;
  });

  const childrenWithPendingForm = children.filter(
    (child) => !mySubmissions.some((s) => s.formId === form.id && s.childId === child.id)
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/forms/${form.id}/submit`, {
        childId: form.requiresChildContext ? selectedChildId : null,
        responses,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: t("formSubmitted", "Lomake lähetetty") });
      onClose();
    },
    onError: () => {
      toast({ title: t("error", "Virhe"), variant: "destructive" });
    },
  });

  const isValid = () => {
    if (form.requiresChildContext && !selectedChildId) return false;
    for (const field of fields) {
      if (field.required && !responses[field.id]) return false;
    }
    return true;
  };

  return (
    <div className="space-y-4">
      {form.requiresChildContext && (
        <div>
          <Label>{t("selectChildForm", "Valitse lapsi")}</Label>
          {childrenWithPendingForm.length === 0 ? (
            <p className="text-muted-foreground text-sm mt-2">
              {t("allChildrenSubmitted", "Olet jo täyttänyt tämän lomakkeen kaikille lapsillesi.")}
            </p>
          ) : (
            <Select
              value={selectedChildId?.toString() || ""}
              onValueChange={(v) => setSelectedChildId(parseInt(v))}
            >
              <SelectTrigger data-testid="select-child-for-form">
                <SelectValue placeholder={t("selectChildPlaceholder", "Valitse lapsi...")} />
              </SelectTrigger>
              <SelectContent>
                {childrenWithPendingForm.map((child) => (
                  <SelectItem key={child.id} value={child.id.toString()}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {fields.map((field) => (
        <div key={field.id}>
          <Label>
            {field.label}
            {field.required && !field.readonly && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.type === "text" && field.readonly ? (
            <div className="p-2 bg-muted rounded-md text-sm font-medium" data-testid={`text-readonly-${field.id}`}>
              {field.value || responses[field.id] || "-"}
            </div>
          ) : field.type === "text" && (
            <Input
              value={responses[field.id] || ""}
              onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
              placeholder={field.placeholder}
              data-testid={`input-response-${field.id}`}
            />
          )}
          {field.type === "textarea" && (
            <Textarea
              value={responses[field.id] || ""}
              onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
              placeholder={field.placeholder}
              data-testid={`textarea-response-${field.id}`}
            />
          )}
          {field.type === "checkbox" && (
            <div className="flex items-center gap-2 mt-2">
              <Switch
                checked={responses[field.id] || false}
                onCheckedChange={(v) => setResponses({ ...responses, [field.id]: v })}
                data-testid={`switch-response-${field.id}`}
              />
              <span className="text-sm text-muted-foreground">
                {responses[field.id] ? t("yes", "Kyllä") : t("no", "Ei")}
              </span>
            </div>
          )}
          {field.type === "select" && field.options && (
            <Select
              value={responses[field.id] || ""}
              onValueChange={(v) => setResponses({ ...responses, [field.id]: v })}
            >
              <SelectTrigger data-testid={`select-response-${field.id}`}>
                <SelectValue placeholder={t("select", "Valitse...")} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {field.type === "radio" && field.options && (
            <div className="flex flex-col gap-2 mt-2" data-testid={`radio-group-${field.id}`}>
              {field.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.id}
                    value={opt}
                    checked={responses[field.id] === opt}
                    onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
                    className="w-4 h-4 text-primary"
                    data-testid={`radio-${field.id}-${opt}`}
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          )}
          {field.type === "date" && field.readonly ? (
            <div className="p-2 bg-muted rounded-md text-sm font-medium" data-testid={`text-readonly-${field.id}`}>
              {field.value || responses[field.id] || "-"}
            </div>
          ) : field.type === "date" && (
            <Input
              type="date"
              value={responses[field.id] || ""}
              onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
              data-testid={`input-date-response-${field.id}`}
            />
          )}
          {field.type === "number" && (
            <Input
              type="number"
              value={responses[field.id] || ""}
              onChange={(e) => setResponses({ ...responses, [field.id]: e.target.value })}
              data-testid={`input-number-response-${field.id}`}
            />
          )}
        </div>
      ))}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("cancel", "Peruuta")}
        </Button>
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={!isValid() || submitMutation.isPending}
          data-testid="button-submit-form"
        >
          {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("submit", "Lähetä")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ViewSubmissionsDialog({ form }: { form: Form }) {
  const { t } = useTranslation();

  const { data: submissions, isLoading } = useQuery<FormSubmission[]>({
    queryKey: ["/api/forms", form.id, "submissions"],
  });

  const fields = form.fields as FormField[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        {t("noSubmissions", "Ei vastauksia vielä")}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {submissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{submission.submitterName}</CardTitle>
                {submission.childName && (
                  <CardDescription>{submission.childName}</CardDescription>
                )}
              </div>
              <Badge variant="outline">
                {new Date(submission.submittedAt).toLocaleDateString("fi-FI")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {fields.map((field) => (
                <div key={field.id} className="grid grid-cols-3 gap-2">
                  <dt className="font-medium text-muted-foreground">{field.label}</dt>
                  <dd className="col-span-2">
                    {field.type === "checkbox"
                      ? submission.responses[field.id]
                        ? t("yes", "Kyllä")
                        : t("no", "Ei")
                      : submission.responses[field.id] || "-"}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EditFormDialog({ form, onClose }: { form: Form; onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description || "");
  const [type, setType] = useState<"consent" | "survey" | "registration" | "general">(form.type as any);
  const [requiresChildContext, setRequiresChildContext] = useState(form.requiresChildContext);
  const [isActive, setIsActive] = useState(form.isActive);
  const [fields, setFields] = useState<FormField[]>(() => 
    structuredClone(form.fields ?? []) as FormField[]
  );

  const generateFieldId = () => `field_${crypto.randomUUID()}`;

  const prepareFieldsForSave = () => {
    return fields
      .filter((f) => f.label.trim() !== "")
      .map((f) => {
        if (f.type === "select") {
          return { ...f, options: f.options?.filter((opt) => opt.trim() !== "") ?? [] };
        }
        return { ...f };
      });
  };

  const hasEmptySelectOptions = () => {
    return fields.some(
      (f) => f.type === "select" && f.label.trim() !== "" && (!f.options || f.options.every((opt) => opt.trim() === ""))
    );
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const preparedFields = prepareFieldsForSave();
      await apiRequest("PATCH", `/api/forms/${form.id}`, {
        title,
        description,
        type,
        requiresChildContext,
        isActive,
        fields: preparedFields,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: t("formUpdated", "Lomake päivitetty") });
      onClose();
    },
    onError: () => {
      toast({ title: t("error", "Virhe"), variant: "destructive" });
    },
  });

  const addField = () => {
    setFields([
      ...fields,
      { id: generateFieldId(), type: "text", label: "", required: false },
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...structuredClone(f), ...updates } : f)));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div>
          <Label>{t("formTitle", "Lomakkeen otsikko")}</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("formTitlePlaceholder", "esim. Retkisopimus")}
            data-testid="input-edit-form-title"
          />
        </div>
        <div>
          <Label>{t("formDescription", "Kuvaus")}</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("formDescriptionPlaceholder", "Kerro lomakkeesta...")}
            data-testid="input-edit-form-description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("formType", "Tyyppi")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger data-testid="select-edit-form-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consent">{t("formTypeConsent", "Suostumus")}</SelectItem>
                <SelectItem value="survey">{t("formTypeSurvey", "Kysely")}</SelectItem>
                <SelectItem value="registration">{t("formTypeRegistration", "Ilmoittautuminen")}</SelectItem>
                <SelectItem value="general">{t("formTypeGeneral", "Yleinen")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={requiresChildContext}
                onCheckedChange={setRequiresChildContext}
                data-testid="switch-edit-requires-child"
              />
              <Label>{t("requiresChild", "Lapsikohtainen")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-edit-is-active"
              />
              <Label>{t("formActive", "Aktiivinen")}</Label>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Label>{t("formFields", "Kentät")}</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="p-3 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-3 gap-2">
                <Input
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  placeholder={t("fieldLabel", "Kentän nimi")}
                  data-testid={`input-edit-field-label-${index}`}
                />
                <Select
                  value={field.type}
                  onValueChange={(v) => updateField(index, { type: v as FormField["type"], options: v === "select" ? field.options || [""] : undefined })}
                >
                  <SelectTrigger data-testid={`select-edit-field-type-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("fieldText", "Teksti")}</SelectItem>
                    <SelectItem value="textarea">{t("fieldTextarea", "Pitkä teksti")}</SelectItem>
                    <SelectItem value="checkbox">{t("fieldCheckbox", "Valintaruutu")}</SelectItem>
                    <SelectItem value="select">{t("fieldSelect", "Pudotusvalikko")}</SelectItem>
                    <SelectItem value="date">{t("fieldDate", "Päivämäärä")}</SelectItem>
                    <SelectItem value="number">{t("fieldNumber", "Numero")}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(v) => updateField(index, { required: v })}
                  />
                  <Label className="text-sm">{t("required", "Pakollinen")}</Label>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeField(index)}
                disabled={fields.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {field.type === "select" && (
              <div className="pl-2 space-y-2">
                <Label className="text-sm text-muted-foreground">{t("dropdownOptions", "Vaihtoehdot")}</Label>
                {(field.options || [""]).map((opt, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...(field.options || [""])];
                        newOptions[optIndex] = e.target.value;
                        updateField(index, { options: newOptions });
                      }}
                      placeholder={`${t("option", "Vaihtoehto")} ${optIndex + 1}`}
                      data-testid={`input-edit-option-${index}-${optIndex}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const newOptions = (field.options || []).filter((_, i) => i !== optIndex);
                        updateField(index, { options: newOptions.length > 0 ? newOptions : [""] });
                      }}
                      disabled={(field.options || []).length <= 1}
                      data-testid={`button-edit-remove-option-${index}-${optIndex}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOptions = [...(field.options || [""]), ""];
                    updateField(index, { options: newOptions });
                  }}
                  data-testid={`button-edit-add-option-${index}`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t("addOption", "Lisää vaihtoehto")}
                </Button>
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addField} className="w-full" data-testid="button-edit-add-field">
          <Plus className="h-4 w-4 mr-2" />
          {t("addField", "Lisää kenttä")}
        </Button>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-edit-cancel-form">
          {t("cancel", "Peruuta")}
        </Button>
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={!title.trim() || fields.every((f) => !f.label.trim()) || hasEmptySelectOptions() || updateMutation.isPending}
          data-testid="button-update-form"
        >
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("save", "Tallenna")}
        </Button>
      </DialogFooter>
    </div>
  );
}
