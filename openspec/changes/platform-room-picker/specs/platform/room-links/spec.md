# Spec Delta

## Purpose

Specifies how a room is addressed in the web applications that show rooms, the room-climate dashboard and the 3D explorer, and which links lead from one to the other, so that a visitor can move between a room's place in the building and its history.

## ADDED Requirements

### Requirement: A room has an address in each web application
A room SHALL be addressed with its room id, as specified in `platform/data-contract`, in the query parameter `room`: `/sensors/?room=<room id>` in the room-climate dashboard and `/3d/?room=<room id>` in the 3D explorer. The room id SHALL be written unchanged, URL-encoded where needed. Opening such an address SHALL show that room without any further action of the visitor: the dashboard shows the room's page, and the explorer selects the room, shows its floor and opens its info panel.

#### Scenario: Room in the explorer's address
- **WHEN** a visitor opens `/3d/?room=153`
- **THEN** the explorer shows floor 1 with room `153` selected and its info panel open

#### Scenario: Room id with a dot
- **WHEN** a visitor opens `/3d/?room=U74.1`
- **THEN** room `U74.1` is selected, not `U74`

#### Scenario: Room not in the model
- **WHEN** a visitor opens `/3d/?room=X99` and the model has no room `X99`
- **THEN** no room is selected and the explorer says that the room cannot be found

### Requirement: The dashboard links a room to the building model
The room page of the dashboard SHALL offer a link to the same room in the 3D explorer at the address of "A room has an address in each web application", when the room belongs to a known floor as specified in `platform/data-contract`. The link SHALL be labelled "Im Gebäude zeigen" (English: "Show in the building").

#### Scenario: Room with a known floor
- **WHEN** a visitor views room `105` in the dashboard
- **THEN** the page links to `/3d/?room=105`

#### Scenario: Room without a known floor
- **WHEN** a visitor views a room whose id starts with `X`
- **THEN** the page offers no link to the 3D explorer

### Requirement: The building model links a room to its history
The info panel of the 3D explorer SHALL offer a link to the room's page in the dashboard at the address of "A room has an address in each web application", when the explorer has a live message for the room. The link SHALL be labelled "Show history" ("Verlauf ansehen" where the explorer shows German texts). A room without a live message SHALL show no such link.

#### Scenario: Room with live data
- **WHEN** the info panel of room `105` is open and a live message for `105` has been received
- **THEN** the panel links to `/sensors/?room=105`

#### Scenario: Room without data
- **WHEN** the info panel of room `U08` is open and no live message for `U08` has been received
- **THEN** the panel shows no link to the dashboard
