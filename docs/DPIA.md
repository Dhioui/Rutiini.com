# Data Protection Impact Assessment (DPIA)
## Rutiini - Daycare Management System

**Document Version:** 1.0  
**Date:** December 4, 2025  
**Data Controller:** [Municipality Name] — *placeholder, not filled in*

> **This document is a draft and has not been approved.** The controller is still
> a placeholder, the approval section below is empty, and the risk assessment does
> not yet reflect the findings of the September 2026 code audit. Nothing in it
> should be relied on as evidence that a risk has been assessed or accepted.

**System:** Rutiini Daycare Management Platform  
**Assessment Period:** 2025-2026  

---

## 1. Description of Processing

### 1.1 Purpose of Processing
Rutiini is a multi-tenant daycare management system designed to:
- Manage child enrollment and attendance records
- Track daily activities (meals, sleep, playtime, incidents)
- Facilitate communication between daycare staff and guardians
- Report and track absences and illnesses
- Coordinate field trips and obtain guardian consent
- Generate administrative reports for daycare operations

### 1.2 Categories of Data Subjects
| Category | Description |
|----------|-------------|
| Children (0-7 years) | Primary subjects of care records |
| Guardians/Parents | Legal representatives with system access |
| Staff | Daycare employees and administrators |
| Daycare Leaders | Management personnel |

### 1.3 Categories of Personal Data

#### Children's Data
- Full name, date of birth
- Allergies and dietary restrictions
- Medical notes and health information
- Daily activity records (meals, sleep, incidents)
- Attendance records
- Group assignments

#### Guardian Data
- Full name, email address
- Phone number (optional)
- Authentication credentials (hashed)
- Communication history with staff
- Linked children relationships

#### Staff Data
- Full name, email address
- Role and permissions
- Activity logs (entries created)
- Authentication credentials (hashed)
- Login/logout timestamps

### 1.4 Data Recipients
| Recipient | Purpose | Legal Basis |
|-----------|---------|-------------|
| Municipality administration | Operational oversight | Public interest (GDPR Art. 6(1)(e)) |
| Daycare staff | Daily operations | Employment contract |
| Guardians | Child information access | Parental rights |
| Backup/hosting provider | Technical storage | Processor agreement |

### 1.5 Data Retention Periods
| Data Category | Retention Period | Legal Requirement |
|---------------|------------------|-------------------|
| Audit logs | 12 months | VAHTI compliance |
| Messages | 12 months | Operational needs |
| Trip records | 12 months | Liability purposes |
| Absence records | 24 months | Operational needs |
| Care time reservations | 36 months | Reconciling a later billing period |
| Realised attendance | 36 months | Reconciling a later billing period |
| Child records | **No automatic end of life** | See the warning below |

> **These are the defaults the code applies, and four of them contradicted what
> this document previously claimed.** Messages and trips were stated as 24 months
> and are 12; absences were stated as 12 and are 24; care time was not listed at
> all. Every period is overridable per deployment through the `RETENTION_*`
> environment variables, so the values in force are whatever that deployment sets,
> not what is written here.
>
> **Child records, consents, form submissions and contracts have no automatic
> deletion at all.** The "enrollment + 5 years" line above describes an intention,
> not a mechanism: nothing in the application ends a child's record when their
> place ends. Retention for those must be decided per document type and carried
> out deliberately.
| User accounts | Duration of relationship | Operational needs |

---

## 2. Necessity and Proportionality Assessment

### 2.1 Legal Basis for Processing
- **GDPR Article 6(1)(c)**: Legal obligation (child welfare regulations)
- **GDPR Article 6(1)(e)**: Public interest (municipal daycare services)
- **Varhaiskasvatuslaki (540/2018)**: Documentation requirements. This previously cited the Päivähoitolaki 36/1973, which 540/2018 repealed; the retention consequences below must be re-checked against the act that is actually in force.
- **VAHTI Requirements**: Finnish government IT security standards

### 2.2 Purpose Limitation
All data processing is strictly limited to:
- Daycare operational management
- Child safety and welfare monitoring
- Guardian communication
- Regulatory compliance

