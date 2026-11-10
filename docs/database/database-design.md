# SortSense Database Design Documentation

**Project:** SortSense – Smart Campus Waste Management System  
**Document:** Entity Relationship Diagram (ERD) Documentation  
**Version:** 1.1  
**Database Platform:** Supabase (PostgreSQL)  
**Status:** Database Design Proposal  
**Scope:** Locations, Stations, Bins, Hardware Monitoring, Waste Disposal Events, and Maintenance Records

---

# 1. Introduction

## 1.1 Project Overview

SortSense is a smart waste management system designed to improve waste sorting practices and waste collection monitoring in campus environments.

The system integrates hardware sensors, AI-based waste classification, a cloud database, and a web dashboard to provide real-time information about waste disposal activities and bin availability.

The system is designed around the following core functions:

1. **Location Management:** Maintain information about campus locations and installed SortSense stations.
2. **Waste Classification:** Identify waste categories using an AI classification system and record verified disposal events.
3. **Bin Monitoring:** Monitor the current fill percentage and operational condition of individual bins.
4. **Hardware Monitoring:** Track the connectivity and operational status of ESP32 controllers and their associated sensors.
5. **Historical Data:** Preserve sensor measurements, waste disposal events, and bin emptying records.
6. **Dashboard Integration:** Provide structured information for staff to monitor waste management activities and identify bins requiring attention.

## 1.2 Database Design Objectives

The database is designed to:

- Support multiple SortSense installations across different campus locations.
- Allow each station to contain multiple waste bins.
- Associate sensors with individual bins.
- Maintain both current bin status and historical sensor measurements.
- Record AI classification results and verified waste disposal events.
- Track maintenance activities, including bin emptying.
- Support staff authentication and role-based access through Supabase Auth.
- Preserve data consistency through primary keys, foreign keys, unique constraints, and validation rules.

## 1.3 Database Architecture

The database consists of 11 application entities and one external authentication entity managed by Supabase.

| Logical Group | Entities | Responsibility |
|---|---|---|
| Location Management | `locations`, `stations` | Organize physical installation locations and stations |
| Waste Management | `bins`, `waste_categories` | Define waste bins and their accepted categories |
| Hardware Monitoring | `devices`, `sensors` | Register controllers and sensors |
| Status and Historical Data | `bin_status`, `sensor_readings` | Maintain current conditions and historical measurements |
| Events and Users | `drop_events`, `bin_emptying_events`, `profiles` | Record disposal activities, maintenance, and staff information |
| External Authentication | `auth.users` | Manage user authentication accounts |

---

# 2. Entity Definitions and Attributes

## 2.1 locations

**Purpose:** Stores information about the physical locations where SortSense stations are installed.

A location represents a geographical or organizational area within the campus.

Examples include:
- Library.
- Dormitory.
- Academic building.
- Cafeteria.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| location_id | UUID | PK | Unique identifier for each location |
| location_name | VARCHAR | | Name of the location |
| description | TEXT | | Additional information about the location |
| latitude | DECIMAL | | Geographic latitude |
| longitude | DECIMAL | | Geographic longitude |
| is_active | BOOLEAN | | Indicates whether the location is active |
| created_at | TIMESTAMPTZ | | Timestamp when the location was created |

### Design Rationale

Locations are separated from stations because a single physical location may contain multiple SortSense installations.

For example, a library could have different stations on its ground floor and second floor.

By separating these entities, location information does not need to be duplicated across multiple station records.

### Relationship

One location can contain zero or many stations. Each station must belong to exactly one location.

---

## 2.2 stations

**Purpose:** Represents an individual SortSense installation at a specific location.

A station is the main physical unit that groups waste bins, sensors, and an ESP32 controller.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| station_id | UUID | PK | Unique identifier for each station |
| location_id | UUID | FK | References the location where the station is installed |
| station_code | VARCHAR | AK | Unique station identification code |
| station_name | VARCHAR | | Display name of the station |
| installation_date | DATE | | Date when the station was installed |
| is_active | BOOLEAN | | Indicates whether the station is active |

### Design Rationale

A location and a station represent two different concepts.

A location identifies where the system is installed, while a station identifies an individual SortSense installation.

This allows SortSense to:
- Support multiple stations within one location.
- Identify individual installations.
- Track bins associated with each station.
- Associate a controller with a specific installation.

### Example

| station_code | station_name | Location |
|---|---|---|
| ST-LIB-001 | Library Ground Floor | Main Library |
| ST-LIB-002 | Library Second Floor | Main Library |
| ST-DORM-001 | Dormitory Entrance | Dormitory |

### Relationship

One location can contain multiple stations. Each station belongs to exactly one location.

---

## 2.3 bins

