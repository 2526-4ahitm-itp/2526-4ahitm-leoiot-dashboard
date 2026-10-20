# Spec Delta

## Purpose

Protects the data the platform cannot rebuild from the repository: it states what is backed up, how often, where the copies are kept, for how long, and how a restore is done and proven to work.

## ADDED Requirements

### Requirement: The database is backed up completely every day
The platform SHALL create a full backup of the database once a day, including all buckets and the metadata (organisations, users, tokens). A backup SHALL be complete or SHALL be reported as failed; a partial backup SHALL NOT count as a backup.

#### Scenario: Daily run
- **WHEN** a day has passed since the last successful backup
- **THEN** a new full backup exists that contains the bucket `server_data` and the database metadata

#### Scenario: Backup fails
- **WHEN** the backup cannot be completed
- **THEN** the failure is visible to the team (failed job in the cluster or a message) on the same day and no incomplete copy is kept as the newest backup

### Requirement: Only data that cannot be rebuilt is backed up
The backup SHALL cover the database. Data that is rebuilt from the repository or recreated by running services SHALL NOT be backed up: container images, static web apps, provisioned dashboards and the broker's persistence store.

#### Scenario: Broker data is lost
- **WHEN** the broker's persistence volume is lost
- **THEN** no restore is needed, because retained messages are published again by the collectors within a minute

#### Scenario: Dashboard volume is lost
- **WHEN** a dashboard service loses its volume
- **THEN** it is recreated from the repository and no data from the backup is needed

### Requirement: Backups are kept away from the data they protect
Every backup SHALL be stored outside the volume of the database and on storage that does not fail together with the node or cluster the database runs on. Copying a backup there SHALL be part of the backup run.

#### Scenario: Database volume is lost
- **WHEN** the database volume is deleted or corrupted
- **THEN** the latest backup is still available

#### Scenario: Cluster node is lost
- **WHEN** the node that runs the database fails completely
- **THEN** the backups are still available from the backup storage

### Requirement: Backups are kept for a stated time
The platform SHALL keep the daily backups of the last 7 days and one backup per week for the last 4 weeks. Older backups SHALL be deleted automatically.

#### Scenario: Backups after five weeks of operation
- **WHEN** backups have run daily for five weeks
- **THEN** the backup storage holds 7 daily and 4 weekly backups and none older than 4 weeks

### Requirement: Backup access is limited and kept out of the repository
The backup SHALL authenticate with credentials stored as a cluster secret, never in the repository, a script or an image. A copy of these credentials and of all other platform secrets SHALL be kept by the teacher or the project lead outside the cluster.

#### Scenario: Repository is published
- **WHEN** someone reads the whole repository
- **THEN** they find no token or password that gives access to the database or the backups

#### Scenario: Cluster is rebuilt from scratch
- **WHEN** the cluster and all its secrets are lost
- **THEN** the secrets are restored from the copy kept outside the cluster before the data is restored

### Requirement: The restore is documented and proven
The restore procedure SHALL be written down step by step. A restore of a real backup into a separate, temporary instance SHALL be performed before the move, at least once per semester and after every change to the backup procedure, and its date, duration, backup used and result SHALL be recorded.

#### Scenario: Restore test
- **WHEN** a restore test is performed
- **THEN** the restored instance answers a query on `solax_stats` for the day the backup was taken, and the record states date, duration, backup and result

#### Scenario: Production is not touched
- **WHEN** a restore test is performed
- **THEN** it restores into a separate instance and the running database is not changed
