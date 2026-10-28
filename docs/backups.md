# Backups

A GitHub Actions workflow (`.github/workflows/backup.yml`) backs up production
every **Sunday at 03:00 UTC**. Each backup holds:

- the database: app data (`public`) and user accounts with their 2FA factors
  (`auth`), as a `pg_dump` custom-format file;
- every uploaded file (logos, PDF templates) from the `alimea-files` bucket.

Both are packed into one file encrypted with AES-256 (GPG, passphrase) and kept
as a workflow artifact for **90 days** — about 13 weekly backups. The backup
lives on GitHub, outside Supabase, so it survives losing the Supabase project.

It contains patient health data: the passphrase is what protects it.

## One-time setup

In GitHub → the repository → *Settings → Secrets and variables → Actions*, add:

| Secret | Value |
|--------|-------|
| `SUPABASE_DB_URL` | Supabase → *Connect* → **Session pooler** connection string, with the database password filled in. (The direct connection is IPv6-only and GitHub's runners can't reach it.) |
| `SUPABASE_URL` | The project URL, `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → *Project Settings → API keys* → service role |
| `BACKUP_PASSPHRASE` | A long random passphrase. **Store it in a password manager**: without it no backup can be opened, and nobody can recover it. |

Then run it once by hand: *Actions → Weekly backup → Run workflow*, and check
that it finishes green and an artifact appears on the run page.

GitHub emails the repository owner when a scheduled run fails. Scheduled
workflows are paused after 60 days without commits to the repository; GitHub
emails before that happens, and any commit (or re-enabling it on the Actions
tab) resumes it.

## Restoring

1. **Download** the artifact from the run (*Actions → Weekly backup → a run →
   Artifacts*) and unzip it. You get `alimea-backup-YYYY-MM-DD.tar.gz.gpg`.
2. **Decrypt and unpack** (asks for the passphrase):

   ```bash
   gpg --decrypt alimea-backup-YYYY-MM-DD.tar.gz.gpg | tar -xzf - -C restore/
   ```

   `restore/database.dump` is the database, `restore/files/` the uploaded files.
3. **Restore the database** into an empty project: create a new Supabase
   project, apply `supabase/migrations` in order, then load the data. Triggers
   and foreign-key checks are switched off for the load (the new-account trigger
   would otherwise create duplicate profiles, and plans and consultations point
   at each other):

   ```bash
   pg_restore --data-only --no-owner --schema=public --schema=auth \
     --file=restore/data.sql restore/database.dump
   psql "$TARGET_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
     -c "set session_replication_role = replica" -f restore/data.sql
   ```

   To see what a backup contains: `pg_restore --list restore/database.dump`.
   To recover only some rows into the live project, restore into a scratch
   project as above and copy what you need across.
4. **Restore the files**, with the target project's URL and service-role key
   in `.env.local`:

   ```bash
   npm run backup:storage -- upload restore/files
   ```

Rehearse a restore into a scratch Supabase project once, before you need it.

## Beyond the weekly backup

- Up to a week of work can still be lost between backups. Supabase's paid plan
  adds daily backups (and point-in-time recovery as an add-on) if that window
  becomes too wide.
- `npm run backup:storage -- download <dir>` also works from your own machine
  for an ad-hoc copy of the files.