**Purpose:** Represents each physical waste compartment managed by a SortSense station.

Each bin has an assigned waste category and a defined storage capacity.

The current design supports four waste categories:

- Plastic
- Paper
- Metal
- General Waste

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| bin_id | UUID | PK | Unique identifier for each bin |
| station_id | UUID | FK | References the station to which the bin belongs |
| category_id | UUID | FK | References the waste category assigned to the bin |
| capacity_liters | DECIMAL | | Maximum storage capacity in liters |
| is_active | BOOLEAN | | Indicates whether the bin is active |
| created_at | TIMESTAMPTZ | | Timestamp when the bin record was created |

### Design Rationale

A station contains multiple individual bins. Therefore, each bin needs its own unique identity.

This allows SortSense to monitor the fill level of each waste compartment independently.

### Composite UNIQUE Constraint

`UNIQUE (station_id, category_id)`

This prevents a station from having multiple bins assigned to the same waste category.

For example, ST001 cannot have two Plastic bins under the current design.

However, this constraint does not guarantee that every station has all four required categories. The station provisioning process must validate that requirement.

### Relationship

- Each bin belongs to exactly one station.
- Each bin is assigned exactly one waste category.
- One station can contain multiple bins.
- One waste category can be assigned to multiple bins across different stations.

---

## 2.4 waste_categories

**Purpose:** Defines the waste categories supported by SortSense.

This entity provides a centralized list of waste types that can be assigned to bins and referenced by AI classification events.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| category_id | UUID | PK | Unique identifier for each waste category |
| category_name | VARCHAR | AK | Unique waste category name |
| description | TEXT | | Explanation of the waste category |
| indicator_color | VARCHAR | | Color associated with the category's visual indicator |
| is_active | BOOLEAN | | Indicates whether the category is supported |

### Design Rationale

Instead of storing category names directly inside `bins` and `drop_events`, SortSense uses a separate entity.

This provides consistency throughout the database.

For example, if the category name or indicator color changes, it only needs to be updated in one place.

The category information can also be reused by:
- AI classification.
- Bin identification.
- LED indicator activation.
- Web dashboard visualization.
- Waste analytics.

### Relationship

One waste category can be associated with multiple bins and multiple disposal events.

---

## 2.5 bin_status

**Purpose:** Stores the latest known condition of each bin.

This entity represents the current state of a bin rather than its complete measurement history.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| bin_id | UUID | PK, FK | References the bin whose current status is monitored |
| fill_percentage | DECIMAL(5,2) | | Latest calculated bin fill percentage |
| measured_at | TIMESTAMPTZ | | Time of the latest valid fill-level measurement |
| updated_at | TIMESTAMPTZ | | Time when the status record was last updated |
| operational_status | ENUM | | Current operational condition of the bin monitoring system |

### ENUM: operational_status

- `NORMAL`: The bin monitoring system is functioning normally.
- `SENSOR_ERROR`: A sensor associated with the bin has an error or is not providing valid measurements.

### CHECK Constraint

`0 ≤ fill_percentage ≤ 100`

### Design Rationale

The dashboard needs to retrieve the current condition of each bin without processing the entire historical sensor dataset.

For example:

| Bin | Current Fill | Operational Status |
|---|---:|---|
| Plastic | 75% | NORMAL |
| Paper | 40% | NORMAL |
| Metal | 20% | NORMAL |
| General Waste | 90% | SENSOR_ERROR |

Operational status is important because a sensor error should not be interpreted as an empty or healthy bin.

For example, a bin may have a last valid measurement of 90%, but its sensor may subsequently stop communicating. The dashboard should display both the last known fill level and the sensor error.

### Why is bin_id both PK and FK?

- As a primary key, it ensures that each bin can have at most one current status record.
- As a foreign key, it ensures that the status belongs to an existing bin.

This creates a one-to-one maximum relationship between `bins` and `bin_status`.

A bin can temporarily exist without a status record during initial provisioning. The setup process should create the initial status record before the bin becomes operational.

### Relationship

Each status record belongs to exactly one bin. Each bin can have zero or one current status record.

---

## 2.6 sensors

**Purpose:** Stores information about the sensors installed on individual bins.

The current hardware design assigns two sensor types to each bin:

1. **ToF Sensor:** Measures the distance between the sensor and the waste surface to calculate the bin's fill percentage.
2. **IR Break-beam Sensor:** Detects when an object passes through the disposal mechanism for waste-drop verification.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| sensor_id | UUID | PK | Unique identifier for each sensor |
| bin_id | UUID | FK | References the bin monitored by the sensor |
| sensor_type | ENUM | | Defines the sensor type |
| hardware_identifier | VARCHAR | AK | Unique hardware identifier |
| is_active | BOOLEAN | | Indicates whether the sensor is active |
| last_read_at | TIMESTAMPTZ | | Timestamp of the latest sensor reading |

