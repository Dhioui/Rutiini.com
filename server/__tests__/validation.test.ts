import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  superAdminLoginSchema,
  createUserSchema,
  insertChildSchema,
  insertAbsenceSchema,
  insertMunicipalitySchema,
  updateMunicipalitySchema,
  insertEntrySchema,
  insertTripSchema,
  insertMessageSchema,
  insertDocumentSchema,
  insertNotificationSchema,
  changePasswordSchema,
  insertFormSchema,
  insertFormSubmissionSchema,
  insertChildConsentSchema,
} from '@shared/schema';

describe('Login Schema Validation (Production)', () => {
  it('should accept valid login data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
      daycareCode: 'DC001',
    };
    
    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'not-an-email',
      password: 'password123',
      daycareCode: 'DC001',
    };
    
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 8 characters', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'short',
      daycareCode: 'DC001',
    };
    
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject empty daycare code', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'password123',
      daycareCode: '',
    };
    
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Super Admin Login Schema (Production)', () => {
  it('should accept valid super admin login', () => {
    const validData = {
      email: 'admin@example.com',
      password: 'password123',
    };
    
    const result = superAdminLoginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should not require daycare code for super admin', () => {
    const validData = {
      email: 'admin@example.com',
      password: 'password123',
    };
    
    const result = superAdminLoginSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('daycareCode');
    }
  });
});

describe('Create User Schema (Production)', () => {
  it('should accept valid user creation data with strong password', () => {
    const validData = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'StrongPass123!',
      role: 'staff' as const,
      daycareId: 1,
    };
    
    const result = createUserSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject password without uppercase', () => {
    const invalidData = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'weakpass123!',
      role: 'staff' as const,
      daycareId: 1,
    };
    
    const result = createUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject password without lowercase', () => {
    const invalidData = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'WEAKPASS123!',
      role: 'staff' as const,
      daycareId: 1,
    };
    
    const result = createUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject password without number', () => {
    const invalidData = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'WeakPassword!',
      role: 'staff' as const,
      daycareId: 1,
    };
    
    const result = createUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject password without special character', () => {
    const invalidData = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'WeakPass123',
      role: 'staff' as const,
      daycareId: 1,
    };
    
    const result = createUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 8 chars', () => {
    const invalidData = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'Weak1!',
      role: 'staff' as const,
      daycareId: 1,
    };
    
    const result = createUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should only allow valid roles', () => {
    const invalidData = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'StrongPass123!',
      role: 'super_admin',
      daycareId: 1,
    };
    
    const result = createUserSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should allow daycareleader, staff, guardian roles', () => {
    const roles = ['daycareleader', 'staff', 'guardian'] as const;
    
    for (const role of roles) {
      const validData = {
        name: 'Test User',
        email: 'user@example.com',
        password: 'StrongPass123!',
        role,
        daycareId: 1,
      };
      
      const result = createUserSchema.safeParse(validData);
      expect(result.success).toBe(true);
    }
  });
});

