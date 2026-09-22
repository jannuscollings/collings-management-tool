"""
Seed a demo login + sample tickets so a developer running this locally can see
the database is real and wired up. Idempotent — safe to run repeatedly (it
won't create duplicates). Runs automatically from scripts/setup.sh.

    python manage.py seed_demo
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from tickets.models import Ticket
from work.models import WorkGroup, WorkItem, Workspace

User = get_user_model()

DEMO_EMAIL = "demo@collings.com.au"
DEMO_PASSWORD = "demo12345"

SAMPLE_TICKETS = [
    ("Front door lock jammed at 123 Smith St", "Tenant reports the deadbolt won't turn.",
     Ticket.Status.OPEN, Ticket.Priority.HIGH),
    ("Leaking tap in unit 4B", "Kitchen mixer dripping, needs a plumber.",
     Ticket.Status.IN_PROGRESS, Ticket.Priority.MEDIUM),
    ("Update listing photos for 88 River Rd", "Owner sent new photos to upload.",
     Ticket.Status.OPEN, Ticket.Priority.LOW),
    ("Routine smoke alarm check", "Annual compliance check across managed properties.",
     Ticket.Status.CLOSED, Ticket.Priority.MEDIUM),
]

SAMPLE_WORK_ITEMS = [
    (
        "Property launch",
        "Prepare 18 Harbour Street launch assets",
        "Create the initial digital and print asset set for the new property campaign.",
        WorkItem.Status.IN_PROGRESS,
        WorkItem.Priority.HIGH,
        "2026-10-02",
    ),
    (
        "Campaign content",
        "October landlord newsletter artwork",
        "Prepare the newsletter header and supporting social tiles.",
        WorkItem.Status.NEW,
        WorkItem.Priority.MEDIUM,
        "2026-10-09",
    ),
    (
        "Ongoing requests",
        "Refresh rental appraisal brochure",
        "Update the brochure with the latest Collings brand and contact details.",
        WorkItem.Status.REVIEW,
        WorkItem.Priority.LOW,
        None,
    ),
]


class Command(BaseCommand):
    help = "Create a demo user and sample tickets (idempotent)."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=DEMO_EMAIL,
            defaults={"first_name": "Demo", "last_name": "Agent", "is_staff": True},
        )
        # Always (re)set the demo password so the documented credentials work.
        user.set_password(DEMO_PASSWORD)
        user.is_staff = True
        user.save()
        self.stdout.write(
            self.style.SUCCESS(f"{'Created' if created else 'Updated'} demo user {DEMO_EMAIL}")
        )

        made = 0
        for title, description, status, priority in SAMPLE_TICKETS:
            _, was_created = Ticket.objects.get_or_create(
                title=title,
                defaults={
                    "description": description,
                    "status": status,
                    "priority": priority,
                    "created_by": user,
                },
            )
            made += int(was_created)

        self.stdout.write(self.style.SUCCESS(
            f"Sample tickets ready ({made} created, {len(SAMPLE_TICKETS) - made} already present)."
        ))

        workspace, _ = Workspace.objects.get_or_create(
            slug="creative-design",
            defaults={"name": "Creative & Design", "display_order": 1},
        )
        group_names = ("Property launch", "Campaign content", "Ongoing requests")
        groups = {}
        for display_order, name in enumerate(group_names, start=1):
            groups[name], _ = WorkGroup.objects.get_or_create(
                workspace=workspace,
                name=name,
                defaults={"display_order": display_order},
            )

        work_items_made = 0
        for group_name, title, brief, status, priority, due_date in SAMPLE_WORK_ITEMS:
            _, was_created = WorkItem.objects.get_or_create(
                group=groups[group_name],
                title=title,
                defaults={
                    "brief": brief,
                    "status": status,
                    "priority": priority,
                    "owner": user,
                    "due_date": due_date,
                    "created_by": user,
                },
            )
            work_items_made += int(was_created)

        self.stdout.write(self.style.SUCCESS(
            "Creative & Design workspace ready "
            f"({work_items_made} work items created, "
            f"{len(SAMPLE_WORK_ITEMS) - work_items_made} already present)."
        ))
        self.stdout.write("")
        self.stdout.write(f"  Demo login:  {DEMO_EMAIL}  /  {DEMO_PASSWORD}")