### ENUM: sensor_type

- `TOF`
- `IR`

### Composite UNIQUE Constraints

`UNIQUE (bin_id, sensor_type)`

This ensures that each bin can have at most one sensor of each supported type.

Example:

| bin_id | sensor_type |
|---|---|
| BIN001 | TOF |
| BIN001 | IR |
| BIN002 | TOF |
| BIN002 | IR |

A second ToF sensor cannot be registered for BIN001 under the current design.

Additionally:

`UNIQUE (sensor_id, bin_id)`

This composite uniqueness supports the composite foreign-key relationship defined in `drop_events`.

Although `sensor_id` is already a primary key, the composite key allows another entity to reference the exact combination of sensor identity and assigned bin.

### Design Rationale

Sensors are individual hardware components, not simply attributes of a bin.

Keeping sensor information separate allows the system to:
- Identify which sensor generated a measurement.
- Track sensor activity.
- Monitor the latest communication time.
- Associate sensor failures with a particular bin.
- Distinguish between fill-level measurements and disposal verification signals.

### Relationship

One bin can have multiple sensors. Each sensor belongs to exactly one bin.

Under the current two-sensor design, each bin should have one ToF sensor and one IR sensor after hardware provisioning.

---

## 2.7 sensor_readings

**Purpose:** Stores historical measurements generated by sensors.

Unlike `bin_status`, which contains the latest known condition, this entity preserves individual sensor measurements over time.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| reading_id | UUID | PK | Unique identifier for each sensor reading |
| sensor_id | UUID | FK | References the sensor that generated the reading |
| distance_mm | DECIMAL | | Measured distance in millimeters |
| fill_percentage | DECIMAL(5,2) | | Calculated fill percentage associated with the measurement |
| recorded_at | TIMESTAMPTZ | | Timestamp when the measurement was recorded |

### CHECK Constraints

- `distance_mm >= 0`
- `0 ≤ fill_percentage ≤ 100`

### Design Rationale

SortSense needs historical data to understand how bin usage changes over time.

For example, a ToF sensor may produce these readings:

| Time | Distance | Fill Percentage |
|---|---:|---:|
| 08:00 | 450 mm | 10% |
| 08:15 | 400 mm | 20% |
| 08:30 | 340 mm | 35% |
| 08:45 | 270 mm | 50% |
| 09:00 | 200 mm | 65% |

Each measurement is inserted as a new record.

This allows SortSense to:
- Display historical fill-level charts.
- Estimate how quickly a bin fills up.
- Identify high-usage bins.
- Analyze waste generation patterns.
- Support future predictive maintenance and collection scheduling.

### Why not store everything in bin_status?

`bin_status` represents the latest state, while `sensor_readings` preserves the historical measurements.

If every new measurement overwrites the previous value, the system loses the historical information required for analytics.

| Entity | Responsibility |
|---|---|
| bin_status | Current bin condition |
| sensor_readings | Historical sensor measurements |

### Relationship

One sensor can generate multiple historical readings. Each reading belongs to exactly one sensor.

**Design assumption:** The `distance_mm` and `fill_percentage` attributes are intended primarily for ToF measurements. IR beam interruptions are represented through verified disposal events rather than being stored as fill-level readings.

---

## 2.8 drop_events

**Purpose:** Records individual waste disposal events detected and processed by the SortSense system.

This entity connects the AI classification result with the actual bin that receives the waste.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| event_id | UUID | PK | Unique identifier for each disposal event |
| actual_bin_id | UUID | FK | References the bin that received the waste |
| classified_category_id | UUID | FK | References the category predicted by the AI model |
| trigger_sensor_id | UUID | FK | References the sensor that detected the disposal |
| classification_confidence | DECIMAL(5,4) | | AI model confidence score |
| classified_at | TIMESTAMPTZ | | Time when AI classification occurred |
| verified_at | TIMESTAMPTZ | | Time when disposal was verified |
| created_at | TIMESTAMPTZ | | Time when the event record was created |

### CHECK Constraint

`0 ≤ classification_confidence ≤ 1`

### Design Rationale

A waste disposal event involves multiple components:

1. The camera captures an image of the waste.
2. The AI inference backend predicts its waste category.
3. The ESP32 activates the corresponding visual indicator.
4. The IR break-beam sensor detects the disposal.
5. The backend records the verified disposal event in the cloud database.

The `drop_events` entity stores the relevant information from this process.

### Why are actual_bin_id and classified_category_id both necessary?

They represent different information.

- `classified_category_id` represents what the AI predicted.
- `actual_bin_id` represents where the waste was actually deposited.

For example:

