# Proposal

## Why

LeoIoT is to move from the single school VM (vm23, Docker Compose) into a Kubernetes cluster. Before the move the team has to request CPU, memory and storage from the school, and nobody knows today how much the system needs: no service declares any resource figures, the database has no retention limit, and the only backup is a weekly script that keeps its copies on the same VM it is meant to protect (issue #54). This change states what the system needs and how its data is protected, so the request can be handed to the teacher and the cluster setup has numbers to start from.

## What Changes

- List every service that will run in the cluster, mapped from today's Compose stacks (`legacy/`, `leoiot-pv/`) to the new sub-projects.
- State CPU and memory per service as Kubernetes requests and limits, derived from measurements of the running system on vm23 and from local measurements of the new images.
- State the persistent storage per volume, derived from the current database size, its growth per month and the retention time.
- Define the backup concept: what is backed up, how often, where it is stored, how long it is kept and how a restore is done.
- Try one restore from a real backup into a separate instance and write the result down.
- Provide a measurement script for vm23 (`measure-vm23.sh` in this change) that collects the figures above in one run.

Not in this change:

- Kubernetes manifests, a Helm chart or the cluster setup itself. Those follow in a later `platform-…` change once the cluster and its storage class are known.
- A retention limit for the PV readings. The data contract keeps them without limit; this change sizes storage for that and points out the cost.
- Changes to `legacy/backup/` or the cron job on vm23. The running backup stays as it is until the cluster takes over.

## Capabilities

### New Capabilities

- `platform/resource-requirements`: every service run by the platform has stated CPU and memory requests and limits and every volume a stated size, based on measurements and kept current.
- `platform/backup`: what data the platform backs up, how often, where, for how long, and how a restore is done and verified.

### Modified Capabilities

None. `platform/data-contract` is referred to for the bucket and its retention, not changed.

## Impact

- **Result for the teacher**: `design.md` of this change is the resource request (service table, totals, storage, backup). It is complete once the vm23 measurements are filled in.
- **vm23**: read-only measurements (`docker stats`, volume and database sizes, InfluxDB bucket statistics) run by a team member with access, and one restore into a separate, temporary container. No running service changes.
- **Ownership**: `platform` has no assigned owner. The story is assigned to the PV team (Stefan Schachner), but the result covers all sub-projects, so the project lead and the sensors and 3D teams review the service list before merge.
- **Follow-up**: the Kubernetes deployment change uses these figures; `platform/backup` replaces `legacy/backup/` once the cluster runs.
