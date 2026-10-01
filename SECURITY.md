# Security policy

Security fixes target the latest release and `main`. Older versions may not receive backports.

Please report vulnerabilities privately using [GitHub's vulnerability reporting form](https://github.com/shikki841/inaudio/security/advisories/new). If private reporting is unavailable, ask a maintainer to enable it through an issue containing no exploit details or sensitive data. Never post recordings, transcripts, credentials, or personal information in a public report.

Include the affected version, OS, reproduction steps, impact, and a minimal proof of concept. Give maintainers time to investigate and coordinate a fix before publishing details. Response times depend on maintainer availability.

Particularly relevant areas include IPC validation, model archive extraction, download integrity, renderer isolation, and release automation. Local inference does not mean all app activity is offline: model downloads require network access.

Release artifacts are currently unsigned. SHA-256 checksums detect changed downloads; they do not replace operating-system code signing or establish publisher identity.