| AI Classification | Actual Destination | Result |
|---|---|---|
| Plastic | Plastic bin | Correct sorting |
| Paper | Paper bin | Correct sorting |
| Plastic | General Waste bin | Potential sorting error |
| Metal | Plastic bin | Potential sorting error |

The category assigned to the actual destination bin can be retrieved through `bins.category_id`.

This makes it possible to compare the predicted category with the actual destination category.

### Composite Foreign Key Validation

A critical business rule is:

**The sensor that triggers a disposal event must belong to the same bin identified as the actual destination.**

Three independent foreign keys are not sufficient to enforce this condition.

For example, suppose the database contains:

**sensors**

| sensor_id | bin_id | sensor_type |
|---|---|---|
| SEN001 | BIN001 | IR |
| SEN002 | BIN002 | IR |

A disposal event containing:

| actual_bin_id | trigger_sensor_id |
|---|---|
| BIN001 | SEN002 |

would pass two independent foreign-key checks because both records exist.

However, the relationship is incorrect because SEN002 belongs to BIN002.

To prevent this inconsistency, the design uses a composite foreign key.

**In sensors:**

`UNIQUE (sensor_id, bin_id)`

**In drop_events:**

`FOREIGN KEY (trigger_sensor_id, actual_bin_id)`

References:

`sensors(sensor_id, bin_id)`

This ensures that the sensor and bin referenced by the disposal event must match the same sensor-to-bin assignment.

The individual foreign key from `actual_bin_id` to `bins.bin_id` should also remain in place.

### IR Sensor Validation

The composite foreign key ensures that the triggering sensor belongs to the correct bin, but it does not guarantee that the sensor is an IR sensor.

Therefore, an additional business rule is required:

`trigger_sensor_id` must reference a sensor where `sensor_type = 'IR'`.

This condition should be enforced through database-level validation, such as a trigger, or through trusted backend validation.

A normal foreign key cannot enforce a condition based on the referenced row's sensor type.

### Verification Rule

Only successfully verified disposal events should be stored as completed records in this entity.

If classification occurs but disposal is not detected, the system should not count it as a completed disposal event.

The distinction between classification and verification is important for maintaining reliable waste statistics.

### Relationship

- Each disposal event references exactly one actual destination bin.
- Each disposal event references exactly one classified waste category.
- Each disposal event references exactly one triggering sensor.
- One bin can receive multiple disposal events.
- One waste category can appear in multiple disposal events.
- One sensor can trigger multiple disposal events.

---

## 2.9 devices

**Purpose:** Stores information about the ESP32-S3 controllers responsible for communicating with SortSense hardware.

A device represents the main controller associated with a station.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| device_id | UUID | PK | Unique identifier for each controller |
| station_id | UUID | FK, AK | References the station controlled by the device |
| device_type | VARCHAR | | Type of controller hardware |
| hardware_identifier | VARCHAR | AK | Unique hardware identifier |
| firmware_version | VARCHAR | | Currently installed firmware version |
| connection_status | ENUM | | Current controller connectivity state |
| last_seen_at | TIMESTAMPTZ | | Timestamp of the latest communication with the cloud |

### ENUM: connection_status

- `ONLINE`
- `OFFLINE`

### Design Rationale

The ESP32-S3 is responsible for communicating with the hardware components and sending information to the backend.

The system needs to identify each controller independently to monitor whether a station is connected.

Example:

| device_id | station_id | connection_status |
|---|---|---|
| DEV001 | ST001 | ONLINE |
| DEV002 | ST002 | OFFLINE |

The dashboard can use this information to identify stations that are no longer communicating with the cloud.

### Why is station_id both FK and AK?

- As an FK, it associates the controller with an existing station.
- As an AK, it ensures that the same station cannot appear in multiple device records.

Without the unique constraint, multiple controllers could be assigned to the same station.

The current design assumes one ESP32 controller per station.

### Cardinality

`stations (1) → devices (0..1)`

This means:

- A station can exist before its ESP32 controller is registered.
- A station can have one registered controller.
- A station cannot have multiple registered controllers under the current design.
- Every device must belong to exactly one existing station.

The ERD must show a circle and a single bar at the device end, representing zero or one.

---

## 2.10 profiles

**Purpose:** Stores additional application-specific information about authenticated SortSense users.

This entity represents staff information used by the SortSense application.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| user_id | UUID | PK, FK | References the authenticated Supabase user |
| full_name | VARCHAR | | Full name of the staff member |
| role | VARCHAR | | Application role assigned to the user |
| is_active | BOOLEAN | | Indicates whether the user is active |
| created_at | TIMESTAMPTZ | | Timestamp when the profile was created |

### Design Rationale

SortSense requires staff access to administrative and maintenance functions.