describe('Child Schema Validation (Production)', () => {
  it('should accept valid child data', () => {
    const validData = {
      name: 'Test Child',
      birthdate: '2020-05-15',
      daycareId: 1,
      groupId: null,
    };
    
    const result = insertChildSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept child with group', () => {
    const validData = {
      name: 'Test Child',
      birthdate: '2020-05-15',
      daycareId: 1,
      groupId: 2,
    };
    
    const result = insertChildSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const invalidData = {
      name: '',
      birthdate: '2020-05-15',
      daycareId: 1,
    };
    
    const result = insertChildSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject missing daycareId', () => {
    const invalidData = {
      name: 'Test Child',
      birthdate: '2020-05-15',
    };
    
    const result = insertChildSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Absence Schema Validation (Production)', () => {
  it('should accept valid absence with type absence', () => {
    const validData = {
      childId: 1,
      daycareId: 1,
      type: 'absence' as const,
      date: '2025-12-04',
      reportedById: 2,
    };
    
    const result = insertAbsenceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept valid sickness absence', () => {
    const validData = {
      childId: 1,
      daycareId: 1,
      type: 'sickness' as const,
      date: '2025-12-04',
      reason: 'Flu',
      reportedById: 2,
    };
    
    const result = insertAbsenceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept late arrival type', () => {
    const validData = {
      childId: 1,
      daycareId: 1,
      type: 'late_arrival' as const,
      date: '2025-12-04',
      reportedById: 2,
    };
    
    const result = insertAbsenceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept early pickup type', () => {
    const validData = {
      childId: 1,
      daycareId: 1,
      type: 'early_pickup' as const,
      date: '2025-12-04',
      reportedById: 2,
    };
    
    const result = insertAbsenceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid absence type', () => {
    const invalidData = {
      childId: 1,
      daycareId: 1,
      type: 'vacation',
      date: '2025-12-04',
      reportedById: 2,
    };
    
    const result = insertAbsenceSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Municipality Schema Validation (Production)', () => {
  it('should accept valid municipality data', () => {
    const validData = {
      name: 'Helsinki',
      code: 'HEL',
    };
    
    const result = insertMunicipalitySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should auto-uppercase code', () => {
    const validData = {
      name: 'Helsinki',
      code: 'hel',
    };
    
    const result = insertMunicipalitySchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('HEL');
    }
  });

  it('should accept municipality with menu settings', () => {
    const validData = {
      name: 'Espoo',
      code: 'ESP',
      defaultMenuSourceType: 'aromi',
      defaultMenuSourceUrl: 'https://menu.espoo.fi',
    };
    
    const result = insertMunicipalitySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('Municipality Update Schema (Production)', () => {
  it('should require at least one field', () => {
    const emptyData = {};
    
    const result = updateMunicipalitySchema.safeParse(emptyData);
    expect(result.success).toBe(false);
  });

  it('should accept partial update', () => {
    const validData = {
      name: 'Updated Name',
    };
    
    const result = updateMunicipalitySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should auto-uppercase code on update', () => {
    const validData = {
      code: 'van',
    };
    
    const result = updateMunicipalitySchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('VAN');
    }
  });

  it('should reject unknown fields (strict mode)', () => {
    const invalidData = {
      name: 'Test',
      unknownField: 'value',
    };
    
    const result = updateMunicipalitySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Entry Schema Validation (Production)', () => {
  it('should accept valid entry data', () => {
    const validData = {
      childId: 1,
      type: 'meal',
      value: 'ate_well',
      staffId: 2,
    };
    
    const result = insertEntrySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept entry with note', () => {
    const validData = {
      childId: 1,
      type: 'sleep',
      value: 'napping',
      note: 'Slept for 2 hours',
      staffId: 2,
    };
    
    const result = insertEntrySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('Change Password Schema (Production)', () => {
  it('should accept valid password change', () => {
    const validData = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    };
    
    const result = changePasswordSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject weak new password', () => {
    const invalidData = {
      currentPassword: 'OldPass123!',
      newPassword: 'weak',
    };
    
    const result = changePasswordSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('Form Schema Validation (Production)', () => {
  it('should accept valid form with fields', () => {
    const validData = {
      daycareId: 1,
      title: 'Consent Form',
      type: 'consent' as const,
      fields: [
        {
          id: 'field1',
          type: 'checkbox' as const,
          label: 'I agree',
          required: true,
        },
      ],
      createdById: 1,
    };
    
    const result = insertFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept form with select field and options', () => {
    const validData = {
      daycareId: 1,
      title: 'Survey',
      type: 'survey' as const,
      fields: [
        {
          id: 'rating',
          type: 'select' as const,
          label: 'How satisfied are you?',
          required: true,
          options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
        },
      ],
      createdById: 1,
    };
    
    const result = insertFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});

describe('Child Consent Schema (Production)', () => {
  it('should accept valid consent data', () => {
    const validData = {
      childId: 1,
      daycareId: 1,
      consentType: 'image_internal' as const,
      granted: true,
      grantedById: 2,
    };
    
    const result = insertChildConsentSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept all consent types', () => {
    const consentTypes = ['image_internal', 'image_external', 'trips', 'medical_treatment'] as const;
    
    for (const consentType of consentTypes) {
      const validData = {
        childId: 1,
        daycareId: 1,
        consentType,
        granted: true,
        grantedById: 2,
      };
      
      const result = insertChildConsentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    }
  });
});
