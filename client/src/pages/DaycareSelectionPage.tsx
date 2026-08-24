import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Building2, Shield, MapPin, ChevronRight, Loader2, Search } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Footer } from "@/components/Footer";
import { apiUrl } from '@/lib/api';

interface PublicDaycare {
  id: number;
  name: string;
  code: string;
}

export function DaycareSelectionPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [selectedDaycareCode, setSelectedDaycareCode] = useState("");
  const [daycareSearch, setDaycareSearch] = useState("");

  const { data: municipalities, isLoading: municipalitiesLoading } = useQuery<string[]>({
    queryKey: ['/api/public/municipalities'],
  });

  const { data: daycares, isLoading: daycaresLoading } = useQuery<PublicDaycare[]>({
    queryKey: ['/api/public/daycares', selectedMunicipality],
    queryFn: async () => {
      if (!selectedMunicipality) return [];
      const res = await fetch(apiUrl(`/api/public/daycares?municipality=${encodeURIComponent(selectedMunicipality)}`));
      if (!res.ok) throw new Error('Failed to fetch daycares');
      return res.json();
    },
    enabled: !!selectedMunicipality,
  });

  const handleContinue = () => {
    if (selectedDaycareCode) {
      setLocation(`/select-role/${selectedDaycareCode}`);
    }
  };

  const handleMunicipalityChange = (value: string) => {
    setSelectedMunicipality(value);
    setSelectedDaycareCode("");
    setDaycareSearch("");
  };

  // Filter daycares based on search
  const filteredDaycares = daycares?.filter((daycare) =>
    daycare.name.toLowerCase().includes(daycareSearch.toLowerCase()) ||
    daycare.code.toLowerCase().includes(daycareSearch.toLowerCase())
  ) || [];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/super-admin/login')}
            data-testid="button-super-admin-access"
            className="text-xs opacity-50 hover:opacity-100"
          >
            <Shield className="h-3 w-3 mr-1" />
            {t('superAdmin')}
          </Button>
          <LanguageToggle />
        </div>
        
        <Card className="w-full max-w-md border-0 shadow-md" data-testid="card-daycare-selection">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center shadow-sm">
              <Building2 className="w-10 h-10 text-blue-600" />
            </div>
            <CardTitle className="text-3xl font-bold" data-testid="text-title">
              {t('appName')}
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              {t('selectMunicipalityAndDaycare')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Select Municipality */}
            <div className="space-y-2">
              <Label htmlFor="municipality" className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {t('municipality')}
              </Label>
              {municipalitiesLoading ? (
                <div className="flex items-center justify-center h-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : municipalities && municipalities.length > 0 ? (
                <Select value={selectedMunicipality} onValueChange={handleMunicipalityChange}>
                  <SelectTrigger id="municipality" data-testid="select-municipality">
                    <SelectValue placeholder={t('selectMunicipality')} />
                  </SelectTrigger>
                  <SelectContent>
                    {municipalities.map((municipality) => (
                      <SelectItem key={municipality} value={municipality} data-testid={`option-municipality-${municipality}`}>
                        {municipality}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t('noMunicipalitiesFound')}
                </p>
              )}
            </div>

            {/* Step 2: Select Daycare */}
            {selectedMunicipality && (
              <div className="space-y-2">
                <Label htmlFor="daycare" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {t('daycare')}
                </Label>
                {daycaresLoading ? (
                  <div className="flex items-center justify-center h-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : daycares && daycares.length > 0 ? (
                  <div className="space-y-2">
                    {/* Search input for filtering daycares */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={t('searchDaycare')}
                        value={daycareSearch}
                        onChange={(e) => {
                          setDaycareSearch(e.target.value);
                          setSelectedDaycareCode("");
                        }}
                        className="pl-9"
                        data-testid="input-search-daycare"
                      />
                    </div>
                    {/* Show selected daycare or list of daycares */}
                    {selectedDaycareCode ? (
                      <div 
                        className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-md cursor-pointer hover-elevate"
                        onClick={() => setSelectedDaycareCode("")}
                        data-testid="selected-daycare"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {daycares.find(d => d.code === selectedDaycareCode)?.name}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{t('clickToChange')}</span>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                        {filteredDaycares.length > 0 ? (
                          filteredDaycares.map((daycare) => (
                            <div
                              key={daycare.id}
                              className="flex items-center gap-2 p-3 cursor-pointer hover-elevate"
                              onClick={() => setSelectedDaycareCode(daycare.code)}
                              data-testid={`option-daycare-${daycare.code}`}
                            >
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{daycare.name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-sm text-muted-foreground text-center">
                            {t('noDaycaresFound')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {t('noDaycaresInMunicipality')}
                  </p>
                )}
              </div>
            )}

            {/* Continue Button */}
            <Button 
              onClick={handleContinue}
              className="w-full" 
              size="lg"
              data-testid="button-continue"
              disabled={!selectedDaycareCode}
            >
              {t('continue')}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
