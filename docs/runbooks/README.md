# Runbooks

Step-by-step procedures for operating the app. Each one says when to use it, what to do, and how to check that it worked. Reference material (how things are built, the infrastructure inventory) is in [`../reference/`](../reference/).

| Runbook | Use it when |
| --- | --- |
| [Yahoo sign-in provider setup](yahoo-sign-in-provider.md) | Setting up or repairing sign-in for an environment |
| [Yahoo secret exposure](yahoo-secret-exposure.md) | The Yahoo client secret may have leaked |
| [Encryption key rotation](encryption-key-rotation.md) | Replacing the key that encrypts stored Yahoo tokens |
| [Restore and rollback](restore-and-rollback.md) | A deploy is bad, or data or the schema is lost |
| [Release and scheduled jobs](release.md) | Releasing to production, or setting up the release workflows |
| [Season rollover check](season-rollover-check.md) | A new fantasy season opens on Yahoo |
| [Yahoo fixture capture](yahoo-fixture-capture.md) | Recording real Yahoo responses as test fixtures |
