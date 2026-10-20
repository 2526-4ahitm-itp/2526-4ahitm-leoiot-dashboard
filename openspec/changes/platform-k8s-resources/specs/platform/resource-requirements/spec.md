# Spec Delta

## Purpose

States how much CPU, memory and storage each service of the platform needs in the cluster, so that resources can be requested from the school and every service is scheduled with known limits.

## ADDED Requirements

### Requirement: Every cluster service has stated requests and limits
Every service that runs in the cluster SHALL have a stated CPU request, CPU limit, memory request and memory limit before it is deployed there. The statement SHALL name the sub-project that owns the service.

#### Scenario: Service is added
- **WHEN** a sub-project adds a service to the cluster
- **THEN** its requests and limits are stated in the resource table before the first deployment

#### Scenario: Service without figures
- **WHEN** a service in the cluster has no stated requests or limits
- **THEN** the resource table counts as incomplete and the service is not part of a resource request

### Requirement: Figures are based on measured usage
Each memory request SHALL be at least the typical memory use observed for the service, and each memory limit at least 1.5 times the highest memory use observed. A figure without a measurement SHALL be marked as an estimate together with what it is based on.

#### Scenario: Measured service
- **WHEN** a service was measured on the running system with a typical use of 80 MiB and a peak of 120 MiB
- **THEN** its memory request is at least 80 MiB and its memory limit at least 180 MiB

#### Scenario: Service not yet built
- **WHEN** a service does not run anywhere yet
- **THEN** its figures are marked as estimates and name the comparable service or image they come from

### Requirement: Every volume has a stated size
Every persistent volume SHALL have a stated size that holds the measured data plus at least 24 months of the measured growth, as long as the data it holds has no retention limit. The statement SHALL show the current size and the growth per month it is computed from.

#### Scenario: Database volume
- **WHEN** the database holds 2 GiB and grows by 100 MiB per month
- **THEN** its volume is stated with at least 4448 MiB (2048 MiB + 24 × 100 MiB) and the calculation is written next to it

#### Scenario: Retention limit introduced
- **WHEN** the data contract introduces a retention limit for the stored data
- **THEN** the volume size is recomputed from the retention time instead of 24 months of growth

### Requirement: The totals form the resource request
The resource table SHALL give the sums of all CPU requests, CPU limits, memory requests, memory limits and volume sizes, including the space for backups. These sums SHALL be the figures handed to the school as the resource request.

#### Scenario: Request is prepared
- **WHEN** the team prepares the resource request for the teacher
- **THEN** it takes the totals from the resource table and does not add figures that are missing there

### Requirement: Figures are checked after the move
The figures SHALL be compared with the actual usage in the cluster within four weeks after the move and whenever a volume reaches 80 % of its stated size, and the table SHALL be updated when they differ by more than 50 %.

#### Scenario: Volume fills up
- **WHEN** the database volume reaches 80 % of its stated size
- **THEN** the growth is measured again and the volume size and the resource request are updated

#### Scenario: Service needs far less than requested
- **WHEN** a service uses less than half of its memory request for four weeks
- **THEN** its request is lowered in the resource table
