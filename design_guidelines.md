# Roolit - Daycare Management System Design Guidelines

## Design Approach
**Selected Approach:** Design System (Material Design-inspired with friendly, approachable adaptations)

**Rationale:** This is a utility-focused dashboard application with heavy data entry, form interactions, and information display. The system needs to be efficient for daily use by staff while being intuitive for parents. Material Design provides the structure needed for complex dashboards while allowing warm, child-friendly customization.

**Core Principles:**
- Clarity over decoration - staff need to enter data quickly
- Role-specific navigation and views
- Warm, approachable aesthetics suitable for a childcare context
- Mobile-first for on-the-go staff usage

## Typography System

**Font Families:**
- Headings: Inter (600, 700 weights)
- Body: Inter (400, 500 weights)
- Use via Google Fonts CDN

**Hierarchy:**
- Page Titles: text-2xl md:text-3xl font-bold
- Section Headings: text-xl font-semibold
- Card Titles: text-lg font-semibold
- Body Text: text-base
- Helper Text: text-sm
- Labels: text-sm font-medium

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing (2-4): Between related elements
- Component spacing (6-8): Within cards, forms
- Section spacing (12-16): Between major sections

**Grid System:**
- Dashboard container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Main content area: Sidebar (hidden on mobile, w-64 on desktop) + main content area
- Cards grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6

## Component Library

### Navigation
**Top Navigation Bar:**
- Fixed header with app logo "🔐 Roolit", user profile dropdown, role badge
- Height: h-16
- Include logout button in dropdown

**Sidebar (Desktop):**
- Collapsible on tablet/mobile (hamburger menu)
- Role-specific menu items with icons (Font Awesome):
  - Staff: Dashboard, Children, Add Entry, Trips
  - Guardian: My Children, Trips
  - Admin: Dashboard, Children, Staff, Reports, Settings

### Cards & Data Display
**Child Profile Cards:**
- Rounded corners (rounded-lg), elevation shadow
- Child avatar placeholder (circular, w-16 h-16)
- Name, age, group displayed prominently
- Quick stats (entries today, pending trips)
- "View Details" button

**Daily Entry Cards:**
- Timeline-style display with timestamp on left
- Entry type icon (sleep 😴, meal 🍽️, play 🎨, incident ⚠️)
- Entry value and staff note
- Compact design for scrolling through day's activities

**Trip Cards:**
- Banner-style with trip title, date, location
- Cost badge if applicable
- Description text
- For guardians: Approve/Decline buttons (green/red)
- For staff: Participant count, response status

### Forms
**Entry Creation Form:**
- Clean, single-column layout
- Dropdown for child selection (with search/filter)
- Radio buttons for entry type (with icons)
- Textarea for notes (4 rows)
- Submit button (primary action, full-width on mobile)

**Trip Creation Form:**
- Two-column on desktop, stacked on mobile
- Date picker, location, cost, group selection
- Large textarea for description
- "Create Trip" primary button

### Data Tables (Admin/Staff)
**Children List:**
- Responsive table with columns: Name, Age, Group, Guardian(s), Actions
- Sortable headers
- Row hover state
- Action buttons (view, edit) as icons

**Trip Responses Table:**
- Columns: Guardian Name, Child, Response, Date
- Status badges (approved/declined/pending)

### Buttons & Actions
**Primary Actions:** Solid background, font-medium, px-6 py-2, rounded-md
**Secondary Actions:** Outlined style, same padding
**Danger Actions:** For delete/decline operations
**Icon Buttons:** For compact actions in tables (p-2, rounded-full on hover)

### Status & Feedback
**Badges:**
- Role badges (admin/staff/guardian) in top nav
- Entry type indicators
- Trip response status
- Rounded-full, px-3 py-1, text-xs font-medium

**Empty States:**
- Centered icon, heading, description
- "Add First Entry" or "No Trips Yet" messaging
- Friendly, encouraging tone

**Loading States:**
- Skeleton screens for cards
- Spinner for form submissions

### Dashboard Layouts

**Staff Dashboard:**
- Top row: Quick stats cards (3-4 across on desktop)
  - Total children today, pending entries, upcoming trips
- Main area: Recent activity feed + quick entry form
- Sidebar: Today's schedule, notifications

**Guardian Dashboard:**
- Hero-style welcome with child's name(s)
- Tab navigation if multiple children
- Timeline of today's activities
- Pending trip requests (if any) prominently displayed

**Admin Dashboard:**
- Analytics cards (grid layout)
- Staff activity overview
- System health indicators
- Quick access to all management functions

## Mobile Optimization
- Bottom navigation for mobile (guardians)
- Collapsible sidebar with hamburger menu
- Stack all multi-column layouts to single column
- Larger touch targets (min h-12 for buttons)
- Fixed "Add Entry" FAB for staff on mobile (bottom-right)

## Icons
**Library:** Font Awesome (via CDN)
**Usage:**
- Navigation items (fa-home, fa-child, fa-bus, fa-clipboard)
- Entry types (fa-bed, fa-utensils, fa-gamepad, fa-exclamation-triangle)
- Actions (fa-plus, fa-edit, fa-trash, fa-check, fa-times)
- Status (fa-check-circle, fa-clock, fa-info-circle)

## Images
**No hero images needed** - this is a dashboard application, not a marketing site.

**Avatar Placeholders:** Use colored circles with child's initials for profile cards