### 2.3 Data Minimization Measures
- Only essential fields collected (no unnecessary data)
- Optional fields clearly marked
- Regular data cleanup via automated retention policies
- No cross-tenant data sharing

### 2.4 Storage Limitation
- Automated daily CRON job removes expired data
- Configurable retention periods per data category
- Secure deletion with audit trail

---

## 3. Risk Assessment

### 3.1 Risk Matrix

| Risk | Likelihood | Impact | Risk Level | Mitigation |
|------|------------|--------|------------|------------|
| Unauthorized data access | Low | High | Medium | JWT auth, role-based access, tenant isolation |
| Data breach | Low | Critical | High | Encryption, security headers, rate limiting |
| Incorrect data modification | Low | Medium | Low | Audit logging, validation |
| Data loss | Very Low | High | Low | Database backups, cloud hosting |
| Cross-tenant data leakage | Very Low | Critical | Medium | Strict daycareId filtering |
| Session hijacking | Low | High | Medium | Secure cookies, token validation |
| Brute force attacks | Medium | Medium | Medium | Account lockout (5 attempts/15min) |
| SQL injection | Very Low | Critical | Low | Parameterized queries (Drizzle ORM) |
| XSS attacks | Low | High | Medium | Content Security Policy, input sanitization |

### 3.2 Detailed Risk Analysis

#### 3.2.1 Unauthorized Access Risk
**Current Controls:**
- JWT-based authentication with daycareId embedded
- Role-based access control (Guardian, Staff, DaycareLeader, SuperAdmin)
- Super Admin restricted to anonymized statistics only
- All API endpoints enforce daycareId filtering

**Residual Risk:** Low

#### 3.2.2 Data Breach Risk
**Current Controls:**
- Helmet security headers (CSP, X-Frame-Options, XSS Protection)
- HTTPS encryption in transit
- Database-level encryption at rest (Neon PostgreSQL)
- Rate limiting (100/15min general, 5/15min auth)
- Account lockout after 5 failed attempts

**Residual Risk:** Low-Medium

#### 3.2.3 Cross-Tenant Data Leakage
**Current Controls:**
- Every database query includes daycareId WHERE clause
- Server-side validation of user's daycareId
- No shared data between tenants
- Separate login flow per daycare

**Residual Risk:** Very Low

### 3.3 Overall Residual Risk Assessment

After implementing all technical and organizational measures outlined in this document, the overall residual risk assessment is:

| Category | Initial Risk | Post-Mitigation Risk | Acceptable |
|----------|-------------|---------------------|------------|
| Data confidentiality | High | Low | Yes |
| Data integrity | Medium | Low | Yes |
| Data availability | Medium | Low | Yes |
| Children's rights | High | Very Low | Yes |
| Cross-tenant security | Critical | Very Low | Yes |

**Conclusion:** The residual risks are at acceptable levels for processing to proceed. The combination of multi-tenant isolation, role-based access control, encryption, and audit logging reduces risks to levels proportionate with the public interest in providing quality daycare services.

### 3.4 Controller Decision Statement

The Data Controller has assessed this DPIA and concludes:

1. **Processing Necessity:** The processing is necessary for the performance of public daycare services and cannot be reasonably achieved without processing the personal data described.

2. **Risk Proportionality:** The residual risks after implementing the described measures are proportionate to the benefits of the processing and acceptable given the public interest nature of daycare services.

3. **Decision:** Based on this assessment, the Data Controller accepts the residual risks and approves the processing activities described in this DPIA.

4. **Commitment:** The Data Controller commits to:
   - Implementing all measures described in Section 4
   - Conducting regular reviews as specified in Section 7
   - Notifying the supervisory authority of any material changes
   - Maintaining accountability records as required by GDPR Article 30

**Controller Acknowledgment:**

_I, the undersigned Data Controller representative, confirm that I have reviewed this Data Protection Impact Assessment in full and accept responsibility for ensuring the processing proceeds in accordance with the measures described herein._

| Field | Value |
|-------|-------|
| Controller Representative Name | _________________________ |
| Title | _________________________ |
| Date | _________________________ |
| Signature | _________________________ |

---