For example:
- Administrators may manage stations and review analytics.
- Janitors may monitor bin conditions and record emptying activities.

The `profiles` entity stores the information necessary for application-level user management.

### Relationship with Supabase Authentication

Supabase already provides an authentication system through its managed entity:

`auth.users`

The SortSense application does not need to create another authentication entity.

Instead, `profiles.user_id` references `auth.users.id`.

The relationship is:

`auth.users (1) → profiles (0..1)`

This means:

- An authenticated user may temporarily exist without an application profile.
- Each profile belongs to exactly one authenticated user.
- Each authenticated user can have at most one profile.

The `user_id` attribute is both PK and FK because it uniquely identifies the profile while referencing the corresponding authentication account.

The ERD should show zero-or-one on the `profiles` side.

### Role Design

The application currently targets staff users.

Possible roles include:

- `ADMIN`: Manages stations, users, and system information.
- `JANITOR`: Monitors bins and records emptying activities.

The final role values should be confirmed by the project team.

---

## 2.11 bin_emptying_events

**Purpose:** Records every bin emptying or maintenance-related emptying activity performed by staff.

This entity preserves the history of bin emptying instead of simply resetting the current fill percentage.

### Attributes

| Attribute | Data Type | Key | Description |
|---|---|---|---|
| emptying_id | UUID | PK | Unique identifier for each emptying event |
| bin_id | UUID | FK | References the bin that was emptied |
| emptied_by | UUID | FK | References the staff member who performed the emptying |
| fill_percentage_before | DECIMAL(5,2) | | Fill percentage recorded before emptying |
| emptied_at | TIMESTAMPTZ | | Time when the bin was emptied |
| notes | TEXT | | Optional maintenance notes |

### CHECK Constraint

`0 ≤ fill_percentage_before ≤ 100`

### Design Rationale

When a bin becomes full, a staff member needs to empty it.

The system should update the current bin status, but it should also preserve the maintenance history.

Example:

| emptying_id | bin_id | emptied_by | fill_percentage_before |
|---|---|---|---:|
| EM001 | BIN001 | USER001 | 100% |
| EM002 | BIN001 | USER001 | 95% |
| EM003 | BIN001 | USER002 | 100% |

This allows SortSense to analyze:
- How frequently each bin is emptied.
- Which locations require more frequent maintenance.
- Which bins fill up the fastest.
- Maintenance activity performed by staff.

### Why not simply update bin_status to 0%?

Because updating the current status would overwrite the previous value.

If a bin was 100% full and a janitor emptied it, the current status should become approximately 0%, subject to the next valid sensor measurement.

However, the system should still retain the fact that the bin was previously full and was emptied at a particular time.

Therefore:

| Entity | Responsibility |
|---|---|
| bin_status | Current condition |
| bin_emptying_events | Historical maintenance records |

### Relationship

- One bin can have multiple emptying events.
- Each emptying event references exactly one bin.
- One staff profile can perform multiple emptying activities.
- Each emptying event references exactly one staff profile.

---

# 3. Primary Keys, Foreign Keys, and Alternate Keys

## 3.1 Primary Keys (PK)

A Primary Key is an attribute, or combination of attributes, that uniquely identifies each record in an entity.

Every application entity requires a primary key.

SortSense uses UUID identifiers for its primary keys.

| Entity | Primary Key |
|---|---|
| locations | location_id |
| stations | station_id |
| bins | bin_id |
| waste_categories | category_id |
| bin_status | bin_id |
| sensors | sensor_id |
| sensor_readings | reading_id |
| drop_events | event_id |
| devices | device_id |
| profiles | user_id |
| bin_emptying_events | emptying_id |

### Why use UUID?

UUIDs provide unique identifiers without relying on sequential numbering.

This is useful because multiple stations and devices may generate records independently.

UUIDs also avoid exposing simple sequential record numbers through application interfaces.

## 3.2 Foreign Keys (FK)

A Foreign Key references the primary key or a suitable unique key of another entity.

Its purpose is to establish relationships and maintain referential integrity.

For example:

`bins.station_id` references `stations.station_id`.

This ensures that a bin cannot reference a station that does not exist.

### Foreign Key Reference List

| Entity | Foreign Key | References |
|---|---|---|
| stations | location_id | locations.location_id |
| bins | station_id | stations.station_id |
| bins | category_id | waste_categories.category_id |
| bin_status | bin_id | bins.bin_id |
| sensors | bin_id | bins.bin_id |
| sensor_readings | sensor_id | sensors.sensor_id |
| drop_events | actual_bin_id | bins.bin_id |
| drop_events | classified_category_id | waste_categories.category_id |
| drop_events | trigger_sensor_id | sensors.sensor_id |
| devices | station_id | stations.station_id |
| profiles | user_id | auth.users.id |
| bin_emptying_events | bin_id | bins.bin_id |
| bin_emptying_events | emptied_by | profiles.user_id |

