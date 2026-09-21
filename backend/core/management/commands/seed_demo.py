"""
Seed a demo login + sample tickets so a developer running this locally can see
the database is real and wired up. Idempotent — safe to run repeatedly (it
won't create duplicates). Runs automatically from scripts/setup.sh.

    python manage.py seed_demo
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from tickets.models import Ticket

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
        self.stdout.write("")
        self.stdout.write(f"  Demo login:  {DEMO_EMAIL}  /  {DEMO_PASSWORD}")
