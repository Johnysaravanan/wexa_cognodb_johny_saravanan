# Local Blood-Link Emergency Network

**Live Demo:** [Insert your hosted UI link here]  
**Video Walkthrough:** [Insert your screen recording link here]

Local Blood-Link is an emergency response application designed to instantly match hospitals with local, compatible blood donors. Powered by a Neo4j/CognoDB graph database, it combines a Node.js/Express backend with a lightweight Vanilla JavaScript frontend to drastically reduce the time it takes to locate life-saving blood during critical shortages.

---

## 📖 The Use Case

During medical emergencies, finding a compatible blood donor involves multiple intersecting variables: the biological compatibility of the blood types, the geographic proximity of the donor to the hospital, the donor's current availability, and the time elapsed since their last donation. 

**Typical Application Flow:**
1. A hospital selects their location and the blood type they urgently need.
2. The backend dynamically updates the graph database to reflect this active emergency requirement.
3. The system executes a multi-hop traversal to find donors who are biologically compatible, currently available, and located within the exact same geographic region.
4. The frontend displays a prioritized list of the best matches, complete with direct contact details.

## 🕸️ Why a Graph Database?

Matching blood donors to emergency patients is fundamentally a network routing problem. 

In a traditional relational database (SQL), calculating blood compatibility requires computationally expensive `JOIN` operations through complex mapping tables. When combined with geographic constraints and temporal filtering (e.g., ensuring a 90-day rest period between donations), SQL queries become rigid and highly inefficient.

A graph database natively maps these complex, many-to-many compatibilities as direct relationships (e.g., `CAN_DONATE_TO`). This allows the application to perform rapid multi-hop traversals—starting at the hospital, finding the blood type needed, traversing to all compatible blood types, and instantly locating available donors in the same region.

---

## 🗄️ Data Model

The graph is structured around 4 core node labels and 5 specific relationship types.

```mermaid
graph LR
    %% Define Styles
    classDef donor fill:#dcfce7,stroke:#22c55e,stroke-width:2px;
    classDef hospital fill:#fee2e2,stroke:#ef4444,stroke-width:2px;
    classDef blood fill:#f3e8ff,stroke:#a855f7,stroke-width:2px;
    classDef region fill:#e0f2fe,stroke:#3b82f6,stroke-width:2px;

    H[Hospital]:::hospital
    R[Region]:::region
    D[Donor]:::donor
    B1[BloodType]:::blood
    B2[BloodType]:::blood

    H -- LOCATED_IN --> R
    H -- NEEDS_BLOOD --> B2
    D -- LIVES_IN --> R
    D -- HAS_BLOOD_TYPE --> B1
    B1 -- CAN_DONATE_TO --> B2


## 📸 Application Interface

The UI features intentional design choices including dedicated loading states, graceful error handling for backend outages, and empty-state messaging when no donors meet the criteria.

| Initial State | Active Graph Search |
| :---: | :---: |
| <img src="./Images/home.png" alt="Home Screen" width="400"/> | <img src="./Images/results.png" alt="Results Screen" width="400"/> |