Additionally, `drop_events` contains a composite foreign key:

`(trigger_sensor_id, actual_bin_id)` references `sensors(sensor_id, bin_id)`.

This enforces that the triggering sensor belongs to the actual destination bin.

## 3.3 Alternate Keys (AK) and UNIQUE Constraints

An Alternate Key identifies an attribute or combination of attributes that must contain unique values but is not the primary key.

The current design includes:

| Entity | Attribute / Combination | Purpose |
|---|---|---|
| stations | station_code | Prevent duplicate station codes |
| waste_categories | category_name | Prevent duplicate category names |
| sensors | hardware_identifier | Prevent duplicate sensor identifiers |
| sensors | (sensor_id, bin_id) | Supports composite foreign-key validation |
| devices | hardware_identifier | Prevent duplicate controller identifiers |
| devices | station_id | Allow at most one controller per station |

### Composite UNIQUE Constraints

**Bins**

`UNIQUE (station_id, category_id)`

Prevents duplicate waste categories within the same station.

**Sensors**

`UNIQUE (bin_id, sensor_type)`

Prevents multiple sensors of the same type from being assigned to one bin.

**Sensors**

`UNIQUE (sensor_id, bin_id)`

Allows `drop_events` to reference the sensor identity and its assigned bin together.

A composite unique constraint applies to the combination of attributes. It does not mean each attribute must independently be unique.

## 3.4 CHECK Constraints

CHECK constraints restrict values to valid ranges or conditions.

| Entity | Attribute | Constraint |
|---|---|---|
| bin_status | fill_percentage | 0 ≤ value ≤ 100 |
| sensor_readings | fill_percentage | 0 ≤ value ≤ 100 |
| sensor_readings | distance_mm | value ≥ 0 |
| drop_events | classification_confidence | 0 ≤ value ≤ 1 |
| bin_emptying_events | fill_percentage_before | 0 ≤ value ≤ 100 |

These constraints prevent invalid measurement values from being stored.

## 3.5 ENUM Types

ENUM types restrict an attribute to a predefined set of values.

| Entity | Attribute | Allowed Values |
|---|---|---|
| sensors | sensor_type | TOF, IR |
| devices | connection_status | ONLINE, OFFLINE |
| bin_status | operational_status | NORMAL, SENSOR_ERROR |

These attributes represent different concepts and should not be combined.

For example, an ESP32 controller may be ONLINE while one of its bin sensors has a SENSOR_ERROR condition.

---

# 4. Relationship and Cardinality

Cardinality describes how many records in one entity can be associated with records in another entity.

The following relationships define how SortSense organizes its data.

| Relationship | Cardinality | Explanation |
|---|---|---|
| locations → stations | 1 : 0..N | One location can contain multiple stations |
| stations → bins | 1 : 0..N | One station can contain multiple bins |
| waste_categories → bins | 1 : 0..N | One category can be assigned to multiple bins |
| bins → bin_status | 1 : 0..1 | Each bin can have at most one current status record |
| bins → sensors | 1 : 0..N | One bin can have multiple sensors |
| sensors → sensor_readings | 1 : 0..N | One sensor can generate multiple readings |
| bins → drop_events | 1 : 0..N | One bin can receive multiple disposal events |
| waste_categories → drop_events | 1 : 0..N | One category can appear in multiple classification events |
| sensors → drop_events | 1 : 0..N | One sensor can trigger multiple disposal events |
| stations → devices | 1 : 0..1 | One station can have at most one controller |
| auth.users → profiles | 1 : 0..1 | One authenticated user can have at most one profile |
| bins → bin_emptying_events | 1 : 0..N | One bin can have multiple emptying records |
| profiles → bin_emptying_events | 1 : 0..N | One staff member can perform multiple emptying activities |

## 4.1 One-to-Many Relationships

Example:

`stations (1) → bins (0..N)`

A station can contain multiple bins.

However, each bin belongs to exactly one station.

The relationship is implemented by placing `station_id` as a foreign key inside the `bins` entity.

The foreign key is placed on the many side of a one-to-many relationship.

## 4.2 One-to-One Relationships

Example:

`bins (1) → bin_status (0..1)`

Each bin has at most one current status record.

The relationship is implemented by using `bin_status.bin_id` as both a primary key and a foreign key.

This prevents multiple current-status records from being created for the same bin.

## 4.3 Optional One-to-One Relationships

Two important relationships in SortSense are:

### Stations and Devices

`stations (1) → devices (0..1)`

A station can exist before its ESP32 controller is registered.

