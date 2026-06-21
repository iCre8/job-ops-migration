---
name: log-sync
description: Validates and synchronizes changes logs (app-change.log, infrastructure-change.log, configuration-change.log) and updates README.md.
user-invokable: true
---

# Log Sync Skill

This skill is invoked when changes are made to the project logs to ensure they remain consistent, clean, and properly mapped to code modifications.

## Core Rules

Always check and enforce the following rules when this skill is invoked:

1. **Categorization**:
   - **`app-change.log`**: Must contain logic changes, updates to services, React components, repository helpers, utility methods, and timezone corrections.
   - **`infrastructure-change.log`**: Must contain backend architecture shifts, datastore migrations (e.g., SQLite to Postgres), connection pools, docker compose adjustments, and WASM/PGlite test virtualizations.
   - **`configuration-change.log`**: Must contain workspace packages, package.json dependencies, typescript/vite compiler overrides, build runners, environment file schemas (`.env`), and linters configuration.

2. **Formatting**:
   - Each entry must be grouped under a date header in `[YYYY-MM-DD]` format.
   - Use bullet points detailing:
     - The component or file changed.
     - A concise explanation of the change and why it was introduced.

3. **README.md Synchronization**:
   - Ensure the database descriptions, startup guides, and watcher troubleshooting guidelines in `README.md` remain accurate and reflect the changes noted in the logs.
   - Maintain active Markdown links in `README.md` referencing the three changelogs:
     - `app-change.log`
     - `infrastructure-change.log`
     - `configuration-change.log`

4. **Audit Procedure**:
   - Check if any recent file change is undocumented in the relevant logs.
   - Ensure date formats are consistent across all three log files.
