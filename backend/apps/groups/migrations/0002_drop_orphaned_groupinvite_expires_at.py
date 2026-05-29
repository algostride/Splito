"""Remove the orphaned groupinvite.expires_at column.

This database was migrated while a 0002_groupinvite_expires_at migration existed.
That migration was later deleted from the repository, so the column stayed in
the database with no model field and no migration describing it. Nothing in the
codebase references it -- InviteMemberView never set it and AcceptInviteView
never checked it -- so the expiry feature was abandoned mid-way.

The column was NOT NULL with no default, so it went unnoticed until it broke
something: every POST to /api/v1/groups/<id>/invite/ raises an IntegrityError,
because the insert omits a column the table requires. Group creation still
worked, which is why this survived: adding members is the only path that
touches invites.

Django cannot detect this on its own. makemigrations --check reports "No
changes detected" because the model, which is the source of truth, correctly
has no expires_at field. Only the database disagrees.

The SQL is guarded so it is safe to run against a database that never had the
column, which is the case for any fresh checkout where this migration is
applied to an empty database.
"""

from django.db import migrations


DROP_COLUMN = """
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'groups_groupinvite' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE groups_groupinvite DROP COLUMN expires_at;
    END IF;
END
$$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('groups', '0001_initial'),
    ]

    operations = [
        # No state operation: the model has no expires_at field, so there is
        # nothing for the migration state to change. This only repairs the
        # database to match the state Django already believes is correct.
        migrations.RunSQL(DROP_COLUMN, migrations.RunSQL.noop),
    ]