The relationship is implemented through `devices.station_id`, which is both an FK and an AK (UNIQUE).

This ensures that:
- A device must reference an existing station.
- A station can have zero or one registered device.
- A station cannot have multiple registered devices.

In Crow's Foot notation, the device end should show a circle and a single bar, representing zero or one.

It should not show a circle and a crow's foot, which represents zero or many.

### Supabase Auth Users and Profiles

`auth.users (1) → profiles (0..1)`

An authenticated user may exist before a SortSense profile is created.

The relationship is implemented through `profiles.user_id`, which is both a primary key and foreign key.

This ensures that:
- A profile must reference an existing authenticated user.
- An authenticated user can have zero or one profile.
- A user cannot have multiple SortSense profiles.

The ERD should show zero-or-one on the `profiles` side.

---

# 5. Important Database Integrity Rules

This section describes important constraints that go beyond basic primary-key and foreign-key relationships.

## 5.1 Sensor-to-Bin Consistency

A disposal event must reference a triggering sensor assigned to the same bin identified as the actual destination.

This is enforced through the composite foreign key:

`drop_events(trigger_sensor_id, actual_bin_id)`

References:

`sensors(sensor_id, bin_id)`

The referenced pair must exist in `sensors`.

For example:

| trigger_sensor_id | actual_bin_id | Result |
|---|---|---|
| SEN001 | BIN001 | Valid |
| SEN002 | BIN001 | Invalid if SEN002 belongs to BIN002 |
| SEN002 | BIN002 | Valid |

This prevents the database from recording a disposal event in a bin that does not own the triggering sensor.

## 5.2 IR Sensor Requirement

The composite foreign key validates the sensor-to-bin relationship, but it does not ensure that the triggering sensor is an IR sensor.

Therefore, the following additional rule applies:

`trigger_sensor_id` must reference a sensor where `sensor_type = 'IR'`.

This should be enforced using a database trigger or trusted backend validation.

A normal foreign key cannot enforce a condition based on the referenced row's sensor type.

## 5.3 Bin Category and AI Classification

The system compares:

- `drop_events.classified_category_id`
- The category assigned to `drop_events.actual_bin_id`, through `bins.category_id`.

If the two categories match, the disposal is consistent with the AI classification.

If they differ, the system records a potential sorting error.

The comparison should be performed by the backend or through a database query. The two category values should not be assumed to match automatically.

---

# 6. Business Rules

Business rules define the conditions that the SortSense system must follow regardless of how the application is implemented.

## 6.1 Location and Station Rules

1. A location can contain multiple SortSense stations.
2. Each station must belong to one existing location.
3. Each station must have a unique station code.
4. A station can exist before its controller is registered.
5. A station must be configured with its required waste bins before becoming operational.

## 6.2 Bin Rules

1. Each bin must belong to one station.
2. Each bin must have one assigned waste category.
3. A station cannot contain duplicate bins for the same waste category.
4. The current design expects four categories per station: Plastic, Paper, Metal, and General Waste.
5. Each active bin should have a current status record.
6. Each bin should have the required ToF and IR sensors registered before normal operation.
7. A station setup process must verify that all four required waste categories exist.

## 6.3 Sensor Rules

1. Every sensor must belong to one bin.
2. Each bin can have at most one sensor of each supported type.
3. ToF sensors are responsible for fill-level measurements.
4. IR sensors are responsible for detecting waste disposal.
5. Sensor hardware identifiers must be unique.
6. Sensor failures should be reflected in the corresponding bin's operational status.
7. A disposal event must be triggered by an IR sensor assigned to the actual destination bin.

## 6.4 Waste Classification and Disposal Rules

1. AI classification must reference an existing waste category.
2. A completed disposal event must reference the actual destination bin.
3. A completed disposal event must reference the IR sensor that detected the disposal.
4. The triggering IR sensor must belong to the actual destination bin.
5. Classification confidence must be between 0 and 1.
6. The category assigned to the actual destination bin can be compared with the AI-predicted category.
7. A mismatch between the predicted category and actual destination category indicates a potential sorting error.
8. Only successfully verified disposal events should be counted as completed disposal events.
9. Classification attempts without successful disposal verification should not be counted as completed disposal events.

## 6.5 Bin Monitoring Rules

1. The latest valid ToF measurement updates the current bin status.
2. Historical ToF measurements are preserved in `sensor_readings`.
3. The current fill percentage must remain between 0% and 100%.
4. A sensor error must not be interpreted as a zero-percent fill level.
5. A bin's dashboard status, such as Available, Nearly Full, or Full, should be derived from its fill percentage and configured thresholds.
6. The dashboard should distinguish sensor errors from normal fill-level conditions.

Illustrative thresholds requiring team approval:

