# GeoArcheology Visualization Dashboard: User Guide

Welcome to the **GeoArcheology Visualization Dashboard**, an interactive web application designed to help you explore and analyze geographic trends, archaeological sites, and urban shifts over historical timelines.

---

## 1. Application Overview

The dashboard is structured into three main interactive sections to deliver a seamless data-driven exploration experience:

<img src="assets/dashboard_actual.png" alt="Application Interface Screenshot" width="640" style="border-radius: 8px; border: 1px solid #ccc; margin: 10px 0;" />

1. **Control Sidebar (Left Panel):** Used for loading datasets, controlling animation playback, and inspecting tabular data.
2. **Interactive Map (Center Panel):** Renders archaeological markers that dynamically resize and recolor based on the period, type, and timeline progression.
3. **Time Ruler (Bottom Panel):** A visual timeline representing the active era, markers, and chronological divisions.

---

## 2. Key Features and Controls

### A. Interactive Data Table
The Interactive Data Table serves as the primary catalog of all archaeological records loaded in the current project dataset.

<img src="assets/table_container.png" alt="Interactive Data Table" width="220" style="border-radius: 6px; border: 1px solid #ccc; margin: 10px 0;" />

* **Features:** It lists each site's **Type** (represented by color-coded indicator icons), **Location Name**, **Start Year**, and **End Year**.
* **Integration:** Selecting different files dynamically repopulates the table, providing a quick tabular summary of the active region's history.
* **Dashboard Overview:** By linking tabular listings directly to map markers and timeline indicators, the dashboard allows users to cross-reference geographic locations with exact dating periods at a glance.

### B. Data Source Management
You can load datasets using two methods:

<img src="assets/open_buttons.png" alt="Data Source Selection Buttons" width="220" style="border-radius: 6px; border: 1px solid #ccc; margin: 10px 0;" />

* **Open Project (Server Files):** Click this button to open a dropdown of pre-loaded CSV datasets on the server (e.g., Timna Data, Iron Age Cities, Decapolis).
* **Open Local File:** Click this button to upload a local `.csv` file directly from your computer. The dashboard will automatically parse and display it.

### C. Animation and Playback Controls
Navigate through chronological events smoothly:

<img src="assets/player_controls.png" alt="Playback Controls" width="200" style="border-radius: 6px; border: 1px solid #ccc; margin: 10px 0;" />

* **Reset (🔄):** Jumps the timeline back to the initial start year.
* **Previous Event (⏮️):** Moves the timeline step-by-step backward to the previous archaeological milestone.
* **Play / Pause (▶️ / ⏸️):** Automatically animates the map over the timeline to show dynamic urban shifts.
* **Next Event (⏭️):** Steps the timeline forward to the next chronological event.

### D. Time Ruler & Period Strip
* **Interactive Marker:** The marker shifts along the timeline as the year progresses.
* **Period Indicators:** Visual colored strips segmenting historical eras (e.g., Iron Age I, Iron Age II, etc.) to give immediate historical context.
* **Year Display:** Large display highlighting the active historical year.

<img src="assets/timeline_actual.png" alt="Time Ruler Footer" width="400" style="border-radius: 6px; border: 1px solid #ccc; margin: 10px 0;" />

---

## 3. Responsive & Mobile Support
The dashboard is fully optimized for mobile devices:
* **Mobile Drawer Sidebar:** A hamburger button collapses the control panel on mobile screens, leaving the map clear.
* **Floating Map Navigation:** Floating navigation buttons appear directly on the map for easy one-handed stepping through events.
