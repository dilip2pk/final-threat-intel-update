## Plan: Enhanced Software Inventory with Detailed Views

Based on the reference screenshots from Microsoft Defender, the current Software Inventory page needs significant enhancements to show richer detail views including device components, security recommendations, and user vulnerability context.

### Current State

- Software list table with basic columns (name, vendor, version, machines, vulns, exposure)
- Clicking a software opens a simple dialog showing machines with device name, OS, user, exposure level, and CVEs
- Demo data in the edge function has limited machine fields

### What Will Change

#### 1. Enhanced Software Detail Panel (replaces simple dialog)

Instead of a basic dialog, clicking a software item opens a full detail view (like the Defender screenshots) with tabs:

- **Overview tab**: Entity summary (vendor, OS platform, detected devices, exposed devices), discovered weaknesses bar chart by severity, exposed devices count, top events list, threat context (exploits available), and impact score
- **Devices with Components tab**: Table listing machines with Name, OS, Last Seen, Criticality Level (High/Medium/Low with color indicators), and Tags
- **Security Recommendations tab**: List of actionable recommendations for the software (e.g., "Update to latest version", "Restrict usage to authorized devices")

#### 2. Enhanced Machine Detail View

Clicking a device in the devices tab opens a device detail panel (inspired by screenshot 3) showing:

- Device header with criticality badge and health state
- **VM Details**: Category, Type, Subtype, Primary User, Domain, OS, Health State, IP addresses, MAC address, First/Last seen
- **Security Assessments**: Exposure level, discovered vulnerabilities bar (Critical/High/Medium counts)
- **Logged on Users**: Most/Least/Newest logons with username
- **Device Health Status**: Last full scan, last quick scan, security intelligence version, engine version, antivirus mode

#### 3. Edge Function Updates

Expand the demo data in `defender-proxy` to include:

- `software-detail` action: Returns overview data (weaknesses breakdown, exposed device trends, top events)
- `software-recommendations` action: Returns security recommendations for a software
- `machine-detail` action: Returns full device info (VM details, security assessments, scan status, logged-on users)
- Richer sample machine data with `lastSeen`, `criticalityLevel`, `tags`, `ipAddresses`, `macAddress`, `firstSeen`, `healthState`, `domain`, `primaryUser`

#### 4. UI Layout Changes

- Replace the current `Dialog` with a full-page detail view using `react-router` or an inline panel
- Use a tabbed interface (`Tabs` component) for software detail and machine detail
- Add vulnerability severity bar (colored segments for Critical/High/Medium/Low)
- Add "Exposed devices" sparkline-style indicator in the main table (matching screenshot 1)
- Show user information prominently -- when a user is on a vulnerable/old version, display their name, the CVEs affecting them, and remediation steps

#### 5. Vulnerable User Highlighting

- In the devices list, users on old/vulnerable versions are flagged with a warning badge
- Each vulnerable user row shows: username, what CVEs affect them, what version they're running, and what version they should update to
- A dedicated "Vulnerable Users" summary section at the top of the devices tab showing count and most critical users

### Files to Create/Edit

- `**src/pages/SoftwareInventory.tsx**` -- Major rewrite: add tabbed detail view, device detail panel, vulnerable user highlighting
- `**supabase/functions/defender-proxy/index.ts**` -- Add new actions (`software-detail`, `software-recommendations`, `machine-detail`) with expanded demo data including user details, scan status, security recommendations and finally add an AI option can be used here 