| Fill Percentage | Dashboard Status |
|---|---|
| 0–69% | Available |
| 70–89% | Nearly Full |
| 90–100% | Full |

## 6.6 Bin Emptying Rules

1. Each emptying event must reference an existing bin.
2. Each emptying event must identify the staff member who performed the activity.
3. The fill percentage before emptying must be preserved.
4. The emptying timestamp must be recorded.
5. After successful emptying, the current bin status should be reset or recalculated based on the new sensor measurement.
6. Historical sensor readings and disposal events must not be deleted when a bin is emptied.

## 6.7 User and Access Rules

1. Users authenticate through Supabase Auth.
2. Each application profile must reference one authenticated user.
3. Each authenticated user can have at most one application profile.
4. Only authorized staff should access administrative and maintenance functions.
5. Only authorized staff should be able to record or confirm bin emptying activities.
6. User roles determine which application functions are accessible.

---

# 7. Database Design Assumptions

The following assumptions define the scope and limitations of the current SortSense MVP.

## 7.1 Multiple Installations

The database supports multiple locations, each containing multiple stations.

This allows SortSense to expand beyond a single demonstration installation.

## 7.2 Sensor Mapping

The current hardware design assumes that each bin has:
- One ToF sensor.
- One IR break-beam sensor.

The database supports these sensor types through the `sensors` entity.

## 7.3 Device Mapping

Each station is assumed to have one ESP32-S3 controller.

If future hardware designs require multiple controllers per station, the unique constraint on `devices.station_id` and its cardinality must be revised.

## 7.4 Current and Historical Status

The design separates current bin status from historical sensor readings.

This supports efficient dashboard retrieval while preserving measurement history for analytics.

## 7.5 Waste Disposal Verification

The design assumes that an IR sensor event is used to verify disposal after AI classification.

The system should not count an AI classification as a completed disposal unless the corresponding disposal has been verified.

The backend and database must validate that the triggering IR sensor belongs to the actual destination bin.

## 7.6 User Management

Supabase Auth manages authentication accounts, while `profiles` stores SortSense-specific user information.

The exact roles and permissions should be confirmed by the project team.

## 7.7 Historical Data Retention

Sensor readings and event records are intended to be retained for historical analysis.

A future implementation may introduce data-retention policies or archival strategies if the number of sensor readings becomes large.

---

# 8. Future Improvements

The current ERD is intended to support the SortSense MVP. The following areas may require additional design decisions as the project develops.

## 8.1 Sensor Error Granularity

Currently, `bin_status.operational_status` describes the operational condition of the bin monitoring system.

If the team later needs to identify exactly which sensor failed, a more detailed sensor health entity or sensor status attribute may be introduced.

## 8.2 Waste Classification Failures

The current `drop_events` entity focuses on verified disposal events.

If the project later needs to analyze failed classifications, unverified scans, or disposal attempts without successful detection, a separate classification-attempt or scan-events entity may be necessary.

## 8.3 Maintenance Tracking

The current design records bin emptying activities.

More advanced maintenance tracking could include:
- Sensor replacement.
- Controller replacement.
- Hardware repair.
- Manual inspection.
- Maintenance notes and attachments.

These features are outside the current MVP scope.

## 8.4 Analytics

The current entities provide the underlying information needed for dashboard analytics.

Examples include:
- Total waste sorted by category.
- Disposal activity over time.
- Average bin filling rate.
- Number of full bins per location.
- Frequency of bin emptying.
- Potential sorting error rates.

These values can be calculated from stored records rather than requiring a separate table for every statistic.

---

# 9. Summary

The SortSense database design consists of 11 application entities and one external Supabase-managed authentication entity.

The design separates location management, waste classification, hardware monitoring, current bin status, historical measurements, disposal events, and maintenance records.

Primary keys uniquely identify records, while foreign keys establish relationships and maintain referential integrity.

Alternate keys and composite unique constraints prevent duplicate assignments and support more precise relationships.

CHECK constraints and ENUM types restrict values to valid conditions.

The revised design also introduces two important integrity considerations:

1. Optional one-to-one relationships ensure that a station has at most one controller and an authenticated user has at most one application profile.
2. Composite foreign-key validation ensures that the sensor triggering a disposal event belongs to the actual destination bin, while an additional IR sensor validation rule ensures that only the correct sensor type can trigger a verified disposal event.

The separation between current status and historical events allows SortSense to provide real-time monitoring while preserving the historical information required for analytics and maintenance planning.

Overall, this ERD provides the foundation for the SortSense web dashboard, hardware communication, cloud data storage, and future system expansion.

**Document Status:** Database Design Proposal – Version 1.1  
**Next Step:** Team review and approval before Supabase schema implementation.