## 4. Technical and Organizational Measures

### 4.1 Security by Design
| Measure | Implementation |
|---------|----------------|
| Multi-tenant isolation | All queries filtered by daycareId |
| Authentication | JWT with embedded tenant context |
| Password security | bcrypt hashing (10 rounds), strong password policy |
| Session management | Token-based with invalidation support |
| Input validation | Zod schemas on all API inputs |
| Output encoding | React automatic XSS protection |

### 4.2 Access Controls
| Role | Access Level |
|------|--------------|
| Guardian | Own children's data only |
| Staff | All children in assigned daycare |
| DaycareLeader | Full daycare management + reports |
| SuperAdmin | Anonymized system-wide statistics only |

### 4.3 Audit Logging
- All CRUD operations logged
- Login/logout events tracked
- Access denied events recorded
- Entity IDs hashed in logs (SHA-256)
- Metadata sanitized to prevent PII exposure
- 12-month retention with automated cleanup

### 4.4 Data Subject Rights Implementation
| Right | Implementation |
|-------|----------------|
| Access (Art. 15) | Self-service data export via Settings > Privacy |
| Rectification (Art. 16) | Profile editing available to all users |
| Erasure (Art. 17) | Deletion request workflow with admin approval |
| Portability (Art. 20) | CSV export of personal data |
| Information (Art. 13-14) | Privacy policy and terms of service links |

### 4.5 Organizational Measures
- Staff training on data protection
- Documented data processing procedures
- Incident response procedures
- Regular security reviews
- Privacy policy communicated to all users

---

## 5. GDPR Compliance Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| Lawful basis identified | ✅ | Art. 6(1)(c) and (e) |
| Purpose limitation | ✅ | Strictly daycare operations |
| Data minimization | ✅ | Only essential data collected |
| Accuracy | ✅ | Users can update their data |
| Storage limitation | ✅ | Automated retention enforcement |
| Integrity & confidentiality | ✅ | Encryption, access controls |
| Accountability | ✅ | Audit logs, documentation |
| Data subject rights | ✅ | Export and deletion workflows |
| Data breach notification | ⚠️ | Process defined, needs testing |
| Privacy by design | ✅ | Multi-tenant isolation |
| DPIA conducted | ✅ | This document |

---

## 6. Consultation and Approval

### 6.1 Stakeholders Consulted
- Data Protection Officer (DPO)
- IT Security Team
- Daycare Operations Management
- Legal Department

### 6.2 Supervisory Authority Consultation
Prior consultation with the Finnish Data Protection Ombudsman is not required as:
- Adequate safeguards are in place
- Residual risks have been mitigated to acceptable levels
- Processing aligns with established practices for public daycare services

### 6.3 Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Data Protection Officer | | | |
| IT Security Lead | | | |
| Project Manager | | | |
| Municipal Administration | | | |

---

## 7. Review Schedule

This DPIA shall be reviewed:
- Annually (minimum)
- Upon significant system changes
- Following any security incidents
- When processing purposes change
- Upon request by supervisory authority

**Next Scheduled Review:** December 2026

---

## 8. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | December 4, 2025 | System Implementation Team | Initial DPIA |

---

## Appendices

### Appendix A: System Architecture Overview
- **Frontend:** React 18 with TypeScript
- **Backend:** Express.js with TypeScript
- **Database:** PostgreSQL (Neon hosted)
- **ORM:** Drizzle ORM
- **Mobile:** Capacitor (iOS/Android)
- **Hosting:** Self-hosted or container platform of the controller's choosing (EU region); see README.md

### Appendix B: Data Flow Diagram
```
[Guardian App] ←→ [API Server] ←→ [PostgreSQL Database]
     ↓                 ↓
[Staff App]    [Authentication]
     ↓                 ↓
[Admin App]    [Audit Logging]
```

### Appendix C: Security Headers Configuration
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' https://*.neon.tech;
  frame-ancestors 'none';
  form-action 'self';

X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Appendix D: Contact Information
**Data Protection Officer:**  
[Contact details to be added by deploying municipality]

**Technical Support:**  
support@rutiini.com

**Security Incidents:**  
security@rutiini.com
